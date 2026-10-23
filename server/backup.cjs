'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {DatabaseSync,backup} = require('node:sqlite');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function isInside(parent, child) { const relative=path.relative(parent,child); return relative==='' || (!relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative)); }
function requireFile(file) { if(!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())throw new Error('El respaldo no admite enlaces ni archivos especiales.'); }
function verifySnapshot(directory) {
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  if(manifest.format!==1 || !Array.isArray(manifest.files) || !manifest.files.some(f=>f.path==='vivero.sqlite'))throw new Error('Manifiesto de respaldo inválido.');
  const seen=new Set();
  for(const file of manifest.files) {
    if(!file || typeof file.path!=='string' || !/^(?:vivero\.sqlite|images\/[a-f0-9-]{36}\.webp)$/.test(file.path) || seen.has(file.path))throw new Error('El respaldo contiene una ruta inválida o repetida.');
    seen.add(file.path);
    const source=path.join(directory,file.path); requireFile(source);
    if(digest(source)!==file.sha256)throw new Error('El respaldo está incompleto o fue alterado: '+file.path);
  }
  const db=new DatabaseSync(path.join(directory,'vivero.sqlite'),{readOnly:true});
  try {
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('SQLite no superó la verificación de integridad.');
    for(const p of db.prepare('SELECT image FROM products').all()) {
      if(p.image.startsWith('/uploads/')) {
        const file='images/'+p.image.slice('/uploads/'.length);
        if(!seen.has(file))throw new Error('Falta una fotografía referenciada por el catálogo.');
      }
    }
  } finally { db.close(); }
  return manifest;
}
async function createBackup(dataDirectory,destination) {
  dataDirectory=path.resolve(dataDirectory); destination=path.resolve(destination);
  if(isInside(path.join(dataDirectory,'images'),destination) || destination===dataDirectory)throw new Error('El respaldo debe estar fuera de la carpeta de fotos.');
  const source=path.join(dataDirectory,'vivero.sqlite'); requireFile(source);
  if(fs.existsSync(destination))throw new Error('La carpeta de destino ya existe. No se sobrescriben respaldos.');
  fs.mkdirSync(path.dirname(destination),{recursive:true}); fs.mkdirSync(destination,{mode:0o700});
  const db=new DatabaseSync(source,{readOnly:true});
  try { await backup(db,path.join(destination,'vivero.sqlite')); } finally { db.close(); }
  // Photos are immutable and never deleted by the application. Copying after the
  // SQLite snapshot includes every referenced photo, plus possibly newer ones.
  fs.mkdirSync(path.join(destination,'images'));
  const files=['vivero.sqlite'];
  for(const name of fs.readdirSync(path.join(dataDirectory,'images'))) {
    if(!/^[a-f0-9-]{36}\.webp$/.test(name))throw new Error('Se encontró un archivo de foto inesperado.');
    const image=path.join(dataDirectory,'images',name); requireFile(image);
    fs.copyFileSync(image,path.join(destination,'images',name),fs.constants.COPYFILE_EXCL);
    files.push('images/'+name);
  }
  const snapshot=new DatabaseSync(path.join(destination,'vivero.sqlite'));
  try { snapshot.exec('DELETE FROM sessions; PRAGMA journal_mode=DELETE;'); } finally { snapshot.close(); }
  const manifest={format:1,createdAt:new Date().toISOString(),sourceCommit:process.env.RENDER_GIT_COMMIT || null,files:files.map(file=>({path:file,sha256:digest(path.join(destination,file))}))};
  fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
  verifySnapshot(destination);
  return destination;
}
function restoreBackup(source,destination) {
  source=path.resolve(source); destination=path.resolve(destination);
  if(isInside(source,destination))throw new Error('La restauración debe estar fuera del respaldo original.');
  const manifest=verifySnapshot(source);
  if(fs.existsSync(destination))throw new Error('Restaura en una carpeta nueva. No se sobrescriben datos en uso.');
  fs.mkdirSync(path.dirname(destination),{recursive:true}); fs.mkdirSync(destination,{mode:0o700}); fs.mkdirSync(path.join(destination,'images'));
  for(const file of manifest.files)fs.copyFileSync(path.join(source,file.path),path.join(destination,file.path),fs.constants.COPYFILE_EXCL);
  return destination;
}
if(require.main===module) {
  const args=process.argv.slice(2);
  if(args[0]==='restore') {
    try { if(args.length!==3)throw new Error('Uso: npm run restore -- RESPALDO CARPETA_NUEVA'); console.log('Restauración verificada: '+restoreBackup(args[1],args[2])); }
    catch(error){console.error(error.message);process.exitCode=1;}
  } else {
    const directory=process.env.DATA_DIR || path.join(__dirname,'../data');
    const destination=args[0] || path.join(directory,'backups',new Date().toISOString().replace(/[:.]/g,'-'));
    createBackup(directory,destination).then(result=>console.log('Respaldo verificado: '+result)).catch(error=>{console.error(error.message);process.exitCode=1;});
  }
}
module.exports={createBackup,restoreBackup,verifySnapshot};

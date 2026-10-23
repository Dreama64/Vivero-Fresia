const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {openDatabase}=require('../server/database.cjs');
const {createBackup,restoreBackup,verifySnapshot}=require('../server/backup.cjs');
const {createApp}=require('../server/app.cjs');
test('online backup and recovery retain catalog/photos and reject corruption without overwriting data',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vivero-backup-'));
  const data=path.join(directory,'data'); const db=openDatabase(data);
  const name=randomUUID()+'.webp';
  fs.copyFileSync(path.join(__dirname,'../imagenes/web/1.webp'),path.join(data,'images',name));
  db.prepare('INSERT INTO products(id,name,category,image,price,available,visible) VALUES(?,?,?,?,?,?,?)').run('backup-test','Producto de prueba','Pruebas','/uploads/'+name,4500,1,0);
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('test-session','test-csrf',Date.now()+10000);
  try {
    const snapshot=await createBackup(data,path.join(directory,'snapshot'));
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count,1);
    assert.equal(verifySnapshot(snapshot).files.length,2);
    const restored=restoreBackup(snapshot,path.join(directory,'restored'));
    const recovered=openDatabase(restored);
    try {
      const p=recovered.prepare('SELECT * FROM products WHERE id=?').get('backup-test'); assert.equal(p.price,4500); assert.equal(p.visible,0);
      assert.equal(recovered.prepare('SELECT COUNT(*) AS count FROM products').get().count,19);
      assert.equal(recovered.prepare('SELECT COUNT(*) AS count FROM sessions').get().count,0);
      assert.deepEqual(fs.readFileSync(path.join(restored,'images',name)),fs.readFileSync(path.join(data,'images',name)));
    }finally{recovered.close();}
    assert.throws(()=>restoreBackup(snapshot,restored),/carpeta nueva/);
    await assert.rejects(createBackup(data,snapshot),/ya existe/);
    await assert.rejects(createBackup(data,path.join(data,'images','bad')),/fuera/);
    fs.appendFileSync(path.join(snapshot,'images',name),'corrupt');
    assert.throws(()=>restoreBackup(snapshot,path.join(directory,'bad-restore')),/alterado/);
    assert(!fs.existsSync(path.join(directory,'bad-restore')));
  }finally{db.close();if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'vivero-backup-'))fs.rmSync(directory,{recursive:true,force:true});}
});
test('production fails closed without a durable directory or HTTPS origin',()=>{
  assert.throws(()=>createApp({production:true,dataDir:'',publicOrigin:'https://example.com'}),/DATA_DIR/);
  assert.throws(()=>createApp({production:true,dataDir:os.tmpdir(),publicOrigin:'http://example.com'}),/HTTPS/);
});

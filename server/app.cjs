'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { openDatabase, verifyPassword, passwordHash } = require('./database.cjs');
const { storefront } = require('./catalog.cjs');
const root = path.resolve(__dirname, '..');
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(body)); };
const failure = (code, message) => Object.assign(new Error(message), { status:code });
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw failure(415, 'Envía los datos como JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 3 * 1024 * 1024) throw failure(413, 'La imagen es demasiado grande.'); chunks.push(chunk); }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Object required');
    return parsed;
  } catch { throw failure(400, 'Los datos no son válidos.'); }
}
function validateProduct(body) {
  const text = (field, max, required = false) => {
    if (typeof body[field] !== 'string') throw failure(400, 'Revisa los campos del producto.');
    const value = body[field].trim();
    if ((required && !value) || value.length > max) throw failure(400, 'Revisa el largo del nombre, categoría o descripción.');
    return value;
  };
  if (body.price !== null && (!Number.isSafeInteger(body.price) || body.price < 0 || body.price > 999999999)) throw failure(400, 'El precio debe ser un número entero en pesos chilenos.');
  if (typeof body.available !== 'boolean' || typeof body.visible !== 'boolean') throw failure(400, 'Revisa disponibilidad y visibilidad.');
  return { name:text('name',100,true), category:text('category',60,true), description:text('description',2000), price:body.price, available:Number(body.available), visible:Number(body.visible) };
}
function createApp({ dataDir = process.env.DATA_DIR, publicOrigin = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL, production = process.env.NODE_ENV === 'production', initialPassword } = {}) {
  if (production && !dataDir) throw new Error('Producción requiere DATA_DIR apuntando al disco persistente.');
  dataDir = path.resolve(dataDir || path.join(root,'data'));
  if (production && (!publicOrigin || new URL(publicOrigin).protocol !== 'https:')) throw new Error('Producción requiere PUBLIC_ORIGIN con HTTPS.');
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) throw new Error('PUBLIC_ORIGIN debe ser un origen sin ruta ni barra final.');
  const db = openDatabase(dataDir);
  if (initialPassword && !db.prepare("SELECT value FROM settings WHERE key='admin_password'").get()) db.prepare("INSERT INTO settings VALUES('admin_password',?)").run(passwordHash(initialPassword));
  const attempts = new Map();
  const hash = token => createHash('sha256').update(token).digest('hex');
  const all = () => db.prepare('SELECT * FROM products ORDER BY rowid').all().map(p => ({ ...p, available:Boolean(p.available), visible:Boolean(p.visible) }));
  function session(req) {
    const token = /(?:^|;\s*)vivero_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) return null;
    return db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(hash(token), Date.now());
  }
  function sameOrigin(req) {
    const origin = publicOrigin || `http://127.0.0.1:${server.address().port}`;
    if (req.headers.origin !== origin) throw failure(403, 'La solicitud no proviene de este sitio. Recarga la página.');
  }
  function auth(req, write = false) {
    const current = session(req);
    if (!current) throw failure(401, 'Tu sesión terminó. Vuelve a ingresar.');
    if (write) { sameOrigin(req); if (req.headers['x-csrf-token'] !== current.csrf) throw failure(403, 'Recarga el panel antes de guardar.'); }
    return current;
  }
  const server = http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = decodeURIComponent(url.pathname);
      if (route === '/healthz' && ['GET','HEAD'].includes(req.method)) {
        db.prepare('SELECT 1 FROM products LIMIT 1').get();
        fs.accessSync(path.join(dataDir,'images'),fs.constants.R_OK | fs.constants.W_OK);
        if (req.method === 'HEAD') { res.writeHead(200,{'Cache-Control':'no-store'}); return res.end(); }
        return json(res,200,{status:'ok'});
      }
      if (route === '/api/session' && req.method === 'GET') { const s = session(req); return json(res,200,{ authenticated:Boolean(s), ...(s ? { csrf:s.csrf } : {}) }); }
      if (route === '/api/login' && req.method === 'POST') {
        sameOrigin(req);
        const key = req.socket.remoteAddress;
        let attempt = attempts.get(key);
        if (attempt && attempt.until > Date.now() && attempt.count >= 5) throw failure(429,'Demasiados intentos. Espera 15 minutos.');
        const body = await readBody(req);
        attempt = attempts.get(key);
        if (attempt && attempt.until > Date.now() && attempt.count >= 5) throw failure(429,'Demasiados intentos. Espera 15 minutos.');
        const setting = db.prepare("SELECT value FROM settings WHERE key='admin_password'").get();
        if (!setting) throw failure(503,'El administrador debe configurar la contraseña antes del primer acceso.');
        if (typeof body.password !== 'string' || body.password.length > 200 || !verifyPassword(body.password,setting.value)) {
          const current = attempt && attempt.until > Date.now() ? attempt : {count:0,until:Date.now()+900000};
          current.count++; attempts.set(key,current);
          throw failure(401,'La contraseña no es correcta.');
        }
        attempts.delete(key);
        const previous = session(req);
        if (previous) db.prepare('DELETE FROM sessions WHERE token=?').run(previous.token);
        db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
        const token = randomBytes(32).toString('hex');
        const csrf = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),csrf,Date.now()+8*3600000);
        res.setHeader('Set-Cookie',`vivero_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? '; Secure' : ''}`);
        return json(res,200,{csrf});
      }
      if (route === '/api/logout' && req.method === 'POST') {
        const s = auth(req,true);
        db.prepare('DELETE FROM sessions WHERE token=?').run(s.token);
        res.setHeader('Set-Cookie',`vivero_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
        return json(res,200,{ok:true});
      }
      if (route === '/api/products' && req.method === 'GET') { auth(req); return json(res,200,all()); }
      if (route === '/api/images' && req.method === 'POST') {
        auth(req,true);
        const body = await readBody(req);
        if (typeof body.image !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image)) throw failure(400,'La imagen no es válida.');
        const buffer = Buffer.from(body.image,'base64');
        if (buffer.length > 2*1024*1024) throw failure(413,'La foto debe pesar menos de 2 MB después de optimizarse.');
        if (buffer.length < 20 || buffer.toString('ascii',0,4) !== 'RIFF' || buffer.toString('ascii',8,12) !== 'WEBP' || buffer.readUInt32LE(4)+8 !== buffer.length) throw failure(400,'Se requiere una foto WebP válida.');
        const name = `${randomUUID()}.webp`;
        fs.writeFileSync(path.join(dataDir,'images',name), buffer, { flag:'wx' });
        return json(res,201,{image:`/uploads/${name}`});
      }
      const match = /^\/api\/products(?:\/([A-Za-z0-9-]+))?$/.exec(route);
      if (match && ['POST','PUT','DELETE'].includes(req.method)) {
        auth(req,true);
        const id = match[1];
        const previous = id ? db.prepare('SELECT * FROM products WHERE id=?').get(id) : null;
        if (id && !previous) throw failure(404,'Ese producto ya no existe.');
        if ((req.method === 'POST') === Boolean(id)) throw failure(405,'Acción no disponible.');
        const body = await readBody(req);
        if (previous && body.version !== previous.version) throw failure(409,'Este producto cambió en otra pestaña. Actualiza la lista antes de guardar.');
        if (req.method === 'DELETE') {
          const result = db.prepare('DELETE FROM products WHERE id=? AND version=?').run(id,body.version);
          if (!result.changes) throw failure(409,'Este producto cambió. Actualiza la lista.');
          return json(res,200,{ok:true});
        }
        const p = validateProduct(body);
        const image = body.image;
        const upload = typeof image === 'string' && /^\/uploads\/[a-f0-9-]{36}\.webp$/.test(image) && fs.existsSync(path.join(dataDir,'images',path.basename(image)));
        const unchanged = previous && image === previous.image;
        if (!upload && !unchanged) throw failure(400,'Sube una fotografía antes de guardar.');
        if (id) {
          const result = db.prepare('UPDATE products SET name=?,category=?,description=?,image=?,price=?,available=?,visible=?,version=version+1 WHERE id=? AND version=?').run(p.name,p.category,p.description,image,p.price,p.available,p.visible,id,body.version);
          if (!result.changes) throw failure(409,'Este producto cambió. Actualiza la lista.');
        }
        else db.prepare('INSERT INTO products(id,name,category,description,image,price,available,visible) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),p.name,p.category,p.description,image,p.price,p.available,p.visible);
        return json(res,id ? 200 : 201,{ok:true});
      }
      if (route.startsWith('/api/')) throw failure(404,'No encontramos esa acción.');
      if (!['GET','HEAD'].includes(req.method)) throw failure(405,'Método no permitido.');
      if (route === '/' || route === '/index.html') {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        return res.end(req.method === 'HEAD' ? undefined : storefront(fs.readFileSync(path.join(root,'index.html'),'utf8'),all().filter(p => p.visible)));
      }
      let file;
      if (/^\/uploads\/[a-f0-9-]{36}\.webp$/.test(route)) file = path.join(dataDir,'images',path.basename(route));
      else if (['/admin','/admin/'].includes(route)) file = path.join(root,'admin/index.html');
      else if (/^\/(?:styles\.css|shop\.css|script\.js|favicon\.svg|admin\/(?:admin\.js|admin\.css))$/.test(route) || /^\/(?:imagenes|iconos)\/[a-zA-Z0-9_./-]+\.(?:webp|jpe?g|png)$/.test(route)) {
        file = path.resolve(root,'.'+route);
        if (!file.startsWith(root+path.sep)) throw failure(403,'Acceso no permitido.');
      } else throw failure(404,'Página no encontrada.');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw failure(404,'Archivo no encontrado.');
      const type = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'}[path.extname(file)];
      res.writeHead(200,{'Content-Type':type,'Cache-Control':route.startsWith('/uploads/') ? 'public, max-age=31536000, immutable' : 'no-cache', ...(route.startsWith('/admin') ? {'X-Robots-Tag':'noindex, nofollow'} : {})});
      res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file));
    } catch (error) { if (!res.headersSent) json(res,error.status || 500,{error:error.status ? error.message : 'No se pudo completar la acción. Intenta nuevamente.'}); else res.end(); }
  });
  server.requestTimeout = 20000;
  server.on('close',() => db.close());
  return {server,db};
}
if (require.main === module) {
  const {server} = createApp();
  server.listen(Number(process.env.PORT || 8768),process.env.HOST || '127.0.0.1',() => console.log(`Vivero disponible en el puerto ${server.address().port}`));
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1),15000);
    timeout.unref();
    server.close(() => { clearTimeout(timeout); process.exitCode = 0; });
  };
  process.once('SIGTERM',shutdown);
  process.once('SIGINT',shutdown);
}
module.exports = {createApp};

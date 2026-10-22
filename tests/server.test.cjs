const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createApp} = require('../server/app.cjs');
test('private catalog, persistent products, image uploads, origin/CSRF and version checks',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vivero-test-'));
  let app=createApp({dataDir:directory,initialPassword:'test-only-long-password'});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  let origin=`http://127.0.0.1:${app.server.address().port}`;
  let cookie='',csrf='';
  async function request(route,method='GET',body,extra={}){
    return fetch(origin+route,{method,headers:{...(cookie ? {Cookie:cookie}:{}),...(method!=='GET' ? {Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'}:{}),...extra},...(body ? {body:JSON.stringify(body)}:{})});
  }
  try {
    assert.equal((await request('/api/products')).status,401);
    assert.equal((await request('/api/products','POST',{})).status,401);
    for(const file of ['/server/app.cjs','/data/vivero.sqlite','/.env','/.git/config','/catalog.seed.json']) assert.equal((await request(file)).status,404);
    const login=await request('/api/login','POST',{password:'test-only-long-password'});
    assert.equal(login.status,200); cookie=login.headers.get('set-cookie').split(';')[0]; csrf=(await login.json()).csrf;
    assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    let products=await (await request('/api/products')).json(); assert.equal(products.length,18);
    assert(products.every(p=>p.price===null));
    assert.equal((await request('/api/products','POST',{}, {'X-CSRF-Token':''})).status,403);
    assert.equal((await request('/api/products','POST',{}, {Origin:'https://other.example'})).status,403);
    assert.equal((await request('/api/images','POST',{image:Buffer.from('<svg onload=alert(1)>').toString('base64')})).status,400);
    const upload=await request('/api/images','POST',{image:fs.readFileSync(path.join(__dirname,'../imagenes/web/1.webp')).toString('base64')});
    assert.equal(upload.status,201); const image=(await upload.json()).image;
    const p={name:'Prueba <script>alert(1)</script>',category:'Pruebas',description:'Descripción de prueba',price:3500,available:true,visible:true,image};
    assert.equal((await request('/api/products','POST',{...p,price:1.5})).status,400);
    assert.equal((await request('/api/products','POST',{...p,image:'https://other.example/file.svg'})).status,400);
    assert.equal((await request('/api/products','POST',p)).status,201);
    products=await (await request('/api/products')).json(); let created=products.find(x=>x.name===p.name);
    const html=await (await request('/')).text(); assert(html.includes('Prueba &lt;script&gt;')); assert(!html.includes('<script>alert(1)</script>'));
    assert.equal((await request('/api/products/'+created.id,'PUT',{...created,visible:false})).status,200);
    assert(!(await (await request('/')).text()).includes('Prueba &lt;script&gt;'));
    assert.equal((await request('/api/products/'+created.id,'PUT',created)).status,409);
    products=await (await request('/api/products')).json(); created=products.find(x=>x.id===created.id);
    assert.equal((await request('/api/products/'+created.id,'PUT',{...created,visible:true,available:false})).status,200);
    const soldOut=await (await request('/')).text(); assert(soldOut.includes('class="sold-out"')); assert(soldOut.includes('data-available="false"'));
    await new Promise(resolve=>app.server.close(resolve));
    app=createApp({dataDir:directory}); await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve)); origin=`http://127.0.0.1:${app.server.address().port}`;
    products=await (await request('/api/products')).json(); assert.equal(products.length,19); created=products.find(x=>x.id===created.id);
    assert.equal(created.price,3500); assert.equal(created.available,false); assert.equal((await request(image)).status,200);
    const competing=await Promise.all([request('/api/products/'+created.id,'PUT',{...created,name:'Edición A'}),request('/api/products/'+created.id,'PUT',{...created,name:'Edición B'})]);
    assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
    created=(await (await request('/api/products')).json()).find(x=>x.id===created.id);
    assert.equal((await request('/api/products/'+created.id,'DELETE',{version:created.version})).status,200);
    assert.equal((await (await request('/api/products')).json()).length,18);
    assert.equal((await request('/api/logout','POST',{})).status,200);
    assert.equal((await request('/api/products')).status,401);
    for(let i=0;i<5;i++) assert.equal((await request('/api/login','POST',{password:'incorrect'})).status,401);
    assert.equal((await request('/api/login','POST',{password:'test-only-long-password'})).status,429);
  } finally { await new Promise(resolve=>app.server.close(resolve)); if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'vivero-test-'))fs.rmSync(directory,{recursive:true,force:true}); }
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createApp}=require('../server/app.cjs');
test('production behind HTTPS proxy uses canonical origin and secure session cookie',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vivero-production-'));
  const app=createApp({dataDir:directory,production:true,publicOrigin:'https://vivero.example',initialPassword:'production-test-only'});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  try {
    assert.equal((await fetch(url+'/healthz')).status,200);
    const bad=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example'},body:JSON.stringify({password:'production-test-only'})});
    assert.equal(bad.status,403);
    const login=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://vivero.example'},body:JSON.stringify({password:'production-test-only'})});
    assert.equal(login.status,200); assert.match(login.headers.get('set-cookie'),/; Secure/);
    const response=await fetch(url+'/api/products',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});
    assert.equal(response.status,200);
    assert.equal((await response.json()).length,18);
  }finally{await new Promise(resolve=>app.server.close(resolve));if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'vivero-production-'))fs.rmSync(directory,{recursive:true,force:true});}
});

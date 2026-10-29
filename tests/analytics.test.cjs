const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('../server/app.cjs');
for (const [label,production,analyticsToken,enabled] of [
  ['production configured',true,'a'.repeat(32),true],
  ['production unconfigured',true,'',false],
  ['local preview',false,'a'.repeat(32),false]
]) test(label,async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vivero-analytics-'));
  const {server}=createApp({dataDir:directory,production,analyticsToken,publicOrigin:'https://viverofresia.cl'});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const route of ['/','/index.html','/admin','/healthz']) {
    const response=await fetch(origin+route);
    assert.equal(response.status,200);
    const html=await response.text();
    const tracked=enabled && ['/', '/index.html'].includes(route);
    assert.equal((html.match(/static.cloudflareinsights.com\/beacon.min.js/g)||[]).length,tracked?1:0);
    assert.equal(response.headers.get('content-security-policy').includes('https://cloudflareinsights.com'),tracked);
    if(tracked) assert.ok(html.includes(`data-cf-beacon='${JSON.stringify({token:analyticsToken})}'`));
  }
});
test('reject malformed token before opening database',()=>{
  assert.throws(()=>createApp({analyticsToken:'invalid'}),/token público/);
});

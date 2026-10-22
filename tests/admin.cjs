const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createApp}=require('../server/app.cjs');
(async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vivero-admin-'));
  const app=createApp({dataDir:directory,initialPassword:'test-admin-password'});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL}: {})});
  try {
    for(const width of [390,1440]){
      const context=await browser.newContext({viewport:{width,height:900}}); const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/admin'); await page.locator('#login-panel').waitFor({state:'visible'});
      await page.locator('#password').fill('test-admin-password'); await page.getByRole('button',{name:'Ingresar',exact:true}).click(); await page.locator('#dashboard').waitFor({state:'visible'});
      assert.equal(await page.locator('.admin-product').count(),18);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.locator('#new-product').click(); await page.locator('#name').fill('Producto de prueba'); await page.locator('#category').fill('Flores'); await page.locator('#description').fill('Descripción comprobada'); await page.locator('#price').fill('3500');
      await page.locator('#photo').setInputFiles(path.join(__dirname,'../imagenes/1.jpg'));
      await page.locator('#photo-preview').waitFor({state:'visible'}); await page.getByRole('button',{name:'Guardar producto',exact:true}).click();
      await page.locator('#dashboard').waitFor({state:'visible'}); assert.equal(await page.locator('.admin-product').count(),19);
      const store=await page.context().newPage(); await store.goto(origin); const product=store.locator('.product').filter({hasText:'Producto de prueba'}); assert.equal(await product.count(),1); assert.match(await product.locator('.price-note').textContent(),/3[.]500/);
      await product.locator('[data-add]').click(); await store.locator('.cart-trigger').click(); assert.match(await store.locator('#cart-total').textContent(),/3[.]500/); await store.keyboard.press('Escape');
      await page.getByRole('button',{name:'Cambiar disponibilidad de Producto de prueba',exact:true}).click(); await page.getByText('Producto actualizado. Ya puedes verlo en la tienda.',{exact:true}).waitFor();
      await store.reload(); assert(await product.locator('[data-add]').isDisabled()); assert.equal(await store.locator('.cart-count').textContent(),'0');
      await page.getByRole('button',{name:'Ocultar Producto de prueba',exact:true}).click(); await page.getByRole('button',{name:'Mostrar Producto de prueba',exact:true}).waitFor(); await store.reload(); assert.equal(await product.count(),0);
      await page.getByRole('button',{name:'Editar Producto de prueba',exact:true}).click(); await page.locator('#name').fill('Producto editado'); await page.locator('#price').fill(''); await page.getByRole('button',{name:'Guardar producto',exact:true}).click(); await page.locator('#dashboard').waitFor({state:'visible'});
      if(process.env.SCREENSHOT_DIR){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`vivero-admin-${width}.png`),fullPage:true});}
      await page.getByRole('button',{name:'Eliminar Producto editado',exact:true}).click(); await page.locator('#cancel-delete').click(); assert.equal(await page.locator('.admin-product').count(),19);
      await page.getByRole('button',{name:'Eliminar Producto editado',exact:true}).click(); await page.locator('#confirm-delete').click(); await page.getByText('Producto eliminado.',{exact:true}).waitFor(); assert.equal(await page.locator('.admin-product').count(),18);
      await page.locator('#logout').click(); await page.locator('#login-panel').waitFor({state:'visible'}); await page.reload(); await page.locator('#login-panel').waitFor({state:'visible'}); assert.deepEqual(errors,[]);
      await store.close();await page.close(); console.log(`PASS admin ${width}px: login, image, create, price, cart, sold out, hide, edit, delete, logout`);
    }
  }finally{await browser.close();await new Promise(resolve=>app.server.close(resolve));if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'vivero-admin-'))fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, body) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const errors = [];
    for (const width of [320, 360, 390, 550, 650, 760, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('.product').count(), 18);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
      if (width <= 760) {
        const header = await page.locator('.header').boundingBox();
        const brand = await page.locator('.header .brand').boundingBox();
        const cart = await page.locator('.cart-trigger').boundingBox();
        assert(header.height <= 115, `compact header at ${width}`);
        assert(brand.x + brand.width <= cart.x, `brand and cart do not overlap at ${width}`);
        assert(Math.abs(brand.y - cart.y) < 12, `brand and cart share a row at ${width}`);
        const title = await page.locator('h1').boundingBox();
        const lineHeight = await page.locator('h1').evaluate(node => parseFloat(getComputedStyle(node).lineHeight));
        assert(title.height <= lineHeight * 3 + 2, `title stays within three lines at ${width}`);
      }
      for (const anchor of await page.locator('a[href^="#"]').evaluateAll(nodes => nodes.map(node => node.hash))) assert.equal(await page.locator(anchor).count(), 1);
      for (const href of await page.locator('a[href^="https://wa.me/"]').evaluateAll(nodes => nodes.map(node => node.href))) {
        const url = new URL(href);
        assert.equal(url.pathname, '/56945973179');
        assert(url.searchParams.get('text'));
      }
      await page.keyboard.press('Tab');
      assert(await page.locator('.skip').evaluate(node => node === document.activeElement));
      await page.keyboard.press('Enter');
      const photo = page.locator('.photo').first();
      await photo.focus();
      await page.keyboard.press('Enter');
      assert(await page.locator('#photo-dialog').evaluate(node => node.open));
      await page.keyboard.press('Escape');
      assert(await photo.evaluate(node => node === document.activeElement));
      await photo.click();
      await page.locator('#photo-dialog .close').click();
      assert.equal(await page.locator('#photo-dialog').evaluate(node => node.open), false);
      await page.locator('#search').fill('sabíla');
      assert.equal(await page.locator('.product:visible').count(), 1);
      await page.locator('[data-add="p13"]').click();
      await page.locator('#search').fill('no-existe');
      assert(await page.locator('.empty-results').isVisible());
      await page.locator('#search').fill('');
      await page.locator('[data-filter="Flores"]').click();
      assert.equal(await page.locator('.product:visible').count(), 6);
      await page.locator('[data-filter="Todos"]').click();
      await page.locator('[data-add="p1"]').click();
      await page.locator('[data-add="p1"]').click();
      await page.reload();
      assert.equal(await page.locator('.cart-count').textContent(), '3');
      await page.locator('.cart-trigger').click();
      const checkout = new URL(await page.locator('#checkout').getAttribute('href'));
      assert.equal(checkout.pathname, '/56945973179');
      assert(checkout.searchParams.get('text').includes('2 × Lilium longiflorum'));
      assert(checkout.searchParams.get('text').includes('1 × Sábila'));
      if (process.env.SCREENSHOT_DIR && width === 390) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'vivero-carrito.png') });
      await page.getByRole('button', { name: 'Aumentar cantidad de Sábila' }).click();
      assert.equal(await page.locator('.cart-count').textContent(), '4');
      await page.getByRole('button', { name: 'Disminuir cantidad de Sábila' }).click();
      await page.getByRole('button', { name: 'Quitar Sábila del carrito' }).click();
      await page.getByRole('button', { name: 'Quitar Lilium longiflorum del carrito' }).click();
      assert(await page.locator('#cart-empty').isVisible());
      assert.equal(await page.locator('#checkout').getAttribute('href'), null);
      await page.keyboard.press('Escape');
      assert(await page.locator('.cart-trigger').evaluate(node => node === document.activeElement));
      await page.locator('img[loading="lazy"]').evaluateAll(nodes => nodes.forEach(node => node.loading = 'eager'));
      await page.waitForFunction(() => [...document.querySelectorAll('img:not(.expanded)')].every(img => img.complete && img.naturalWidth > 0));
      if (process.env.SCREENSHOT_DIR && [390, 1440].includes(width)) {
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.locator('img[loading="lazy"]').evaluateAll(nodes => nodes.forEach(node => node.loading = 'eager'));
        await page.waitForFunction(() => [...document.querySelectorAll('img:not(.expanded)')].every(img => img.complete && img.naturalWidth > 0));
        for (const image of await page.locator('img:not(.expanded)').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(node => node.decode());
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `vivero-${width}.png`), fullPage: true });
      }
      await page.close();
      console.log(`PASS ${width}px: layout, search, categories, persistent cart, quantities, WhatsApp, keyboard dialogs`);
    }
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.locator('.product a').count(), 18);
    const recovery = await browser.newPage();
    await recovery.goto(`http://127.0.0.1:${server.address().port}/`);
    await recovery.evaluate(() => localStorage.setItem('vivero-fresia-cart-v1', '{invalid'));
    await recovery.reload();
    assert.equal(await recovery.locator('.cart-count').textContent(), '0');
    await recovery.evaluate(() => localStorage.setItem('vivero-fresia-cart-v1', JSON.stringify({ p1: -1, p2: 100, p3: '2', unknown: 1, p4: 2 })));
    await recovery.reload();
    assert.equal(await recovery.locator('.cart-count').textContent(), '2');
    const blocked = await browser.newPage();
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }));
    await blocked.goto(`http://127.0.0.1:${server.address().port}/`);
    await blocked.locator('[data-add="p1"]').click();
    assert.equal(await blocked.locator('.cart-count').textContent(), '1');
    assert.deepEqual(errors, []);
    console.log('PASS: catalog/contact available without JavaScript; no browser/resource errors');
    console.log('PASS: corrupted or invalid cart data and blocked storage');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

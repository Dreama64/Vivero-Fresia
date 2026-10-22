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
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('.product').count(), 18);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
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
      assert(await page.locator('dialog').evaluate(node => node.open));
      await page.keyboard.press('Escape');
      assert(await photo.evaluate(node => node === document.activeElement));
      await photo.click();
      await page.getByRole('button', { name: 'Cerrar' }).click();
      assert.equal(await page.locator('dialog').evaluate(node => node.open), false);
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
      console.log(`PASS ${width}px: navigation, catalog, images, WhatsApp, keyboard dialog`);
    }
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.locator('.product a').count(), 18);
    assert.deepEqual(errors, []);
    console.log('PASS: catalog/contact available without JavaScript; no browser/resource errors');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('requestfailed', req => errors.push('REQFAIL: ' + req.url() + ' ' + req.failure()?.errorText));
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  console.log('TITLE', await page.title());
  console.log('URL', page.url());
  console.log('BODY', (await page.locator('body').innerText()).slice(0, 500));
  console.log('has canvas', await page.locator('#dsPreviewCanvas').count());
  console.log('app', await page.evaluate(() => typeof window.DualStudio + ' ' + (window.DualStudio && !!window.DualStudio.project)));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await page.screenshot({ path: 'screen.png', fullPage: true });
  await browser.close();
})();

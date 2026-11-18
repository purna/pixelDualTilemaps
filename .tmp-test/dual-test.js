const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const app = window.DualStudio;
    const canvas = document.getElementById('dsPreviewCanvas');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let nonBg = 0;
    for (let i=0;i<data.length;i+=4) { if (data[i+3]>0 && !(data[i]===201&&data[i+1]===154&&data[i+2]===99)) nonBg++; }
    return {
      title: document.title,
      project: app.project && app.project.name,
      grids: app.project && app.project.grids.map(g=>({name:g.name, role:g.role, mode:g.mode, visible:g.visible, cells:Array.from(g.cells).filter(Boolean).length})),
      active: app.project && app.project.activeGridId,
      selectedMask: app.selectedMask,
      atlasCells: document.querySelectorAll('.ds-atlas-cell').length,
      atlasActive: document.querySelector('.ds-atlas-cell.active')?.dataset.mask,
      previewW: canvas.width, previewH: canvas.height,
      nonBgPixels: nonBg,
      editorW: document.getElementById('dsEditorCanvas').width,
      editorH: document.getElementById('dsEditorCanvas').height,
      footer: document.getElementById('dsFooterStatus').textContent,
      layerRows: document.querySelectorAll('.ds-layer').length,
      gridRows: document.querySelectorAll('.ds-grid-item').length
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await page.screenshot({ path: '.tmp-test/dual-screen.png', fullPage: true });
  await browser.close();
})();

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const FPS = 30, DUR = 19.5;
const mode = process.argv[2] || 'all'; // 'all' | 'preview'
const outDir = path.join(__dirname, mode === 'preview' ? 'preview' : 'frames');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-lcd-text', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(__dirname, 'anim.html'));
  const r = await page.evaluate(() => window.ready);
  if (r !== 'ok') throw new Error('font load failed');

  if (mode === 'preview') {
    const ts = [0.9, 1.7, 3.0, 5.5, 8.3, 10.0, 13.0, 13.78, 14.6, 15.5, 17.8];
    for (const t of ts) {
      const dataUrl = await page.evaluate(t => window.seekTo(t, 0.92), t);
      fs.writeFileSync(path.join(outDir, `p_${t.toFixed(2)}.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    console.log('preview done');
  } else {
    const N = Math.round(DUR * FPS);
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const t = i / FPS;
      const dataUrl = await page.evaluate(t => window.seekTo(t, 0.93), t);
      fs.writeFileSync(path.join(outDir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'));
      if (i % 60 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    console.log(`all ${N} frames done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

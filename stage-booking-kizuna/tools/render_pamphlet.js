// 当日パンフレットの HTML を PDF と確認用画像に書き出す
//   node stage-booking-kizuna/tools/render_pamphlet.js
const { chromium } = require('playwright');
const path = require('path');
const dir = path.join(__dirname, '..', 'pamphlet');
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {};
  const browser = await chromium.launch(proxy);
  const page = await browser.newPage({ viewport: { width: 1700, height: 1250 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(dir, 'pamphlet.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const bad = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src));
  if (bad.length) console.warn('読み込めない画像:', bad);
  await page.pdf({ path: path.join(dir, 'pamphlet-print-A3.pdf'), width: '420mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'print' });
  const sheets = await page.$$('.sheet');
  const names = ['preview-outer-p4-p1.png', 'preview-inner-p3-p2.png'];
  for (let i = 0; i < sheets.length; i++) await sheets[i].screenshot({ path: path.join(dir, names[i]) });
  console.log('wrote pamphlet-print-A3.pdf and previews');
  await browser.close();
})();

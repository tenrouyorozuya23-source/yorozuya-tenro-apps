// Kagebi MV renderer driver.
// Drives renderer/render.html frame by frame in headless Chromium and pipes
// JPEG frames into ffmpeg to mux with the original audio.
//
// Usage:
//   node pipeline/render.mjs                 # full render -> output/kagebi-mv.mp4
//   node pipeline/render.mjs --preview 8,42,90,145,200   # dump PNG stills at given seconds
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FEATURES = JSON.parse(readFileSync(`${ROOT}/data/features.json`, 'utf8'));
const LYRICS = JSON.parse(readFileSync(`${ROOT}/data/lyrics.json`, 'utf8'));
const AUDIO = `${ROOT}/audio/Kagebi_Electronic_Band_Mix.mp3`;
const OUT = `${ROOT}/output/kagebi-mv.mp4`;

const previewArg = process.argv.indexOf('--preview');
const previewTimes = previewArg > -1 ? process.argv[previewArg + 1].split(',').map(Number) : null;

const browser = await chromium.launch({
  args: ['--allow-file-access-from-files', '--disable-lcd-text', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${ROOT}/renderer/render.html`);
await page.evaluate(() => window.fontsReady);
const info = await page.evaluate(
  ([f, l]) => window.initMV(f, l), [FEATURES, LYRICS]);
console.log(`frames=${info.frames} fps=${info.fps}`);

if (previewTimes) {
  mkdirSync(`${ROOT}/output/preview`, { recursive: true });
  // simulate sequentially up to each preview point so particle state is realistic
  let cur = 0;
  for (const sec of previewTimes.sort((a, b) => a - b)) {
    const target = Math.round(sec * info.fps);
    cur = Math.max(cur, target - 150);   // ~6 s particle warm-up per still
    await page.evaluate(([s, n]) => { for (let k = s; k <= s + n; k++) window.renderFrame(k, true); },
      [cur, target - cur]);
    cur = target + 1;
    const png = await page.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
    writeFileSync(`${ROOT}/output/preview/t${sec}.png`, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`preview t=${sec}s written`);
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(info.fps), '-i', '-',
  '-i', AUDIO,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart',
  OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
const BATCH = 24;
for (let i = 0; i < info.frames; i += BATCH) {
  const n = Math.min(BATCH, info.frames - i);
  const urls = await page.evaluate(([s, c]) => window.renderBatch(s, c), [i, n]);
  for (const u of urls) {
    const buf = Buffer.from(u.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  if (i % 480 === 0 && i > 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`frame ${i}/${info.frames}  (${(i / el).toFixed(1)} fps render, eta ${((info.frames - i) / (i / el) / 60).toFixed(1)} min)`);
  }
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
await browser.close();
console.log(`DONE -> ${OUT}`);

// Takes the entry's 3-4 screenshots from real renders of app/ in
// chrome-headless-shell via Puppeteer, served by a local static server.
// Run from the repository root: node tools/take-screenshots.mjs
// Writes screenshots/1-checklist.jpg, 2-guide.jpg, 3-roadmap.jpg, 4-spoiler.jpg
// (1280x800 JPEGs). Exits non-zero if the page reports any error.
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('/home/hatch/workspace/makefun/shots-tool/node_modules/puppeteer');

const CHROME = '/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_DIR = join(ROOT, 'app');
const OUT_DIR = join(ROOT, 'screenshots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const data = await readFile(join(APP_DIR, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

await page.goto(base + '/index.html', { waitUntil: 'networkidle0' });
await page.waitForSelector('.card');

// 1. Checklist with progress: tick a story, activity and collectible trophy each.
await page.evaluate(() => {
  for (const id of [2, 3, 8, 15, 30, 35]) {
    document.querySelector(`.card[data-id="${id}"] input[type="checkbox"]`).click();
  }
  window.scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: join(OUT_DIR, '1-checklist.jpg'), type: 'jpeg', quality: 80 });

// 2. One trophy's guide open with its sources visible beside the checklist.
await page.evaluate(() => {
  document.querySelector('.card[data-id="17"] button').click();
});
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: join(OUT_DIR, '2-guide.jpg'), type: 'jpeg', quality: 80 });

// 3. Roadmap to the platinum, stages in order with missable flags.
await page.evaluate(() => document.getElementById('tab-roadmap').click());
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: join(OUT_DIR, '3-roadmap.jpg'), type: 'jpeg', quality: 80 });

// 4. Spoiler setting on + missable filter: story trophies hidden until earned.
await page.evaluate(() => {
  document.getElementById('tab-checklist').click();
  document.getElementById('spoiler').click();
  document.getElementById('missable-only').click();
  window.scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: join(OUT_DIR, '4-spoiler.jpg'), type: 'jpeg', quality: 80 });

await browser.close();
server.close();
if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('4 screenshots written to screenshots/');

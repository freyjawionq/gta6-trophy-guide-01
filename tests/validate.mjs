// Evidence checks for the GTA VI trophy guide draft. Run from the repo root:
//   node tests/validate.mjs
// Exits non-zero on any failure. It checks:
//  1. trophies.json: exactly 55 items, every official name/description/grade/id
//     identical to the kit starter's, every guide non-blank, kind/missable/stage
//     well-formed, sources present.
//  2. app/*.js parses (node --check).
//  3. main.ts runs twice into two temp dirs (MAKEFUN_OUTPUT_DIR) and writes
//     identical bytes: app/ + screenshots/ copied, dossier.json parses.
//  4. screenshots/: 3-4 files, each <= 256 KiB, long side <= 1280 px,
//     short side >= 480 px.
//  5. vendor/makefun-frontend.ts is byte-identical to the kit copy (sha256).
//  6. app/ stays inside the gate caps (<= 993 entries, <= 48 MiB) and loads
//     nothing over the network (no http/https URL in app source).
//  7. git diff --check is clean.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KIT = '/home/hatch/workspace/makefun/kits-new/gta6-trophy-guide-01/gta6-trophy-guide-01-kit';
let failures = 0;
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

// 1. Trophy data against the kit starter.
const mine = JSON.parse(readFileSync(join(ROOT, 'app/data/trophies.json'), 'utf8'));
const kit = JSON.parse(readFileSync(join(KIT, 'starter/app/data/trophies.json'), 'utf8'));
check(mine.trophies.length === 55, 'trophies.json holds 55 trophies', `got ${mine.trophies.length}`);
const kitByName = new Map(kit.trophies.map((t) => [t.name, t]));
let officialBad = 0;
for (const t of mine.trophies) {
  const k = kitByName.get(t.name);
  if (!k || t.description !== k.description || t.grade !== k.grade || t.id !== k.id) officialBad += 1;
  if (!t.guide || !t.guide.trim()) { officialBad += 1; console.log('  blank guide id', t.id); }
  if (!['story', 'collectibles', 'activities', 'online', 'other'].includes(t.kind)) { officialBad += 1; console.log('  bad kind id', t.id); }
  if (typeof t.missable !== 'boolean' || ![1, 2, 3, 4].includes(t.stage)) { officialBad += 1; console.log('  bad missable/stage id', t.id); }
  if (!Array.isArray(t.sources) || t.sources.length < 3) { officialBad += 1; console.log('  bad sources id', t.id); }
}
for (const k of kit.trophies) if (!mine.trophies.some((t) => t.name === k.name)) { officialBad += 1; console.log('  missing kit name', JSON.stringify(k.name)); }
check(officialBad === 0, 'official fields exact, guides/sources/kind/missable/stage well-formed');
const grades = mine.trophies.reduce((a, t) => { a[t.grade] = (a[t.grade] || 0) + 1; return a; }, {});
check(grades.platinum === 1 && grades.gold === 2 && grades.silver === 6 && grades.bronze === 46,
  'grade split 1 platinum / 2 gold / 6 silver / 46 bronze', JSON.stringify(grades));
check(mine.trophies.filter((t) => t.missable).length === 18, '18 trophies flagged missable',
  `got ${mine.trophies.filter((t) => t.missable).length}`);

// 2. JS parses.
for (const f of ['app/app.js']) {
  const r = spawnSync('node', ['--check', join(ROOT, f)], { encoding: 'utf8' });
  check(r.status === 0, `node --check ${f}`, r.stderr.trim());
}

// 3. main.ts runs twice, identical bytes.
function runMain(dir) {
  const r = spawnSync('node', ['main.ts'], { cwd: ROOT, env: { ...process.env, MAKEFUN_OUTPUT_DIR: dir }, encoding: 'utf8' });
  if (r.status !== 0) { console.log(r.stdout, r.stderr); return false; }
  return true;
}
const outA = mkdtempSync(join(tmpdir(), 'gta6-out-a-'));
const outB = mkdtempSync(join(tmpdir(), 'gta6-out-b-'));
const ranA = runMain(outA);
const ranB = runMain(outB);
check(ranA && ranB, 'main.ts runs with MAKEFUN_OUTPUT_DIR');
if (ranA && ranB) {
  const dossierA = readFileSync(join(outA, 'dossier.json'));
  const dossierB = readFileSync(join(outB, 'dossier.json'));
  check(dossierA.equals(dossierB), 'two main.ts runs write identical dossier.json bytes', `${dossierA.length} bytes`);
  let dossier;
  try { dossier = JSON.parse(dossierA.toString('utf8')); } catch { dossier = null; }
  check(!!dossier, 'dossier.json parses');
  check(existsSync(join(outA, 'app/index.html')) && existsSync(join(outA, 'app/data/trophies.json')),
    'output copies app/');
  check(existsSync(join(outA, 'screenshots')), 'output copies screenshots/');
  check(dossierA.length <= 1572864, 'dossier.json within 1.5 MiB', `${dossierA.length} bytes`);
}
rmSync(outA, { recursive: true, force: true });
rmSync(outB, { recursive: true, force: true });

// 4. Screenshots.
const shots = readdirSync(join(ROOT, 'screenshots')).filter((f) => !f.startsWith('.'));
check(shots.length >= 3 && shots.length <= 4, 'screenshots/ holds 3-4 images', `${shots.length}: ${shots.join(', ')}`);
function imageSize(file) {
  const buf = readFileSync(file);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length) {
      if (buf[off] !== 0xff) break;
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(off + 7), h: buf.readUInt16BE(off + 5) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  if (buf.readUInt32BE(12) === 0x49484452) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  return null;
}
for (const f of shots) {
  const p = join(ROOT, 'screenshots', f);
  const size = statSync(p).size;
  const dim = imageSize(p);
  const ok = size <= 262144 && dim && Math.max(dim.w, dim.h) <= 1280 && Math.min(dim.w, dim.h) >= 480;
  check(ok, `screenshot ${f} within limits`, `${size} bytes, ${dim ? dim.w + 'x' + dim.h : 'unreadable'}`);
}

// 5. Vendor file byte-identical to the kit.
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
check(sha(join(ROOT, 'vendor/makefun-frontend.ts')) === sha(join(KIT, 'starter/vendor/makefun-frontend.ts')),
  'vendor/makefun-frontend.ts byte-identical to kit', sha(join(ROOT, 'vendor/makefun-frontend.ts')).slice(0, 16) + '…');

// 6. app/ caps and no network references.
let entries = 0;
let bytes = 0;
const stack = [join(ROOT, 'app')];
while (stack.length) {
  const d = stack.pop();
  for (const e of readdirSync(d, { withFileTypes: true })) {
    entries += 1;
    const p = join(d, e.name);
    if (e.isDirectory()) stack.push(p);
    else bytes += statSync(p).size;
  }
}
check(entries <= 993 && bytes <= 50331648, 'app/ within gate caps', `${entries} entries, ${bytes} bytes`);
let netRefs = 0;
const appFiles = ['app/index.html', 'app/app.js', 'app/style.css', 'app/data/trophies.json'];
for (const f of appFiles) {
  const text = readFileSync(join(ROOT, f), 'utf8');
  if (/https?:\/\//.test(text)) { netRefs += 1; console.log('  network URL in', f); }
}
check(netRefs === 0, 'app source names no http/https URL');

// 7. git diff --check.
const diff = spawnSync('git', ['diff', '--check'], { cwd: ROOT, encoding: 'utf8' });
check(diff.status === 0, 'git diff --check clean', diff.stdout.trim() + diff.stderr.trim());

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

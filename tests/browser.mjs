// Checks things that only happen in a real browser: the Back button, animal players,
// saving and loading progress, and the light/dark switch. Run by GitHub Actions next to the
// accessibility check. Locally: npm install --no-save playwright && npx playwright install chromium && node tests/browser.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let f = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (f.endsWith('/')) f += 'index.html';
  const file = join(root, f);
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const tmp = mkdtempSync(join(tmpdir(), 'pp-'));
let failed = 0;
async function check(name, fn) {
  const ctx = await browser.newContext({ acceptDownloads: true, reducedMotion: 'reduce', viewport: { width: 400, height: 860 } });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try { await fn(page); assert.deepEqual(errors, [], 'the page threw an error'); console.log('✓', name); }
  catch (e) { failed++; console.log('✗', name, '\n ', e.message.split('\n').slice(0, 6).join('\n  ')); }
  await ctx.close();
}
const answerAll = async page => {
  const secs = page.locator('section').filter({ has: page.locator('.opts') });
  for (let i = 0; i < await secs.count(); i++) await secs.nth(i).locator('.opts .opt').first().click();
};
const store = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
const H = (n, m) => [...Array(n)].map((_, i) => ({ t: 1.79e12 + i * 1e7, m, l: 'normal', s: 8, n: 10 }));
const seed = (page, data) => page.evaluate(d => { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v) }, data);

await check('Back closes the score screen, then goes up to the puzzle choice, then leaves', async page => {
  await page.goto('data:text/html,<p>before</p>');
  await page.goto(base);
  await page.click('.tile[data-v="rotate"]');
  await answerAll(page);
  assert.equal(await page.isVisible('#celebrate'), true, 'score screen should be showing');
  await page.goBack(); await page.waitForTimeout(200);
  assert.equal(await page.isVisible('#celebrate'), false, 'Back should close the score screen');
  assert.ok(page.url().startsWith(base), 'Back should stay on the site');
  await page.goBack(); await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => scrollY) < 5, 'second Back should go up to the puzzle choice');
  await page.goBack().catch(() => {}); await page.waitForTimeout(300);
  assert.ok(page.url().startsWith('data:'), 'third Back should leave the site');
});

await check("animals: Puffin keeps the original progress; others get their own", async page => {
  await page.goto(base + 'privacy.html');
  const old = JSON.stringify(H(12, 'rotate'));
  await seed(page, { 'logic-puzzles-history-v1': old, 'pp-colour': 'green', 'pp-mode': 'cube', 'pp-level': 'normal' });
  await page.goto(base);
  await page.click('#who-change'); await page.click('.who-b[data-p="seal"]');
  assert.equal(await page.textContent('#who-name'), 'Seal');
  assert.equal(await page.getAttribute('html', 'data-color'), null, 'Seal starts with the default colour');
  await page.click('.sw[data-c="orange"]'); await page.click('.tile[data-v="mirror"]'); await answerAll(page); await page.keyboard.press('Escape');
  await page.reload();
  assert.equal(await page.textContent('#who-name'), 'Seal', 'the device remembers who is playing');
  assert.equal(await page.getAttribute('html', 'data-color'), 'orange');
  await page.click('#who-change'); await page.click('.who-b[data-p="puffin"]');
  const s = await store(page);
  assert.equal(s['logic-puzzles-history-v1'], old, "Puffin's saved progress must never change");
  assert.equal(JSON.parse(s['logic-puzzles-history-v1@seal']).length, 1);
  assert.equal(await page.getAttribute('html', 'data-color'), 'green');
  assert.equal(await page.getAttribute('#mode [aria-pressed="true"]', 'data-v'), 'cube');
});

await check('save a copy, clear the browser, load it back; bad files change nothing', async page => {
  await page.goto(base + 'privacy.html');
  await seed(page, { 'logic-puzzles-history-v1': JSON.stringify(H(12, 'rotate')), 'logic-puzzles-history-v1@fox': JSON.stringify(H(3, 'cube')), 'pp-colour@fox': 'orange' });
  await page.goto(base);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pb-save')]);
  const file = join(tmp, 'copy.json'); await dl.saveAs(file);
  assert.match(dl.suggestedFilename(), /^puzzle-puffin-progress-\d{4}-\d\d-\d\d\.json$/);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.setInputFiles('#pb-file', file); await page.waitForTimeout(200);
  let s = await store(page);
  assert.equal(JSON.parse(s['logic-puzzles-history-v1']).length, 12);
  assert.equal(JSON.parse(s['logic-puzzles-history-v1@fox']).length, 3);
  assert.equal(s['pp-colour@fox'], 'orange');
  // loading the same copy again adds nothing twice
  await page.setInputFiles('#pb-file', file); await page.waitForTimeout(200);
  assert.equal(JSON.parse((await store(page))['logic-puzzles-history-v1']).length, 12);
  // a file that isn't ours, and junk mixed into a real one
  const bad = join(tmp, 'bad.json'); writeFileSync(bad, '{"hello":1}');
  await page.setInputFiles('#pb-file', bad); await page.waitForTimeout(200);
  assert.match(await page.textContent('#pb-msg'), /nothing was changed/);
  const d = JSON.parse(readFileSync(file, 'utf8'));
  d.players.puffin.history.push({ t: 1, m: '"><img src=x onerror=alert(1)>', l: 'normal', s: 9, n: 10 }, { t: 2, m: 'rotate', l: 'normal', s: 'lots' }, { t: 3, m: 'mirror', l: 'hard', s: 10, n: 10 });
  d.players.dragon = { history: H(2, 'rotate') };
  const junk = join(tmp, 'junk.json'); writeFileSync(junk, JSON.stringify(d));
  await page.setInputFiles('#pb-file', junk); await page.waitForTimeout(200);
  s = await store(page);
  assert.equal(JSON.parse(s['logic-puzzles-history-v1']).length, 13, 'only the one well-formed new record is added');
  assert.ok(!Object.keys(s).some(k => k.includes('dragon')), 'unknown animals are ignored');
});

await check('light/dark switch: remembered, and choosing the device setting goes back to following it', async page => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(base);
  await page.click('#modebtn');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.reload();
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark', 'remembered after a reload');
  assert.equal(await page.getAttribute('#modebtn', 'aria-pressed'), 'true');
  await page.click('#modebtn');
  assert.equal(await page.getAttribute('html', 'data-theme'), null);
  assert.equal((await store(page))['pp-theme'], undefined);
});

await browser.close();
server.close();
if (failed) { console.log(`\n${failed} browser check(s) failed`); process.exit(1); }
console.log('\nAll browser checks passed.');

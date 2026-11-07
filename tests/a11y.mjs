// Accessibility check: runs axe-core in a real browser over the main screens,
// in all five colour themes, light and dark. Run by GitHub Actions (second job in test.yml).
// Locally: npm install --no-save playwright axe-core && npx playwright install chromium && node tests/a11y.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const axePath = process.env.AXE_STUB ? null : require.resolve('axe-core/axe.min.js');

// a tiny static server, so the page loads exactly as it does on the real site
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

const COLOURS = ['blue', 'green', 'orange', 'purple', 'yellow'];
const SCHEMES = ['light', 'dark'];
const browser = await chromium.launch();
const found = new Map(); // rule → {impact, help, where:Set}

async function check(page, where) {
  if (axePath) await page.addScriptTag({ path: axePath });
  else await page.evaluate(() => { window.axe = { run: async () => ({ violations: [] }) } });
  const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  for (const v of r.violations) {
    const e = found.get(v.id) || { impact: v.impact, help: v.help, where: new Set(), nodes: new Set() };
    e.where.add(where);
    for (const n of v.nodes.slice(0, 4)) e.nodes.add(n.target.join(' ') + (n.any[0]?.message ? ' (' + n.any[0].message.slice(0, 140) + ')' : ''));
    found.set(v.id, e);
  }
}
const answerAll = async page => {
  const secs = page.locator('section').filter({ has: page.locator('.opts') });
  const n = await secs.count();
  for (let i = 0; i < n; i++) await secs.nth(i).locator('.opts .opt').first().click();
};

for (const scheme of SCHEMES) for (const colour of COLOURS) {
  const ctx = await browser.newContext({ colorScheme: scheme, reducedMotion: 'reduce', bypassCSP: true, viewport: { width: 400, height: 860 } });
  await ctx.addInitScript(c => { try { localStorage.setItem('pp-colour', c) } catch (e) {} }, colour);
  const page = await ctx.newPage();
  const tag = `${colour}/${scheme}`;
  await page.goto(base);
  await check(page, `${tag}: start`);
  // a set with wrong answers: Why? boxes, tips, the score screen, then the page behind it
  await page.click('.tile[data-v="rotate"]');
  await answerAll(page);
  await page.waitForTimeout(300);
  await check(page, `${tag}: score screen`);
  await page.keyboard.press('Escape');
  await page.click('#who-change');
  await check(page, `${tag}: answers, progress and animal chooser`);
  if (colour === 'blue') {
    const sm = page.locator('[data-showme]').first();
    if (await sm.count()) { await sm.click(); await page.waitForTimeout(3500); await check(page, `${tag}: Show me`); await page.keyboard.press('Escape'); }
    await page.goto(base + 'privacy.html');
    await check(page, `${tag}: privacy page`);
  }
  await ctx.close();
}
await browser.close();
server.close();

if (!found.size) { console.log('Accessibility check: no problems found.'); process.exit(0); }
for (const [id, e] of found) {
  console.log(`\n✗ ${id} (${e.impact}): ${e.help}\n  seen in: ${[...e.where].slice(0, 6).join('; ')}${e.where.size > 6 ? ` and ${e.where.size - 6} more` : ''}`);
  for (const n of e.nodes) console.log('   - ' + n);
}
process.exit(1);

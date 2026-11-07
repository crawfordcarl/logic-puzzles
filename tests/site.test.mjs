// Checks the files that make the site work offline and installable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');

test('every file the offline helper saves exists (one missing file stops offline mode working)', () => {
  const sw = read('sw.js');
  const list = sw.slice(sw.indexOf('const FILES = ['), sw.indexOf('];', sw.indexOf('const FILES = [')));
  const files = [...list.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');
  assert.ok(files.length > 5, 'could not read the file list from sw.js');
  for (const f of files) assert.ok(existsSync(join(root, f)), `sw.js lists ${f}, which is missing`);
});

test('the page loads its fonts from the site itself, not from Google', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  for (const m of html.matchAll(/url\("(fonts\/[^"]+)"\)/g)) assert.ok(existsSync(join(root, m[1])), `${m[1]} is missing`);
});

test('the page registers the offline helper and links the app details', () => {
  const html = read('index.html');
  assert.match(html, /serviceWorker\.register\('sw\.js'\)/);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  // installing must stay optional: the browser's own install bar is suppressed
  assert.match(html, /addEventListener\('beforeinstallprompt',e=>e\.preventDefault\(\)\)/);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'Puzzle Puffin');
  for (const icon of manifest.icons) assert.ok(existsSync(join(root, icon.src)), `${icon.src} is missing`);
});

test('the privacy page exists, is linked from the footer and is saved for offline use', () => {
  assert.ok(existsSync(join(root, 'privacy.html')), 'privacy.html is missing');
  assert.match(read('index.html'), /href="privacy\.html"/, 'no link to the privacy page');
  assert.match(read('sw.js'), /'privacy\.html'/, 'privacy page not saved for offline use');
  assert.doesNotMatch(read('privacy.html'), /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

// Loads the puzzle code from index.html so the tests check exactly what the site runs.
// The page's script exposes its generators on globalThis.__T when there is no browser document.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// PUZZLE_PAGE lets you point the tests at another copy of the page, e.g. an older version.
const html = readFileSync(process.env.PUZZLE_PAGE || join(here, '..', 'index.html'), 'utf8');
const start = html.lastIndexOf('<script>');
const end = html.lastIndexOf('</script>');
if (start < 0 || end < start) throw new Error('Could not find the puzzle script in index.html');

// Indirect eval runs the script in global scope, the same way a browser would.
(0, eval)(html.slice(start + '<script>'.length, end));

export const T = globalThis.__T;
if (!T || !T.GEN) throw new Error('index.html did not expose its puzzle generators');

// The levels the page actually offers. Expert runs the Tricky generators with extra difficulty.
export const LEVELS = [
  { name: 'easy', lvl: 'easy', xp: false },
  { name: 'normal', lvl: 'normal', xp: false },
  { name: 'tricky', lvl: 'hard', xp: false },
  { name: 'expert', lvl: 'hard', xp: true },
];

// Make `n` puzzles of one type at one level. A generator may occasionally give up and
// return nothing (the page then retries), so those are skipped but counted.
export function make(type, level, n) {
  T.setXP(level.xp);
  const out = [];
  let missed = 0;
  for (let i = 0; i < n; i++) {
    const p = T.GEN[type](level.lvl);
    if (p) out.push(p); else missed++;
  }
  T.setXP(false);
  return { puzzles: out, missed };
}

export const expectedOptions = level => (level.lvl === 'easy' ? 4 : 5);

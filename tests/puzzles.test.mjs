// Checks that every generated puzzle is fair: exactly one answer is right, and no two
// answers look the same. Several tests below guard against specific bugs found in use.
// Run with:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T, LEVELS, make, expectedOptions } from './load.mjs';

const N = Number(process.env.PUZZLE_TEST_COUNT || 300);
const TYPES = Object.keys(T.GEN);
const mod = (x, n) => ((x % n) + n) % n;

// A comparable "what does this answer look like" key for each kind of option.
function optionKey(p, o) {
  if (typeof o === 'string') return o;
  if (o.holes2) return JSON.stringify(o.holes2.map(h => {
    // triangle holes also count which way they point
    const dir = h.tri ? Math.round(Math.atan2(h.tri[0][1] - h.c[1], h.tri[0][0] - h.c[0]) * 18 / Math.PI) : '';
    return [Math.round(h.c[0]), Math.round(h.c[1]), dir];
  }).sort());
  if (o.holes) return [...o.holes].sort((a, b) => a - b).join(',');
  if (o.cols3) return T.lookKey(o.cols3);
  if (o.grid) return T.gridKey(o.grid);
  if (o.plan) return T.canonTurn(o.plan);
  if (o.net) return T.cubeKey(T.netToCube(o));
  if (o.view) return JSON.stringify(o.view.map(f => [f.g, f.up]));
  return T.key(o);
}

// ---------- general rules for every puzzle type and level ----------

for (const type of TYPES) {
  for (const level of LEVELS) {
    // Warm-up and word ladders don't have an Expert-only variant worth separating, but run anyway.
    test(`${type} / ${level.name}: one marked answer, right number of choices, no look-alikes`, () => {
      const { puzzles, missed } = make(type, level, N);
      assert.ok(missed <= N * 0.05, `${missed} of ${N} attempts produced no puzzle`);
      for (const p of puzzles) {
        // Odd one out always shows five pictures: four that share a rule and the odd one.
        assert.equal(p.opts.length, type === 'odd' ? 5 : expectedOptions(level), 'wrong number of answer choices');
        assert.ok(p.ans >= 0 && p.ans < p.opts.length, 'no answer marked as correct');
        const keys = p.opts.map(o => optionKey(p, o));
        assert.equal(new Set(keys).size, keys.length, 'two answer choices are the same');
        if (typeof p.opts[0] === 'object' && !p.opts[0].holes && !p.opts[0].holes2 && !p.opts[0].cols3
            && !p.opts[0].grid && !p.opts[0].plan && !p.opts[0].net && !p.opts[0].view) {
          // picture answers: the drawings themselves must differ, not just the data behind them
          const drawn = p.opts.map(o => figSVG(o));
          assert.equal(new Set(drawn).size, drawn.length, 'two answer choices draw identically');
        }
      }
    });

    test(`${type} / ${level.name}: wrong answers get a readable explanation`, () => {
      const { puzzles } = make(type, level, Math.min(N, 100));
      for (const p of puzzles) {
        p.opts.forEach((o, k) => {
          if (k === p.ans) return;
          const why = T.explain(p, o);
          assert.ok(why && why.length > 10, `${type}: empty explanation`);
          assert.doesNotMatch(why, /undefined|NaN|null|\[object/, `${type}: broken explanation "${why}"`);
        });
      }
    });
  }
}

// ---------- Rotate: every wrong answer must be flipped or changed ----------
// Bug found 2026-11-07: about 1 in 8 Rotate questions had a "wrong" answer that was just the
// picture turned a different amount, which is also a correct answer.

test('rotate: the right answer is a plain turn and no wrong answer is', () => {
  for (const level of LEVELS) {
    const { puzzles } = make('rotate', level, N * 2);
    for (const p of puzzles) {
      const c = p.opts[p.ans];
      assert.ok(!c.m && !c.v, 'the marked answer is flipped or changed');
      assert.notEqual(mod(c.a, 360), 0, 'the marked answer is not turned at all');
      p.opts.forEach((o, k) => {
        if (k !== p.ans) assert.ok(o.m || o.v, `${level.name}: a wrong answer is just a turn (a second right answer)`);
      });
    }
  }
});

// ---------- Complete the pair: flips must work on the screen, not the picture ----------
// Bug found 2026-10-26: a "left-to-right flip" was applied relative to how the picture was already
// turned, so a sideways picture flipped top-to-bottom on screen.

test('pair: flips mirror the picture across the screen at every angle', () => {
  const M = p => { const t = p.a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), k = p.m ? -1 : 1; return [c * k, -s, s * k, c].map(v => Math.round(v) + 0); };
  const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]].map(v => v + 0);
  for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) for (const m of [false, true]) {
    const p = { a, m };
    assert.deepEqual(M(T.TR.flip.f(p)), mul([-1, 0, 0, 1], M(p)), `left-right flip wrong at ${a}°`);
    assert.deepEqual(M(T.TR.flipV.f(p)), mul([1, 0, 0, -1], M(p)), `top-bottom flip wrong at ${a}°`);
  }
});

// Bug found 2026-11-07: about 1 in 14 shape pairs could be read as two different rules (for
// example a triangle that turned looks the same as one that flipped) giving different answers.

test('pair: no other rule turns the first picture into the second but gives a different answer', () => {
  const names = Object.keys(T.TR);
  for (const level of LEVELS) {
    const { puzzles } = make('pair', level, N);
    for (const p of puzzles) {
      if (p.A.kind === 'mat') continue; // checked in the next test
      const options = new Set(p.opts.map(T.key)), fits = new Set();
      const tryRule = list => {
        let b = p.A, d = p.C;
        for (const t of list) { b = T.TR[t].f(b); d = T.TR[t].f(d); }
        if (T.valid(b) && T.valid(d) && T.key(b) === T.key(p.B) && options.has(T.key(d))) fits.add(T.key(d));
      };
      for (const a of names) { tryRule([a]); for (const b of names) { tryRule([a, b]); for (const c of names) tryRule([a, b, c]); } }
      assert.equal(fits.size, 1, `${level.name}: ${fits.size} answers fit some rule`);
      assert.ok(fits.has(T.key(p.opts[p.ans])), 'the marked answer does not fit the rule');
    }
  }
});

test('pair (moving shapes and patterns): every possible rule agrees on the answer', () => {
  const perms = n => { const out = []; for (let k = 0; k < n; k++) { out.push([...Array(n).keys()].map(j => (j + k) % n)); out.push([...Array(n).keys()].map(j => mod(k - j, n))); } return out; };
  for (const level of LEVELS.filter(l => l.lvl !== 'easy')) {
    T.setXP(level.xp);
    for (let i = 0; i < N; i++) {
      const p = T.matPair(level.lvl);
      if (!p) continue;
      const n = p.A.items.length, kB = T.matKey(p.B), opt = new Set(p.opts.map(T.matKey)), fits = new Set();
      const spins = p.A.lay === 'seg4' ? [0] : [0, 90, 180, 270];
      for (const P of perms(n)) for (const Q of perms(n)) for (const spin of spins) for (const inv of [false, true]) {
        const r = { P, Q, spin, inv };
        if (T.matKey(T.applyMat(p.A, r)) === kB) { const d = T.matKey(T.applyMat(p.C, r)); if (opt.has(d)) fits.add(d); }
      }
      assert.equal(fits.size, 1, `${level.name}: ${fits.size} answers fit some rule`);
      assert.ok(fits.has(T.matKey(p.opts[p.ans])));
    }
    T.setXP(false);
  }
});

// ---------- Fold & punch ----------
// Bug found 2026-11-07: when the right answer used every hole on the grid, the "one extra hole"
// wrong answer came out identical to it, so a correct choice was marked wrong.

test('fold & punch (grid): the answer matches an independent unfolding, and is never every hole', () => {
  const CC = c => 12.5 + 25 * c;
  const refl = (p, l) => { const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], t = ((p[0] - l.a[0]) * dx + (p[1] - l.a[1]) * dy) / (dx * dx + dy * dy); return [2 * (l.a[0] + t * dx) - p[0], 2 * (l.a[1] + t * dy) - p[1]]; };
  for (const level of LEVELS) {
    const { puzzles } = make('punch', level, N);
    for (const p of puzzles.filter(q => q.type === 'punch')) {
      let pts = p.punched.map(c => [CC(c % 4), CC(Math.floor(c / 4))]);
      for (let k = p.folds.length - 1; k >= 0; k--) pts = pts.concat(pts.map(q => refl(q, p.folds[k].line)));
      const truth = [...new Set(pts.map(([x, y]) => Math.round((y - 12.5) / 25) * 4 + Math.round((x - 12.5) / 25)))].sort((a, b) => a - b).join(',');
      const shown = p.opts.map(o => [...new Set(o.holes)].filter(c => c >= 0 && c < 16).sort((a, b) => a - b).join(','));
      assert.equal(shown.filter(s => s === truth).length, 1, `${level.name}: answers matching the unfolded paper`);
      assert.equal(shown[p.ans], truth, 'the marked answer is not the unfolded paper');
      assert.ok(shown[p.ans].split(',').length < 16, 'the answer uses every hole');
      p.opts.forEach(o => assert.ok(o.holes.every(Number.isInteger), 'an answer contains an invalid hole'));
    }
  }
});

test('fold & punch (any shape): the marked answer is every spot that lies under a punched hole', () => {
  for (const level of LEVELS.filter(l => l.lvl === 'hard')) {
    T.setXP(level.xp);
    for (let i = 0; i < N; i++) {
      const p = T.punch2Puzzle('hard');
      if (!p) continue;
      const fold = c => { let q = c; for (const f of p.folds) if (T.sideOf(f.line, q) * f.keep < 0) q = T.reflectPt(q, f.line); return q; };
      const truth = [];
      for (const k of p.punched) for (let m = 0; m < (1 << p.folds.length); m++) {
        let q = k.c;
        for (let j = p.folds.length - 1; j >= 0; j--) if (m >> j & 1) q = T.reflectPt(q, p.folds[j].line);
        if (!T.insideP(p.paper, q, 0)) continue;
        const f = fold(q);
        if (Math.hypot(f[0] - k.c[0], f[1] - k.c[1]) < 0.5 && !truth.some(t => Math.hypot(t[0] - q[0], t[1] - q[1]) < 0.5)) truth.push(q);
      }
      const ans = p.opts[p.ans].holes2.map(h => h.c);
      assert.equal(ans.length, truth.length, `${level.name}: wrong number of holes in the marked answer`);
      assert.ok(truth.every(t => ans.some(a => Math.hypot(a[0] - t[0], a[1] - t[1]) < 0.5)), 'a hole is in the wrong place');
      for (let a = 0; a < p.opts.length; a++) for (let b = a + 1; b < p.opts.length; b++)
        assert.ok(!T.holesSimilar(p.opts[a].holes2, p.opts[b].holes2), 'two answers look alike');
    }
    T.setXP(false);
  }
});

// ---------- 3D puzzles ----------

test('cube nets: folding each choice shows exactly one match', () => {
  for (const level of LEVELS) {
    const { puzzles } = make('cube', level, N);
    for (const p of puzzles) {
      p.opts.forEach((o, k) => {
        const fits = p.dir === 'toNet' ? T.showsView(T.netToCube(o), p.view) : T.showsView(T.netToCube(p.net), o.view);
        assert.equal(fits, k === p.ans, `${level.name}: choice ${k} ${fits ? 'also fits' : 'does not fit'}`);
      });
    }
  }
});

test('top view: exactly one choice is the model seen from above', () => {
  for (const level of LEVELS) {
    const { puzzles } = make('top', level, N);
    for (const p of puzzles) {
      const truth = T.canonTurn(p.cols.map(c => [c.x, c.y]));
      const fits = p.opts.map(o => T.canonTurn(o.plan) === truth);
      assert.equal(fits.filter(Boolean).length, 1, `${level.name}: choices matching the top view`);
      assert.ok(fits[p.ans]);
    }
  }
});

test('view from the right: exactly one choice is the right-hand view', () => {
  for (const level of LEVELS) {
    const { puzzles } = make('side', level, Math.min(N, 150));
    for (const p of puzzles) {
      if (p.view3d) {
        const truth = T.lookKey(T.turnRight(p.cols)), keys = p.opts.map(o => T.lookKey(o.cols3));
        assert.equal(keys.filter(k => k === truth).length, 1);
        assert.equal(keys[p.ans], truth);
      } else {
        const cubes = p.cols.flatMap(c => [...Array(c.h).keys()].map(z => { const q = [c.x, c.y, z]; q.dark = c.dark.includes(z); return q; }));
        const truth = T.gridKey(T.viewGrid(cubes, 'right')), keys = p.opts.map(o => T.gridKey(o.grid));
        assert.equal(keys.filter(k => k === truth).length, 1);
        assert.equal(keys[p.ans], truth);
      }
    }
  }
});

test('warm-up: the marked number is the right count', () => {
  for (const level of LEVELS) {
    const { puzzles } = make('count', level, N);
    for (const p of puzzles) {
      const all = p.prompt.startsWith('How many blocks are');
      const truth = all ? p.cols.reduce((a, c) => a + c.h, 0) : p.cols.length;
      assert.equal(Number(p.opts[p.ans]), truth);
    }
  }
});

// ---------- words and codes ----------

test('word ladders: exactly one choice is a chain of one-letter changes', () => {
  for (const level of LEVELS) {
    const { puzzles } = make('ladder', level, N);
    for (const p of puzzles) {
      const ok = p.opts.map(o => T.chainOK([p.start, ...o.split('\n'), p.end].map(w => w.toLowerCase())));
      assert.equal(ok.filter(Boolean).length, 1, `${level.name}: valid ladders among the choices`);
      assert.ok(ok[p.ans]);
    }
  }
});

test('codes: every letter of the answer can be worked out from the examples', () => {
  for (const level of LEVELS) {
    const { puzzles } = make('codes', level, N);
    for (const p of puzzles) {
      const answer = p.opts[p.ans];
      [...answer].forEach((ch, i) => {
        assert.ok(p.examples.some(e => e.code[i] === ch), `${level.name}: letter ${ch} in position ${i + 1} never appears in an example`);
      });
    }
  }
});

// ---------- puffin tips ----------

test('puffin tips: two readable tips on the hard puzzle types, and the cube tip names a truly opposite pair', () => {
  for (const type of ['cube', 'punch', 'top', 'side']) {
    for (const level of LEVELS) {
      const { puzzles } = make(type, level, 100);
      for (const p of puzzles) {
        const tips = T.tipsFor(p);
        assert.equal(tips.length, 2, `${type}: expected two tips`);
        tips.forEach(t => assert.doesNotMatch(t, /undefined|NaN|null|\[object/, `${type}: broken tip "${t}"`));
        assert.deepEqual(T.tipsFor(p), tips, 'a tip changed between redraws');
        if (p.type === 'cube' && p.dir === 'toCube') {
          const cube = T.netToCube(p.net), name = g => T.GLYPHW[g];
          const named = cube.filter(f => tips[1].includes(name(f.g)));
          assert.equal(named.length, 2, 'the tip should name two faces');
          assert.ok(named[0].n.every((x, i) => x === -named[1].n[i]), `${tips[1]} — those faces are not opposite`);
        }
      }
    }
  }
});

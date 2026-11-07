# Puzzle Puffin: notes for whoever works on this next

Puzzle Puffin (https://puzzlepuffin.com) is a single-page site of 11+ style picture and word puzzles for children aged about 5–11. It was made by a parent working with Claude. Children use it daily, so **never break saved progress and never ship an unfair puzzle.** Read this before changing anything.

## How it's built

- **`index.html` is the whole app**: HTML, CSS and JavaScript in one file, with no build step and no dependencies. Edit it directly.
- The puzzle code is the **last `<script>` in `index.html`**. Keep it last: `tests/load.mjs` reads that script to test it. When there's no browser `document`, the script exposes its generators on `globalThis.__T`; add new helpers there if the tests need them.
- Hosted on **GitHub Pages** from `main` at `/`, with the custom domain in `CNAME`. **Never delete `CNAME`** or the domain stops working. HTTPS is enforced.
- `sw.js` is the offline helper. **Change `CACHE` (e.g. `puzzle-puffin-v2`) whenever fonts, icons, the manifest or `sw.js` change**, or devices keep old copies. The page itself is fetched network-first, so changes to `index.html` alone don't need a bump.
- The fonts (Andika for body text, Baloo 2 for headings) are served from `fonts/` under the SIL OFL. **Don't switch back to Google Fonts**: it hurts privacy on a children's site and breaks offline use.
- An older copy lives as a claude.ai artifact. It's no longer the main site, and the repository is the source of truth.

## Saved progress: never rename these keys

Everything is in `localStorage`, per device, per address. Renaming a key silently wipes children's stickers and scores.

| Key | Holds |
|---|---|
| `logic-puzzles-history-v1` | Every finished set `{t, m, l, s, n}`: time, mode, level, score, number of questions. Stickers, the progress table, the parent summary and the level-up nudge are all **worked out from this**. |
| `pp-colour` | Chosen colour theme |
| `pp-mode` | Last puzzle type |
| `pp-level` | Last level |

If the history format ever has to change, read the old key and migrate it. Don't start a new one empty.

**`privacy.html` describes exactly what's stored and who's involved.** If you add anything to storage, any outside service or any link, update that page (and its "Last updated" date) in the same change.

## Tests: run before every commit

```
npm test
```

These are over 110 checks using only Node 18+, and GitHub Actions runs them on every push. They make hundreds of puzzles of every type at every level and check: exactly one right answer, no look-alike choices, readable explanations and tips, and offline files present. Each bug found so far has its own test (see the comments in `tests/puzzles.test.mjs`). **Add a test for any new puzzle type, and for any bug you fix.** Test "could another answer also be right?", not just "are the answers different?". Two real bugs got past the weaker check.

## Design rules agreed with the family

- **Puzzles stay black, white and grey.** Colour themes only touch the frame (tiles, buttons, highlights), because in puzzles colour can be a clue.
- **Respect `prefers-reduced-motion`** everywhere: confetti, balloons, shimmer, tile movement.
- **No random rewards.** Every sticker has a visible goal, nothing can be lost, and there are no streaks to break. It must never feel like gambling.
- **No sounds.** A deliberate choice, not an oversight.
- **No pop-ups or install prompts.** The browser's install bar is suppressed, and installing is only ever offered through the browser menu.
- **Keep the screen calm.** "Why?" appears only under wrong answers. Puffin tips appear only after a mistake in the set, give one question-specific nudge, and must never give the answer away (at least two choices must still fit the tip; tested). The celebration screen keeps the star as the main focus, with no puffin on it. Fold & punch, Rotate, Mirror, Top view, View from the right, Cube nets, Complete the pair and Fill the gap "Why?" boxes have a **Show me** link that animates the answer: unfolding from the puzzle's own folds (`unfoldSteps`), the picture turning the short way (`showTurn`), flipping over the mirror line (`MIRROR_AXIS`), the block model turning to the answer's viewpoint (`projectBlocks`, `blockTarget`), the net folding into a cube and turning to match (`foldNet`, `cubeTurn`, `cubeFaces`), the pair's rule applied one step at a time (`pairSteps`), or a highlight walking along the row before the gap fills (`seqFill` turns the neighbour into it when the only change is turning). Tests check each animation lands on the marked answer.
- **Text for 5–8 year olds:** Andika, large question text, short plain sentences, kind wording ("Good effort!", never "Wrong").
- **Keep clear of Puffin Books** (Penguin Random House's children's imprint): don't use "Puffin Books", "Puffin stories", "Puffin Club" or similar names, and keep our logo (a round colourful badge, puffin holding a puzzle piece) visibly different from theirs.
- **Never use the child's name on the site.** The footer credit stays "Made by a parent with Claude".
- New visitors start on **Warm-up at Easy**. The level-up nudge suggests the next level after three sets in a row of nearly all right. Nothing ever suggests going down.

## To do next (in rough order)

**Check it works everywhere** (so far only tested in Chrome-based browsers):
- iPhone and iPad (Safari): especially offline mode, printing, and the colour dots fitting.
- Amazon Fire tablets (Silk browser, built on Chrome): likely fine, but test offline mode and performance on a cheap Fire. **Amazon Kids profiles block websites that aren't approved**, so parents may need to add puzzlepuffin.com in the Amazon Parent Dashboard. A short "Using a Fire tablet?" note for parents might help.
- Older or slower tablets: some Expert puzzles take a moment to generate, so check it never feels slow.

**Accessibility:**
- Add an automatic check with axe-core (via Playwright) as a second GitHub Actions job. It catches missing labels, contrast and some keyboard problems in all five colour themes, light and dark.
- One manual pass: keyboard only, then a phone screen reader (VoiceOver, TalkBack).

**Privacy and compliance** (not legal advice; check the ICO's guidance):
- No cookies, analytics or tracking; settings and progress stay on the device; fonts are self-hosted. Keep it that way.
- ~~Privacy note~~ done: `privacy.html`, linked from the footer, prints cleanly and works offline.
- Settings and progress are stored only to provide features the user chose, which is usually treated as not needing consent under PECR. Confirm before adding anything else to storage.

**Security** (low risk, as the site is static with no logins and nothing sent anywhere):
- Add a Content-Security-Policy `<meta>` tag allowing only the site's own files.
- Set `permissions: contents: read` in `.github/workflows/test.yml`.
- Account safety matters most: two-step login on GitHub and the domain seller, and the domain transfer lock on.
- Anything a user types (e.g. names) must be escaped before it goes into `innerHTML`.

**Features:**
- **Several children on one device:** players picked by animal (Puffin, Seal, Fox…) rather than by name, chosen from the footer only. Each has its own history, stickers and settings. The existing `logic-puzzles-history-v1` data must become the first player, never lost.
- **Stories (a surprise extra, not a puzzle or a reward):** short original stories about our puffin and friends for 5–8 year olds (100–200 words, Andika, one simple picture each). **Always freely available, never unlocked or tied to scores**: the aim is for children to find them and choose to read on their own. On their own page behind a quiet link, so the puzzle screen stays calm. New stories can be added over time to be discovered. All characters original. Stories can touch on shapes and patterns, but never test the reader. **Naming:** don't call them "Puffin stories", a "Puffin library" or "Puffin books", which are too close to Puffin Books (Penguin Random House's children's imprint, whose first series was "Puffin Story Books"). Give our puffin a name and title them after it (e.g. "Pip's Tales").
- **Back up progress:** a "save my progress" file or code from the footer, so clearing the browser or changing tablets doesn't lose stickers.

## Ideas not done yet

- More "Show me" step-throughs: Codes (highlight the shapes that share a letter, then build the answer's code) and Word ladders (one letter changing at a time). Not worth it for Odd one out or Warm-up.
- Complete the pair with moving shapes (`kind:'mat'`) currently fades between steps; sliding each shape to its new place would be clearer.

- Accessibility pass: keyboard, screen readers, contrast in all five themes.
- Optional timed mode for older children (off by default, calm countdown).
- Optional one-line descriptions under the level buttons ("Easy · just starting").
- Two rare book puzzle types not covered: a shape turning and moving inside a box, and a grid's patterns mapped onto a triangle (both "Complete the pair" variants).

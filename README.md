# Puzzle Puffin

<img src="puffin.svg" alt="Puzzle Puffin logo" width="96">

Logic puzzles for preparing for the 11+, live at **https://puzzlepuffin.com**.

A single web page (`index.html`) that makes fresh sets of 10 non-verbal and verbal reasoning puzzles, in the style of 11+ practice books. Everything runs in the browser: there's no server, no sign-in and nothing to install.

Puzzle Puffin was made by a parent working with [Claude](https://claude.ai), an AI assistant made by Anthropic. The puzzle types, levels and design choices came from photos of real 11+ practice pages and lots of testing at home; Claude wrote the code and the checks.

## Puzzle types

| Puzzle | What it asks |
|---|---|
| Warm-up | How many blocks can you see from above, or how many altogether? |
| Rotate | Which answer is the picture turned round? |
| Mirror | Which answer is the mirror image? |
| Fill the gap | Which picture completes the pattern? |
| Complete the pair | The first picture changes into the second. Do the same to the third. |
| Odd one out | Which picture doesn't belong? |
| Codes | Each letter stands for a feature. Which code fits the last picture? |
| Fold & punch | Paper is folded and punched. What does it look like opened out? |
| Cube nets | Which net folds into this cube, or which cube comes from this net? |
| Top view | Which outline is the block model seen from above? |
| View from the right | What does the block model look like from the right-hand side? |
| Word ladders | Change one letter at a time to turn one word into another. |

Each type has four levels: Easy, Normal, Tricky and Expert. **Mix** gives one of each kind per set.

## Features

- Every set is generated fresh, with no repeated pictures or layouts within a set.
- Each puzzle is checked as it's made so it has exactly one correct answer.
- Wrong answers get a short "Why?" explanation.
- Rotate puzzles have a hint button that turns the picture (3 turns per question). After a mistake, the hardest puzzle types also offer a "Puffin tip" that nudges without giving the answer.
- A celebration screen at the end of each set, with confetti and poppable balloons for 10/10, and a suggestion to try the next level after three sets in a row of nearly all right.
- A sticker book with 21 stickers, each with a clear goal (nothing random).
- A progress table and a parent summary ("Strongest · Practise more"), saved in the browser on that device.
- Five colour themes, light and dark mode, and reduced motion respected throughout.
- Works offline after the first visit, and can be added to a home screen (never prompted).
- A printable worksheet with an answer key, from the link at the foot of the page.

## Updating

Replace `index.html` with the new version and commit. GitHub Pages republishes it automatically.

## Offline and home screen

After the first visit, the site keeps working with no internet connection, which is handy for car journeys and flights. On a phone or tablet it can also be added to the home screen (in the browser's menu, choose "Add to Home screen" or "Install") and opens like an app. Nothing is pushed on anyone: the page never asks to be installed, and it switches off the install bar some browsers show by themselves, so installing is only ever a choice in the browser menu.

- `sw.js` is the offline helper. It saves the page, fonts and icons on the device. The page is fetched fresh whenever there is a connection, so updates still arrive. **If you change the fonts, icons or `sw.js` itself, change `CACHE` at the top of `sw.js`** (for example `puzzle-puffin-v2`) so devices pick up the new copies.
- `manifest.webmanifest` and `icons/` give the app its name and puffin icon.
- `fonts/` holds the two fonts, Andika and Baloo 2, served from the site itself rather than from Google, for privacy and so they work offline. Both are free under the SIL Open Font License (licences included).

## Tests

`tests/puzzles.test.mjs` makes hundreds of puzzles of every type at every level and checks that each one is fair: exactly one answer is right, no two answers look the same, and every wrong answer gets a readable explanation. It also has a test for each bug found so far:

- **Rotate:** no wrong answer may be the picture simply turned a different amount, since that would also be correct.
- **Complete the pair:** flips go across the screen whatever angle the picture is at, and no other rule may turn the first picture into the second while giving a different answer.
- **Fold & punch:** the right answer is checked by unfolding the paper independently, and is never "every hole".
- **Cube nets, Top view, View from the right, Word ladders, Codes and Warm-up:** the marked answer is worked out a second way and must be the only one that fits.

Run them with Node.js 18 or later:

```
npm test
```

GitHub runs them automatically on every change (see the Actions tab). Set `PUZZLE_TEST_COUNT` to make more puzzles per check, or `PUZZLE_PAGE` to test another copy of the page.

# Puzzle Puffin

<img src="puffin.svg" alt="Puzzle Puffin logo" width="96">

Logic puzzles for preparing for the 11+, live at **https://puzzlepuffin.com**.

A single web page (`index.html`) that makes fresh sets of 10 non-verbal and verbal reasoning puzzles, in the style of 11+ practice books. Everything runs in the browser: there's no server, no sign-in and nothing to install.

Puzzle Puffin was designed and built with [Claude](https://claude.ai), an AI assistant made by Anthropic, from photos of real 11+ practice pages.

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
- Rotate puzzles have a hint button that turns the picture (3 turns per question).
- A progress table records scores, saved in the browser on that device.
- A celebration screen at the end of each set, with confetti and poppable balloons for 10/10.
- Works on phones, tablets and computers, in light and dark mode.

## Updating

Replace `index.html` with the new version and commit. GitHub Pages republishes it automatically.

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

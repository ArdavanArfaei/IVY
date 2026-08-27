# IVY — IVF + PGT Planner

A lightweight, client-side IVF/PGT outcome calculator. No backend required.

## Stack

- **Vite** (dev server + build)
- **Vanilla JS ES modules** — no framework
- `npm run dev` to start, `npm run build` to bundle

## Project layout

```
src/
  main.js          ← entry point; wires inputs → compute → render
  model.js         ← pure math only; no DOM
  ui/
    head.js        ← top-line % and stats
    funnel.js      ← egg-to-embryo waterfall
    compare.js     ← with/without PGT-A side-by-side
    timeline.js    ← Gantt-style week chart
  styles/
    tokens.css     ← CSS custom properties (source of truth for colours)
    base.css       ← reset, body, header, fonts
    components.css ← cards, inputs, toggles, notes
    results.css    ← result card, funnel, compare, timeline
```

## Design system — do not drift from these

### Colours (defined in `src/styles/tokens.css`)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#F7F6F1` | Page background |
| `--card` | `#FCFBF8` | Card background |
| `--ink` | `#37383A` | Primary text |
| `--ink-soft` | `#6E7073` | Secondary text |
| `--ink-faint` | `#A0A2A3` | Labels, hints, muted |
| `--line` | `#E5E3DB` | Borders, dividers |
| `--rose` / `--rose-deep` | `#E3B9B6` / `#C4877F` | Her track, age slider |
| `--sage` / `--sage-deep` | `#B5C8B2` / `#7F9C7E` | His track, default toggle on |
| `--peri` / `--peri-deep` | `#B6BEDF` / `#828EC6` | Lab & genetics, focus ring |
| `--butter` / `--butter-deep` | `#EADDA8` / `#BDA55F` | Pregnancy track, transferable bar |
| `--lilac` / `--lilac-deep` | `#D2BFDB` / `#9C82AC` | PGT-M toggle, unaffected bar |
| `--clay` / `--clay-deep` | `#E2C4AE` / `#B98F70` | Male factor toggle, milestone dots |

**Never introduce new named colours.** Tint or mix existing tokens at the usage site with opacity if needed (e.g. `rgba(var(--rose-rgb), 0.4)`).

### Typography

- **Body copy** — `"Instrument Sans"`, 15 px, 1.55 line-height
- **UI / numbers / headings** — `"Space Grotesk"` (already applied via `h1,h2,h3,.gro,.num,button,label,input,select`)
- Do not add new web fonts.

### Radii & spacing

- Card radius: `--r` (14 px)
- Lane label width: `--gut` (84 px)
- Keep the warm off-white surfaces (`--paper`, `--card`). Avoid pure white (`#fff`) for backgrounds.

## Adding new variables to the model

1. Add the new curve or constant to `src/model.js` — keep it a pure function, no side effects.
2. Add the corresponding input to `index.html` inside the correct `<div class="card">`.
3. Wire the new input in `src/main.js` → `readInputs()`.
4. Update whichever `ui/` module renders it, or add a new one.
5. Update `CLAUDE.md` if the data source or interpretation needs explanation.

## Tone / copy rules

- Numbers are always rounded conservatively (floor for good news, ceiling for bad).
- Explanatory copy in funnel notes uses plain language — no jargon without a one-line gloss.
- The disclaimer at the bottom of the page must stay on every build.

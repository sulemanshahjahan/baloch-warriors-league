# Design sources

Reference material for the UI — **not** shipped with the app. Kept out of
`public/` so nothing here is served or bundled into a deploy.

| File | What it is |
|------|-----------|
| `BWL Landing v2.html` | Self-extracting export of the v2 landing-page comp (markup + Nocturne design-system CSS + fonts, ~2.2 MB). Source of truth for the implementation in `src/components/public/home/`. |

## Landing v2 → code map

| Comp section | Implementation |
|---|---|
| Header + slide-in drawer | `src/components/public/home/site-header.tsx` |
| Hero / live strip / by-the-numbers | `src/components/public/home/sections/hero.tsx` |
| Champion + season honours | `src/components/public/home/sections/champion.tsx` |
| Player of the week | `src/components/public/home/sections/player-of-week.tsx` |
| Season leaders | `src/components/public/home/sections/leaders.tsx` |
| Results board + bracket rail | `src/components/public/home/sections/results.tsx` |
| Latest news | `src/components/public/home/sections/news.tsx` |
| Get-app band | `src/components/public/home/sections/get-app.tsx` |
| Footer | `src/components/public/home/site-footer.tsx` |
| Tokens, fonts, hover states, breakpoints | `src/components/public/home/landing.css` |
| Runtime behaviour (reveals, counters, tilt, sheen) | `src/components/public/home/landing-motion.tsx` |
| Data for every section | `src/components/public/home/data.ts` |

Fonts used by the comp (Inter, Saira Condensed — both SIL OFL) are self-hosted
in `public/fonts/`; the crest comes from the existing `public/logo.png`.

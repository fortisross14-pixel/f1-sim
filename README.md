# F1 Sim

A Formula 1 management simulator. Run a season as a virtual paddock: 12 teams, 22 races, qualifying, race, market, retirements, new cars. Mechanics-first, visuals minimal.

## Running it

```bash
npm install
npm run dev
```

Open the URL shown by Vite (default http://localhost:5173). The page guides you through phases: Season Start → Pre-Race → Qualifying → Race → next GP, then end-of-season → new cars → market → next season.

## Smoke tests

```bash
npx tsx scripts/smoke.ts        # one full season with verbose output
npx tsx scripts/multi-seed.ts   # 8 seasons aggregated for balance check
npx tsx scripts/eng-impact.ts   # shows engineering director Brawn-effect math
```

## How it's structured

- `src/sim/types.ts` — all type definitions and constants
- `src/sim/rng.ts` — seeded mulberry32 RNG with helpers
- `src/sim/data.ts` — team list, name pools, calendar of 22 (made-up) circuits
- `src/sim/generators.ts` — create drivers/teams/directors/cars; effective skill calc
- `src/sim/market.ts` — initial universe assignment (weighted random) AND end-of-season draft (worst-first); driving-squad cap of 6 enforced everywhere
- `src/sim/race.ts` — qualifying (Q1 → Q2) and race simulation (10 segments, incidents, fastest lap)
- `src/sim/season.ts` — orchestrates everything, year-over-year progression
- `src/GameContext.tsx` — React state container
- `src/App.tsx` — minimal UI for every phase

## Key design

**Driving squad cap of 6 points** across driver1 + driver2 + test driver. This is the rule that prevents super-teams. Legend (4) + Rare (2) + Common (0) = 6 ✓ but no Legend+Epic pairing.

**Engineering directors pull cars toward a target**, not flat bonus. A legend eng director on a 65-rated car becomes ~78 (Brawn effect); same legend on an 85-rated car only becomes ~87 (diminishing returns).

**Race directors amplify "almost there" teams.** Strongest boost around team rating ~78. Less effective on either bad teams (can't save) or elite teams (already maxed).

**Initial universe is biased random** (legends → top teams). The end-of-season draft is strict worst-first (so new rookie legends go to bottom teams, gradually balancing things over years).

## Deploy

Push to `https://github.com/fortisross14-pixel/f1-sim`. The `.github/workflows/deploy.yml` builds and publishes to GitHub Pages. Live URL: `https://fortisross14-pixel.github.io/f1-sim/`.

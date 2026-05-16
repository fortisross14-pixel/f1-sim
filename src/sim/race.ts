import {
  Driver, Team, GrandPrix, Weather, CircuitProfile, CarSpecialty,
  QualifyingResult, QualifyingTick, RaceResult, RaceLapSnapshot, RaceIncident,
  RACE_POINTS, FASTEST_LAP_BONUS, EngineeringDirector, RaceDirector, Rarity,
} from './types';
import { effectiveDriverSkills } from './generators';
import { RNG, clamp } from './rng';

// ============================================================================
// PERFORMANCE MODEL
// A driver's expected pace at a circuit blends:
//   - car stats weighted by circuit profile
//   - driver skills weighted by phase (quali vs race)
//   - archetype-specific modifiers
//   - weather modifiers
//   - random component (the "noise" that allows upsets)
//
// We compute a "rating" (higher = faster), then convert to a lap time.
// ============================================================================

interface Entrant {
  driver: Driver;
  team: Team;
}

interface RatingContext {
  gp: GrandPrix;
  entrants: Entrant[];
  engDirMap: Map<string, EngineeringDirector>;
  raceDirMap: Map<string, RaceDirector>;
}

// Weights for car stats given a circuit profile
function carWeights(profile: CircuitProfile): {
  maxSpeed: number; acceleration: number; turning: number;
} {
  switch (profile) {
    case 'linear':    return { maxSpeed: 0.55, acceleration: 0.25, turning: 0.20 };
    case 'mixed':     return { maxSpeed: 0.30, acceleration: 0.45, turning: 0.25 };
    case 'technical': return { maxSpeed: 0.15, acceleration: 0.25, turning: 0.60 };
    case 'balanced':  return { maxSpeed: 0.33, acceleration: 0.34, turning: 0.33 };
  }
}

// Weather modifier on a per-driver basis
function weatherDriverMod(d: Driver, weather: Weather): number {
  if (weather === 'hot') {
    // Cardio matters a lot; archetypes 'iceman' (great) and 'hothead' (suffer)
    let mod = (effectiveDriverSkills(d).physical - 75) * 0.15; // physical 90 => +2.25, physical 60 => -2.25
    if (d.archetype === 'iceman') mod += 3;
    if (d.archetype === 'hothead') mod -= 1.5;
    if (d.archetype === 'calculator') mod += 1.5; // good in changing/extreme conditions
    return mod;
  }
  if (weather === 'rain') {
    // Driving skill matters; archetype 'wet_specialist' is a big edge.
    // Scaled by rarity so a rare+ wet specialist can credibly podium even
    // on a mid-tier car when it rains. The intent: rare wet specialists
    // become "rain weapons" the way Senna was at Donington.
    let mod = (effectiveDriverSkills(d).driving - 75) * 0.20;
    if (d.archetype === 'wet_specialist') {
      mod += wetSpecialistBonus(d.rarity);
    }
    if (d.archetype === 'aggressive' || d.archetype === 'hothead') mod -= 1.5;
    if (d.archetype === 'conservative') mod += 1;
    if (d.archetype === 'calculator') mod += 2; // smart line choices in wet
    return mod;
  }
  // Dry/normal: calculator is slightly weaker in pure-pace conditions
  if (d.archetype === 'calculator') return -0.8;
  return 0;
}

// Rarity-scaled wet specialist bonus. Common/uncommon get the legacy +5;
// rare+ scale up so they reliably challenge for podiums in the rain.
function wetSpecialistBonus(rarity: Rarity): number {
  switch (rarity) {
    case 'legend':   return 15;
    case 'epic':     return 12;
    case 'rare':     return 9;
    case 'uncommon': return 5;
    case 'common':   return 5;
  }
}

// Archetype-specific phase modifier (quali vs race). Qualifier bonus in Q
// is rarity-scaled so a rare+ qualifier can mix it with top cars in qualifying.
function archetypePhaseMod(d: Driver, phase: 'quali' | 'race'): number {
  if (phase === 'quali') {
    if (d.archetype === 'qualifier') return qualifierBonus(d.rarity);
    if (d.archetype === 'racer') return -2;
  } else {
    if (d.archetype === 'racer') return 3;
    // Qualifier identity is qualifying-only — slight race penalty as before.
    if (d.archetype === 'qualifier') return -2;
  }
  return 0;
}

// Rarity-scaled qualifying bonus. Common/uncommon stay at +3; rare+ scale up
// modestly so a rare/epic qualifier mixes it with the front in Q without
// outright dominating. Tuned down from an earlier version where +9 legend
// bonus single-handedly overcame both car gap and driver-skill gap, making
// a legend qualifier win every Q regardless of teammates' cars.
function qualifierBonus(rarity: Rarity): number {
  switch (rarity) {
    case 'legend':   return 6;
    case 'epic':     return 5;
    case 'rare':     return 4;
    case 'uncommon': return 3;
    case 'common':   return 3;
  }
}

// Compute a driver's raw "rating" for the GP. Higher = faster.
function performanceRating(
  e: Entrant,
  ctx: RatingContext,
  phase: 'quali' | 'race',
  rng: RNG
): number {
  const weights = carWeights(ctx.gp.circuit.profile);
  const car = e.team.car;
  const skills = effectiveDriverSkills(e.driver);

  // Car contribution: weighted by circuit profile
  const carScore =
    weights.maxSpeed     * car.maxSpeed +
    weights.acceleration * car.acceleration +
    weights.turning      * car.turning;

  // Driver contribution: phase-dependent weights
  let driverScore: number;
  if (phase === 'quali') {
    driverScore = 0.45 * skills.speed + 0.30 * skills.driving + 0.25 * skills.carSetup;
  } else {
    driverScore = 0.40 * skills.driving + 0.25 * skills.speed + 0.20 * skills.carSetup + 0.15 * skills.physical;
  }

  // Race director: amplifies a team that's already "almost there".
  // The director multiplies the base rating boost by a "sweet spot" factor:
  // strongest effect when the team has a decent car + decent driver (rating ~75-85).
  // Diminishing returns at both ends — can't save bad teams, can't push elites higher.
  let raceDirBonus = 0;
  if (phase === 'race' && e.team.raceDirectorId) {
    const rd = ctx.raceDirMap.get(e.team.raceDirectorId);
    if (rd) {
      // Base impact scaled up significantly from before — legend now ~6 rating points,
      // common ~1 rating point. Enough to swing a podium.
      const baseImpact = rd.timeImprovementPct * 3.5; // legend 2.0% -> 7.0, common 0.4% -> 1.4
      // Combined team strength (car + driver scores roughly 60-100 range each, so combined ~120-200)
      const teamStrength = 0.55 * carScore + 0.45 * driverScore;
      // Sweet spot is around 75-82 (a mid-pack contender that just needs a push).
      // Diminishing factor: 1.0 at the sweet spot, lower at extremes.
      const sweetSpot = 78;
      const distance = Math.abs(teamStrength - sweetSpot);
      // Factor: 1.0 at sweetSpot, dropping to ~0.3 at distance 15
      const factor = Math.max(0.3, 1.0 - (distance / 20));
      raceDirBonus = baseImpact * factor;
    }
  }

  // Weather + archetype
  const weatherMod = weatherDriverMod(e.driver, ctx.gp.weather);
  const phaseMod = archetypePhaseMod(e.driver, phase);

  // Car circuit specialty bonus. A matching specialty gives the car a real
  // edge (~6 rating points ≈ 0.5s/lap × 50 laps = 25s race-pace bonus).
  // An all-rounder car gets a smaller bonus on every circuit. Mismatch = 0,
  // no penalty.
  const specialtyMod = carSpecialtyBonus(car.circuitSpecialty, ctx.gp.circuit.profile);

  // Combine. Car/driver each ~60-100 range; we want resulting rating roughly 60-110.
  // Use a 55/45 split for car vs driver overall.
  const base = 0.55 * carScore + 0.45 * driverScore;

  // Random noise: rain has heaviest variance, race phase noisier than quali to create
  // genuine upsets (a top car + top driver shouldn't win 75% of races).
  let noiseStd: number;
  if (phase === 'quali') {
    // Quali noise: previous values (2.0 normal) had one driver winning
    // 70-90% of poles across a season — way more deterministic than real F1
    // where a top driver gets ~40% of poles. Bumped substantially so the
    // best driver-car combo still leads the pole count but doesn't sweep.
    noiseStd =
      ctx.gp.weather === 'rain' ? 7.0 :
      ctx.gp.weather === 'hot'  ? 5.0 :
      4.5;
  } else {
    // Race: meaningfully higher noise — pit stops, strategy, tire wear, traffic.
    // This is what gives lower-rated entries a chance and prevents the "same
    // driver wins 8 years in a row with 15+ wins" dynasty pattern. Tuned up
    // so the best driver-car combo still wins the title most years, but the
    // outcome of any individual race is less deterministic.
    noiseStd =
      ctx.gp.weather === 'rain' ? 8.0 :
      ctx.gp.weather === 'hot'  ? 6.0 :
      5.3;
  }
  const noise = rng.normal(0, noiseStd);

  return base + raceDirBonus + weatherMod + phaseMod + specialtyMod + noise;
}

// Car specialty → circuit profile bonus. Matching specialty gives the car
// ~0.5s/lap. All-rounder gets a quarter of that bonus on every circuit so
// it's never disadvantaged but never optimal either. Mismatch = 0.
function carSpecialtyBonus(carSpec: CarSpecialty, profile: CircuitProfile): number {
  const MATCH = 6;       // ~0.48s/lap × 50 laps = 24s — enough to matter, not enough to dominate
  const ALL_ROUNDER = 1.5; // ~0.12s/lap × 50 laps = 6s — small but always-on edge
  if (carSpec === 'all_rounder') return ALL_ROUNDER;
  if (carSpec === profile) return MATCH;
  return 0;
}

// Convert a rating to a lap time in seconds.
// Base lap time 80s, each rating point ≈ -0.08s.
function ratingToLapTime(rating: number, rng: RNG): number {
  const base = 80;
  const time = base - (rating - 70) * 0.08;
  // Small additional jitter for displayed times
  return parseFloat((time + rng.range(-0.05, 0.05)).toFixed(3));
}

// ============================================================================
// QUALIFYING
// Q1: all 24 drivers; top 10 advance, 11-24 are ranked here.
// Q2: top 10 only; ranked 1-10. Pole = position 1.
// ============================================================================

export function simulateQualifying(
  gp: GrandPrix,
  teams: Team[],
  drivers: Driver[],
  engDirectors: EngineeringDirector[],
  raceDirectors: RaceDirector[],
  rng: RNG
): QualifyingResult {
  // Build entrant list: 2 active drivers per team (or test driver if injured)
  const entrants = buildEntrants(teams, drivers);
  const ctx: RatingContext = {
    gp,
    entrants,
    engDirMap: new Map(engDirectors.map(e => [e.id, e])),
    raceDirMap: new Map(raceDirectors.map(r => [r.id, r])),
  };

  // Q1
  const q1Results = entrants.map(e => {
    const rating = performanceRating(e, ctx, 'quali', rng);
    return { driverId: e.driver.id, time: ratingToLapTime(rating, rng), rating };
  });
  q1Results.sort((a, b) => a.time - b.time);

  const top10Ids = q1Results.slice(0, 10).map(r => r.driverId);
  const bottom14 = q1Results.slice(10); // positions 11-24

  // Q2: re-run for top 10 only with slightly less noise (everyone pushes harder)
  const top10Entrants = entrants.filter(e => top10Ids.includes(e.driver.id));
  const q2Results = top10Entrants.map(e => {
    const rating = performanceRating(e, ctx, 'quali', rng);
    // Tiny improvement bonus to simulate "push lap"
    return { driverId: e.driver.id, time: ratingToLapTime(rating + 1.5, rng), rating };
  });
  q2Results.sort((a, b) => a.time - b.time);

  // Final ranking: Q2 order (1-10) then Q1 order (11-24)
  const ranking = [...q2Results.map(r => r.driverId), ...bottom14.map(r => r.driverId)];
  const times: Record<string, number> = {};
  q2Results.forEach(r => { times[r.driverId] = r.time; });
  bottom14.forEach(r => { times[r.driverId] = r.time; });

  // ---- Build tick snapshots for progressive UI reveal ----
  // Each stage gets 3 ticks. Each tick reveals a third of the drivers' times.
  // Driver "reveal order" is randomized so it feels like cars finishing laps
  // in different order than their actual ranking.
  const ticks: QualifyingTick[] = [];

  // Q1 ticks: reveal 8, then 16, then all 24 (sorted by time so far)
  const q1Shuffled = rng.shuffle(q1Results); // randomize completion order
  const q1Counts = [8, 16, 24];
  for (const count of q1Counts) {
    const completed = q1Shuffled.slice(0, count);
    const partial = completed.slice().sort((a, b) => a.time - b.time);
    const tickTimes: Record<string, number> = {};
    partial.forEach(r => { tickTimes[r.driverId] = r.time; });
    ticks.push({
      stage: 'Q1',
      ranking: partial.map(r => r.driverId),
      times: tickTimes,
    });
  }

  // Q2 ticks: reveal 4, then 7, then all 10
  // Positions 11-24 were eliminated in Q1 — they're locked in their Q1
  // order for the duration of Q2 regardless of what the top 10 are doing.
  // Only the top 10 reshuffle as Q2 reveals; bottom 14 stay fixed.
  const q2Shuffled = rng.shuffle(q2Results);
  const q2Counts = [4, 7, 10];
  const bottom14Times: Record<string, number> = {};
  const bottom14Ids = bottom14.map(r => r.driverId); // locked order P11..P24
  bottom14.forEach(r => { bottom14Times[r.driverId] = r.time; });
  for (const count of q2Counts) {
    const completed = q2Shuffled.slice(0, count);
    const partialQ2 = completed.slice().sort((a, b) => a.time - b.time);
    const tickTimes: Record<string, number> = { ...bottom14Times };
    partialQ2.forEach(r => { tickTimes[r.driverId] = r.time; });
    // Drivers in q2 not yet shown: keep their q1 time as placeholder
    q2Results.forEach(r => {
      if (!(r.driverId in tickTimes)) {
        const q1Time = q1Results.find(x => x.driverId === r.driverId)?.time;
        if (q1Time !== undefined) tickTimes[r.driverId] = q1Time;
      }
    });
    // Ranking: sort the 10 Q2 drivers by their current time, then append the
    // 14 eliminated drivers in their fixed Q1 finishing order. Bottom 14 are
    // out of the session — they should never reshuffle in Q2.
    const q2DriverIds = q2Results.map(r => r.driverId);
    const top10Ranked = q2DriverIds
      .slice()
      .sort((a, b) => tickTimes[a] - tickTimes[b]);
    const allRanked = [...top10Ranked, ...bottom14Ids];
    ticks.push({
      stage: 'Q2',
      ranking: allRanked,
      times: tickTimes,
    });
  }

  return {
    circuitId: gp.circuit.id,
    ranking,
    times,
    poleDriverId: ranking[0],
    ticks,
  };
}

// Get the 24 entrants (driver + team). If a regular driver is injured, the test
// driver takes their seat. If BOTH regulars are injured (rare), the team fields
// only 1 car (the test driver) — that race will have fewer than 24 starters,
// which is realistic for emergency situations.
function buildEntrants(teams: Team[], drivers: Driver[]): Entrant[] {
  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const entrants: Entrant[] = [];
  for (const team of teams) {
    const d1Raw = team.driver1Id ? driverMap.get(team.driver1Id) : null;
    const d2Raw = team.driver2Id ? driverMap.get(team.driver2Id) : null;
    const test = team.testDriverId ? driverMap.get(team.testDriverId) : null;
    const d1Available = d1Raw && d1Raw.injuredRaces === 0 ? d1Raw : null;
    const d2Available = d2Raw && d2Raw.injuredRaces === 0 ? d2Raw : null;
    // Compute who races. Each seat needs a unique driver (no duplicates).
    let seat1: Driver | null = null;
    let seat2: Driver | null = null;
    if (d1Available && d2Available) {
      seat1 = d1Available;
      seat2 = d2Available;
    } else if (d1Available && !d2Available) {
      seat1 = d1Available;
      seat2 = test && test.id !== d1Available.id ? test : null;
    } else if (!d1Available && d2Available) {
      seat1 = d2Available;
      seat2 = test && test.id !== d2Available.id ? test : null;
    } else {
      // Both regulars injured: field just the test driver
      seat1 = test ?? null;
      seat2 = null;
    }
    if (seat1) entrants.push({ driver: seat1, team });
    if (seat2) entrants.push({ driver: seat2, team });
  }
  return entrants;
}

// ============================================================================
// RACE SIMULATION
// We compute a per-driver "race rating" once, then simulate position changes
// over 10 segments (every 5 laps). At each segment we re-sample noise around
// the rating to create position swaps. Incidents can occur at any segment.
// ============================================================================

export function simulateRace(
  gp: GrandPrix,
  qualifying: QualifyingResult,
  teams: Team[],
  drivers: Driver[],
  engDirectors: EngineeringDirector[],
  raceDirectors: RaceDirector[],
  rng: RNG
): RaceResult {
  const entrants = buildEntrants(teams, drivers);
  const driverMap = new Map(entrants.map(e => [e.driver.id, e]));
  const ctx: RatingContext = {
    gp,
    entrants,
    engDirMap: new Map(engDirectors.map(e => [e.id, e])),
    raceDirMap: new Map(raceDirectors.map(r => [r.id, r])),
  };

  // Compute baseline race rating per driver (their "true" race pace this weekend)
  const baseRatings = new Map<string, number>();
  for (const e of entrants) {
    baseRatings.set(e.driver.id, performanceRating(e, ctx, 'race', rng));
  }

  // Track cumulative time delta from baseline per driver (for delays from incidents)
  const cumulativeDelay = new Map<string, number>();
  entrants.forEach(e => cumulativeDelay.set(e.driver.id, 0));

  // Track DNFs
  const dnfs = new Set<string>();
  const incidents: RaceIncident[] = [];
  const snapshots: RaceLapSnapshot[] = [];

  // Lap 0 snapshot = starting grid from qualifying
  const startingGrid = qualifying.ranking.slice();
  snapshots.push({
    lap: 0,
    ranking: startingGrid,
    positionsGainedVsQuali: Object.fromEntries(startingGrid.map((id, i) => [id, i - i])), // all 0
    newIncidents: [],
  });

  // Race structure: 5 segments of variable length per spec.
  // - First 3 laps: opening drama (Lap 1-3, start chaos, opening overtakes)
  // - Next 15 laps: early race phase
  // - Next 15 laps: mid race
  // - Next 15 laps: late race (clutch boost zone)
  // - Last 3 laps: closing drama
  // Total = 3 + 15 + 15 + 15 + 2 = 50 laps (one segment slightly short so it adds to 50)
  // We track cumulative lap count and use it as the snapshot label.
  const segmentLengths = [3, 15, 15, 15, 2]; // sums to 50
  const segments = segmentLengths.length;

  // Per-segment "scores" for each driver. Position at each segment is ranked by accumulated score.
  const scores = new Map<string, number>();
  entrants.forEach(e => {
    // Initial score reflects starting grid: pole position gets a small head start
    const gridPos = qualifying.ranking.indexOf(e.driver.id);
    const gridBonus = (24 - gridPos) * 0.3; // pos 1 gets +7.2, pos 24 gets +0.3
    scores.set(e.driver.id, gridBonus);
  });

  // Track fastest single-segment performance for "fastest lap"
  let fastestLapDriverId = entrants[0].driver.id;
  let fastestLapScore = -Infinity;

  let cumulativeLap = 0;
  for (let seg = 1; seg <= segments; seg++) {
    const segLength = segmentLengths[seg - 1];
    cumulativeLap += segLength;
    const lap = cumulativeLap;
    const newIncidents: RaceIncident[] = [];

    for (const e of entrants) {
      if (dnfs.has(e.driver.id)) continue;
      const baseRating = baseRatings.get(e.driver.id)!;

      // Segment scoring: scale both baseline and noise by segment length.
      // A 15-lap segment contributes ~5x the score of a 3-lap segment, both for
      // baseline pace AND for variance (more laps = more chances for things to happen).
      // Noise scales as sqrt(segLength) (independent events accumulate variance).
      const lengthFactor = segLength;
      const noiseStdBase = gp.weather === 'rain' ? 3.5 : 2.5 - seg * 0.15;
      const noiseStd = noiseStdBase * Math.sqrt(segLength);
      const segNoise = rng.normal(0, noiseStd);

      // Clutch archetype: late-race boost (now seg 4 = last 15 laps, seg 5 = final 3)
      let archMod = 0;
      if (e.driver.archetype === 'clutch' && seg >= 4) archMod += 1.5;
      // Tire whisperer: less fade late
      if (e.driver.archetype === 'tire_whisperer' && seg >= 3) archMod += 1.0;
      // Aggressive: bigger swings (more position changes)
      if (e.driver.archetype === 'aggressive') {
        const extra = rng.normal(0, 1.5 * Math.sqrt(segLength) / Math.sqrt(5));
        archMod += extra;
      }
      // Conservative: smaller swings
      if (e.driver.archetype === 'conservative') {
        archMod -= 0.5;
      }

      const segScore = baseRating * lengthFactor + segNoise + archMod * lengthFactor;
      scores.set(e.driver.id, scores.get(e.driver.id)! + segScore);

      // Check for fastest lap: normalize by segment length to compare segments fairly
      const segPace = segScore / lengthFactor;
      if (segPace > fastestLapScore) {
        fastestLapScore = segPace;
        fastestLapDriverId = e.driver.id;
      }

      // ---- Incidents ----
      // Scale incident probability by segment length too: more laps = more chances.
      const incident = rollIncident(e, ctx, seg, segments, segLength, rng);
      if (incident) {
        incident.lap = lap;
        newIncidents.push(incident);
        incidents.push(incident);
        if (incident.type === 'mechanical_dnf' || incident.type === 'crash_dnf') {
          dnfs.add(e.driver.id);
        } else {
          // Delay: subtract from score so they drop positions
          const delayPenalty = incident.delaySeconds * 0.4;
          scores.set(e.driver.id, scores.get(e.driver.id)! - delayPenalty);
          cumulativeDelay.set(e.driver.id, cumulativeDelay.get(e.driver.id)! + incident.delaySeconds);
        }
      }
    }

    // Rank entrants by score (DNFs go last)
    const live = entrants.filter(e => !dnfs.has(e.driver.id));
    live.sort((a, b) => scores.get(b.driver.id)! - scores.get(a.driver.id)!);
    const dnfList = entrants.filter(e => dnfs.has(e.driver.id));
    const ranking = [...live.map(e => e.driver.id), ...dnfList.map(e => e.driver.id)];

    // Positions gained vs qualifying
    const positionsGained: Record<string, number> = {};
    ranking.forEach((id, pos) => {
      const qPos = qualifying.ranking.indexOf(id);
      positionsGained[id] = qPos - pos; // positive = gained
    });

    snapshots.push({ lap, ranking, positionsGainedVsQuali: positionsGained, newIncidents });
  }

  const finalRanking = snapshots[snapshots.length - 1].ranking;

  // Award points: top 10 finishers (not DNF), F1 scale
  const pointsAwarded: Record<string, number> = {};
  let pointPos = 0;
  for (const id of finalRanking) {
    if (dnfs.has(id)) continue;
    if (pointPos < RACE_POINTS.length) {
      pointsAwarded[id] = (pointsAwarded[id] || 0) + RACE_POINTS[pointPos];
    }
    pointPos++;
  }
  // Fastest lap bonus: only if in top 10
  const flPos = finalRanking.indexOf(fastestLapDriverId);
  if (!dnfs.has(fastestLapDriverId) && flPos < 10) {
    pointsAwarded[fastestLapDriverId] = (pointsAwarded[fastestLapDriverId] || 0) + FASTEST_LAP_BONUS;
  }

  return {
    circuitId: gp.circuit.id,
    snapshots,
    finalRanking,
    dnfs: [...dnfs],
    fastestLapDriverId,
    incidents,
    pointsAwarded,
  };
}

// Per-segment incident roll. Returns an incident or null.
// Probabilities scale by segment length: a 15-lap segment is 5x more likely to
// have an incident than a 3-lap segment, all else equal.
function rollIncident(
  e: Entrant,
  ctx: RatingContext,
  segment: number,
  totalSegments: number,
  segLength: number,
  rng: RNG
): RaceIncident | null {
  // Base chances *per lap* — scaled up by segLength.
  // Mechanical DNF base rate per lap: ~0.3% for reliability 70.
  // Across 50 laps that's ~15% DNF rate per car per race, ~3 cars per race average. Realistic-ish.
  const car = e.team.car;
  const perLapMech = clamp((100 - car.reliability) / 100 * 0.003, 0, 0.012);
  let mechDnfChance = perLapMech * segLength;

  // Race director provides small reliability bump
  if (e.team.raceDirectorId) {
    const rd = ctx.raceDirMap.get(e.team.raceDirectorId);
    if (rd) mechDnfChance *= clamp(1 - rd.reliabilityBonus / 50, 0.5, 1);
  }

  let perLapCrash = 0.0008;
  if (e.driver.archetype === 'aggressive') perLapCrash *= 1.8;
  if (e.driver.archetype === 'hothead')    perLapCrash *= 2.2;
  if (e.driver.archetype === 'conservative') perLapCrash *= 0.4;
  if (e.driver.archetype === 'regular')    perLapCrash *= 0.5;
  if (ctx.gp.weather === 'rain') perLapCrash *= 2.5;
  const crashDnfChance = perLapCrash * segLength;

  // Delays per lap (off-track moment, slow pit stop)
  let perLapDelay = 0.005;
  if (e.driver.archetype === 'aggressive') perLapDelay *= 1.3;
  if (e.driver.archetype === 'hothead')    perLapDelay *= 1.4;
  if (e.driver.archetype === 'conservative') perLapDelay *= 0.7;
  const delayChance = perLapDelay * segLength;

  // Roll mechanical first
  if (rng.chance(mechDnfChance)) {
    return {
      driverId: e.driver.id,
      lap: 0, // set by caller
      type: 'mechanical_dnf',
      causesInjury: false,
      injuryRaces: 0,
      delaySeconds: 0,
    };
  }
  // Crash DNF
  if (rng.chance(crashDnfChance)) {
    // 30% of crash DNFs cause injury (1-3 races)
    const injures = rng.chance(0.30);
    return {
      driverId: e.driver.id,
      lap: 0,
      type: 'crash_dnf',
      causesInjury: injures,
      injuryRaces: injures ? rng.int(1, 3) : 0,
      delaySeconds: 0,
    };
  }
  // Delay (not race-ending)
  if (rng.chance(delayChance)) {
    return {
      driverId: e.driver.id,
      lap: 0,
      type: rng.chance(0.5) ? 'crash_delay' : 'delay',
      causesInjury: false,
      injuryRaces: 0,
      delaySeconds: parseFloat(rng.range(3, 15).toFixed(1)),
    };
  }
  // Unused param to suppress lint
  void segment; void totalSegments;
  return null;
}

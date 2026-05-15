import {
  Driver, DriverSkills, DriverArchetype, ALL_ARCHETYPES,
  EngineeringDirector, RaceDirector,
  Team, CarStats, Circuit, GrandPrix, Weather,
  Rarity, POOL_RARITY_TARGETS,
} from './types';
import { RNG, clamp, makeId } from './rng';
import { FIRST_NAMES, LAST_NAMES, TEAM_DATA, CALENDAR_CIRCUITS } from './data';
import { COUNTRIES, CountryEntry, rollCountry, rollNameForCountry } from './countries';

// ============================================================================
// SKILL RANGES BY RARITY
// Drivers: legends are 88-99, common are 50-70 etc.
// These overlap a bit so rarity doesn't fully determine outcome.
// ============================================================================

const DRIVER_SKILL_RANGE: Record<Rarity, [number, number]> = {
  legend:   [88, 99],
  epic:     [80, 92],
  rare:     [72, 85],
  uncommon: [62, 78],
  common:   [50, 70],
};

// Engineering director target & pull factor by rarity.
// Pull factor is the % of the gap (target - currentStat) that gets closed.
// Legend on a 60 car (target 88, pull 0.5): (88-60)*0.5 = +14 → car becomes 74
// Legend on a 85 car (target 88, pull 0.5): (88-85)*0.5 = +1.5 → car becomes 86.5
// Common on a 60 car (target 65, pull 0.3): (65-60)*0.3 = +1.5 → car becomes 61.5
const ENG_TARGET_RANGE: Record<Rarity, { speed: [number, number]; others: [number, number]; pull: number }> = {
  legend:   { speed: [88, 92], others: [85, 90], pull: 0.55 },
  epic:     { speed: [82, 86], others: [80, 84], pull: 0.45 },
  rare:     { speed: [76, 80], others: [74, 78], pull: 0.35 },
  uncommon: { speed: [70, 74], others: [68, 72], pull: 0.25 },
  common:   { speed: [64, 68], others: [62, 66], pull: 0.20 },
};

const RACE_DIR_TIME_PCT_RANGE: Record<Rarity, [number, number]> = {
  legend:   [1.5, 2.0],
  epic:     [1.1, 1.5],
  rare:     [0.8, 1.1],
  uncommon: [0.6, 0.8],
  common:   [0.4, 0.6],
};

const RACE_DIR_RELIABILITY: Record<Rarity, [number, number]> = {
  legend:   [3, 5],
  epic:     [2, 4],
  rare:     [1, 3],
  uncommon: [0, 2],
  common:   [0, 1],
};

// ============================================================================
// NAME GENERATION (avoiding collisions within a session)
// ============================================================================
const usedNames = new Set<string>();

// Country-aware name generator: picks a name from the country's pools.
// Falls back to the legacy generic pools if for some reason a country is missing.
function makeNameForCountry(rng: RNG, country: CountryEntry): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = rollNameForCountry(country, rng);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Final fallback: append a number to keep it unique.
  const name = `${rng.pick(country.firstNames)} ${rng.pick(country.surnames)} ${rng.int(2, 99)}`;
  usedNames.add(name);
  return name;
}

// Legacy generic name generator (kept for any callers we don't update).
function makeName(rng: RNG): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const f = rng.pick(FIRST_NAMES);
    const l = rng.pick(LAST_NAMES);
    const name = `${f} ${l}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // fallback
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}-${rng.int(1, 99)}`;
}

// ============================================================================
// DRIVERS
// ============================================================================

function rollDriverSkills(rng: RNG, rarity: Rarity, archetype: DriverArchetype): DriverSkills {
  const [lo, hi] = DRIVER_SKILL_RANGE[rarity];
  const base = (): number => rng.range(lo, hi);
  const skills: DriverSkills = {
    driving: base(),
    physical: base(),
    carSetup: base(),
    speed: base(),
  };
  // Archetype tilts skill distribution
  switch (archetype) {
    case 'qualifier':       skills.speed += 4; skills.driving -= 2; break;
    case 'racer':           skills.driving += 4; skills.speed -= 2; break;
    case 'wet_specialist':  skills.driving += 3; break;
    case 'iceman':          skills.physical += 4; break;
    case 'clutch':          skills.driving += 2; skills.physical += 1; break;
    case 'tire_whisperer':  skills.carSetup += 4; break;
    case 'calculator':      skills.carSetup += 3; skills.driving += 1; break; // smart + adaptive
    case 'hothead':         skills.speed += 3; skills.driving += 2; break;
    case 'aggressive':      skills.speed += 2; skills.driving += 1; break;
    case 'conservative':    skills.carSetup += 2; break;
    case 'regular':         /* no tilt */ break;
  }
  // Clamp to 50-99
  (Object.keys(skills) as (keyof DriverSkills)[]).forEach(k => {
    skills[k] = clamp(Math.round(skills[k]), 50, 99);
  });
  return skills;
}

export function createDriver(rng: RNG, rarity: Rarity, age?: number): Driver {
  const archetype = rng.pick(ALL_ARCHETYPES);
  const potential = rollDriverSkills(rng, rarity, archetype);
  const startAge = 23;
  const retirementAge = rng.int(32, 39);
  const country = rollCountry(rng);
  return {
    id: makeId('drv'),
    name: makeNameForCountry(rng, country),
    country: country.name,
    countryCode: country.code,
    flag: country.flag,
    rarity,
    archetype,
    potentialSkills: potential,
    age: age ?? startAge,
    careerStartAge: startAge,
    retirementAge,
    retirementAnnounced: false,
    retired: false,
    injuredRaces: 0,
    seasonWins: 0,
    seasonPodiums: 0,
    seasonPoints: 0,
    seasonPoles: 0,
    seasonFastestLaps: 0,
    careerWins: 0,
    careerPodiums: 0,
    careerPoles: 0,
    careerChampionships: 0,
    careerStarts: 0,
    yearHistory: [],
  };
}

// Effective skills for a driver this season, accounting for rookie/veteran multipliers.
export function effectiveDriverSkills(d: Driver): DriverSkills {
  const yearsIn = d.age - d.careerStartAge;
  let mult = 1.0;
  if (yearsIn === 0) mult = 0.80;      // year 1 rookie
  else if (yearsIn === 1) mult = 0.90; // year 2 rookie
  else if (d.age === d.retirementAge) mult = 0.90; // veteran (final year)
  return {
    driving:  Math.round(d.potentialSkills.driving  * mult),
    physical: Math.round(d.potentialSkills.physical * mult),
    carSetup: Math.round(d.potentialSkills.carSetup * mult),
    speed:    Math.round(d.potentialSkills.speed    * mult),
  };
}

// Overall rating: weighted blend of the 4 skills. Driving and Speed contribute the
// most since they drive race pace; physical and car setup are supporting traits.
export function driverOverall(d: Driver): number {
  const s = effectiveDriverSkills(d);
  return Math.round(s.driving * 0.35 + s.speed * 0.30 + s.carSetup * 0.20 + s.physical * 0.15);
}

export function careerStageOf(d: Driver): 'rookie' | 'prime' | 'veteran' {
  const yearsIn = d.age - d.careerStartAge;
  if (yearsIn <= 1) return 'rookie';
  if (d.age === d.retirementAge) return 'veteran';
  return 'prime';
}

// ============================================================================
// DIRECTORS
// ============================================================================

export function createEngineeringDirector(rng: RNG, rarity: Rarity): EngineeringDirector {
  const ranges = ENG_TARGET_RANGE[rarity];
  const country = rollCountry(rng);
  return {
    id: makeId('eng'),
    name: makeNameForCountry(rng, country),
    country: country.name,
    countryCode: country.code,
    flag: country.flag,
    rarity,
    speedTarget:       rng.int(ranges.speed[0], ranges.speed[1]),
    accelTarget:       rng.int(ranges.others[0], ranges.others[1]),
    turningTarget:     rng.int(ranges.others[0], ranges.others[1]),
    reliabilityTarget: rng.int(ranges.others[0], ranges.others[1]),
    pullFactor: ranges.pull,
    age: rng.int(35, 60),
    yearsRemaining: rng.int(8, 12),
    retired: false,
    yearHistory: [],
  };
}

export function createRaceDirector(rng: RNG, rarity: Rarity): RaceDirector {
  const [tLo, tHi] = RACE_DIR_TIME_PCT_RANGE[rarity];
  const [rLo, rHi] = RACE_DIR_RELIABILITY[rarity];
  const country = rollCountry(rng);
  return {
    id: makeId('rdr'),
    name: makeNameForCountry(rng, country),
    country: country.name,
    countryCode: country.code,
    flag: country.flag,
    rarity,
    reliabilityBonus: rng.int(rLo, rHi),
    timeImprovementPct: parseFloat(rng.range(tLo, tHi).toFixed(2)),
    age: rng.int(35, 60),
    yearsRemaining: rng.int(8, 12),
    retired: false,
    yearHistory: [],
  };
}

// ============================================================================
// CARS
// ============================================================================

export function rollCarStats(rng: RNG, legacyBase: number): CarStats {
  // Normal distribution around legacyBase. We use a wider stdDev (4) and only
  // soft-clamp to [40, 99] so the tier gap (85 vs 75 vs 65 = 20 points) actually
  // matters. Cars should differentiate teams meaningfully before the driver shows up.
  const roll = (): number => {
    const v = rng.normal(legacyBase, 4);
    return clamp(Math.round(v), 40, 99);
  };
  return {
    maxSpeed: roll(),
    acceleration: roll(),
    turning: roll(),
    reliability: roll(),
  };
}

export function carStatsWithDirector(
  base: CarStats,
  eng: EngineeringDirector | null
): CarStats {
  if (!eng) return { ...base };
  // For each stat: boost = max(0, (target - current) * pullFactor)
  // Floor at 0 so a director never makes a car worse than baseline.
  const pull = (current: number, target: number): number => {
    const gap = target - current;
    if (gap <= 0) return current; // already better than target, no change
    return current + Math.round(gap * eng.pullFactor);
  };
  return {
    maxSpeed:     clamp(pull(base.maxSpeed,     eng.speedTarget),       0, 110),
    acceleration: clamp(pull(base.acceleration, eng.accelTarget),       0, 110),
    turning:      clamp(pull(base.turning,      eng.turningTarget),     0, 110),
    reliability:  clamp(pull(base.reliability,  eng.reliabilityTarget), 0, 110),
  };
}

// ============================================================================
// TEAMS
// ============================================================================

export function createTeams(rng: RNG): Team[] {
  return TEAM_DATA.map(t => ({
    id: makeId('tm'),
    name: t.name,
    shortName: t.shortName,
    color: t.color,
    tier: t.tier,
    legacyBaseValue: t.legacyBaseValue,
    car: rollCarStats(rng, t.legacyBaseValue),
    driver1Id: null,
    driver2Id: null,
    testDriverId: null,
    engDirectorId: null,
    raceDirectorId: null,
    marketPoints: t.tier === 'top' ? 17 : 13,
    seasonPoints: 0,
    seasonWins: 0,
    seasonPodiums: 0,
    seasonPoles: 0,
    careerWins: 0,
    careerPodiums: 0,
    careerPoles: 0,
    careerDriverWC: 0,
    careerConstructorWC: 0,
    yearHistory: [],
  }));
}

// ============================================================================
// CALENDAR
// ============================================================================

export function createCalendar(rng: RNG): GrandPrix[] {
  return CALENDAR_CIRCUITS.map((c, i) => {
    const circuit: Circuit = {
      id: `crc_${i}`,
      name: c.name,
      country: c.country,
      profile: c.profile,
      laps: 50,
    };
    const weather = rollWeather(rng, c);
    return { circuit, round: i + 1, weather };
  });
}

function rollWeather(rng: RNG, c: { country: string }): Weather {
  // Hot bias for desert circuits; rain bias for Belgium/UK/Brazil/Japan; rest normal.
  const hot = ['Bahrain', 'Saudi Arabia', 'Qatar', 'Abu Dhabi', 'Singapore'];
  const rain = ['Belgium', 'UK', 'Brazil', 'Japan', 'Netherlands'];
  if (hot.includes(c.country))  return rng.pickWeighted(['hot','normal']     as Weather[], [0.5, 0.5]);
  if (rain.includes(c.country)) return rng.pickWeighted(['rain','normal']    as Weather[], [0.35, 0.65]);
  return rng.pickWeighted(['normal','hot','rain'] as Weather[], [0.75, 0.10, 0.15]);
}

// ============================================================================
// POOL GENERATION (40 drivers, 20 eng directors, 20 race directors)
// ============================================================================

export function generateDriverPool(rng: RNG, size = 40): Driver[] {
  const rarities: Rarity[] = [];
  // Pick a count within each target range
  const [legLo, legHi]   = POOL_RARITY_TARGETS.legend;
  const [epicLo, epicHi] = POOL_RARITY_TARGETS.epic;
  const [rareLo, rareHi] = POOL_RARITY_TARGETS.rare;
  const [unLo, unHi]     = POOL_RARITY_TARGETS.uncommon;
  const legends   = rng.int(legLo, legHi);
  const epics     = rng.int(epicLo, epicHi);
  const rares     = rng.int(rareLo, rareHi);
  const uncommons = rng.int(unLo, unHi);
  const commons   = size - legends - epics - rares - uncommons;

  for (let i = 0; i < legends; i++)   rarities.push('legend');
  for (let i = 0; i < epics; i++)     rarities.push('epic');
  for (let i = 0; i < rares; i++)     rarities.push('rare');
  for (let i = 0; i < uncommons; i++) rarities.push('uncommon');
  for (let i = 0; i < Math.max(0, commons); i++) rarities.push('common');

  // Spread ages across 23-39 so we don't have everyone retiring at once
  const drivers: Driver[] = [];
  for (let i = 0; i < rarities.length; i++) {
    const d = createDriver(rng, rarities[i]);
    // Random starting age within career
    d.age = rng.int(23, 39);
    // Make sure retirementAge >= age
    if (d.retirementAge < d.age) d.retirementAge = Math.min(39, d.age + rng.int(0, 3));
    drivers.push(d);
  }
  return drivers;
}

export function generateEngDirectorPool(rng: RNG, size = 20): EngineeringDirector[] {
  return generateDirectorRarities(rng, size).map(r => createEngineeringDirector(rng, r));
}

export function generateRaceDirectorPool(rng: RNG, size = 20): RaceDirector[] {
  return generateDirectorRarities(rng, size).map(r => createRaceDirector(rng, r));
}

function generateDirectorRarities(rng: RNG, size: number): Rarity[] {
  // 1-2 legend, 1-2 epic, 2-3 rare, rest uncommon/common
  const legends = rng.int(1, 2);
  const epics   = rng.int(1, 2);
  const rares   = rng.int(2, 3);
  const remaining = size - legends - epics - rares;
  const uncommons = Math.floor(remaining * 0.6);
  const commons = remaining - uncommons;
  const out: Rarity[] = [];
  for (let i = 0; i < legends; i++)   out.push('legend');
  for (let i = 0; i < epics; i++)     out.push('epic');
  for (let i = 0; i < rares; i++)     out.push('rare');
  for (let i = 0; i < uncommons; i++) out.push('uncommon');
  for (let i = 0; i < commons; i++)   out.push('common');
  return rng.shuffle(out);
}

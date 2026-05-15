// ============================================================================
// CORE TYPES
// ============================================================================

export type Rarity = 'legend' | 'epic' | 'rare' | 'uncommon' | 'common';

// Market point costs by rarity (used for both drivers and directors)
export const RARITY_COST: Record<Rarity, number> = {
  legend: 4,
  epic: 3,
  rare: 2,
  uncommon: 1,
  common: 0,
};

// Target distribution of rarities in the 40-driver pool
export const POOL_RARITY_TARGETS: Record<Rarity, [number, number]> = {
  legend: [2, 3],
  epic: [3, 4],
  rare: [5, 6],
  uncommon: [8, 10],
  common: [17, 22], // fills the rest
};

// ============================================================================
// DRIVERS
// ============================================================================

export type DriverArchetype =
  | 'regular'       // low variance, rarely breaks (low DNF chance)
  | 'conservative'  // safe, few overtakes, few accidents
  | 'aggressive'    // more overtakes, more accidents
  | 'qualifier'     // overperforms in quali, average in race
  | 'racer'         // mediocre quali, strong race pace
  | 'wet_specialist'// huge boost in rain
  | 'iceman'        // no performance drop in extreme heat
  | 'clutch'        // boost in last 10 laps and title-deciding races
  | 'tire_whisperer'// better reliability, less late-race fade
  | 'calculator'    // small boost in changing conditions (rain or hot), slightly weaker in pure dry pace
  | 'hothead';      // high overtake ceiling but accident risk scales with pressure

export const ALL_ARCHETYPES: DriverArchetype[] = [
  'regular', 'conservative', 'aggressive', 'qualifier', 'racer',
  'wet_specialist', 'iceman', 'clutch', 'tire_whisperer', 'calculator', 'hothead',
];

export interface DriverSkills {
  driving: number;   // 0-100, raw pace
  physical: number;  // 0-100, cardio/endurance (matters in heat)
  carSetup: number;  // 0-100, helps extract car performance
  speed: number;     // 0-100, pure speed in qualifying
}

export type CareerStage = 'rookie' | 'prime' | 'veteran';

export interface Driver {
  id: string;
  name: string;
  rarity: Rarity;
  archetype: DriverArchetype;
  potentialSkills: DriverSkills; // ceiling
  age: number;
  careerStartAge: number;        // 23
  retirementAge: number;         // 32-39 (hidden until announced)
  retirementAnnounced: boolean;  // becomes true at start of final season
  injuredRaces: number;          // GPs to miss
  // Season stats
  seasonWins: number;
  seasonPodiums: number;
  seasonPoints: number;
  seasonPoles: number;
  seasonFastestLaps: number;
  // Career stats
  careerWins: number;
  careerChampionships: number;
  careerStarts: number;
}

// ============================================================================
// DIRECTORS
// ============================================================================

export interface EngineeringDirector {
  id: string;
  name: string;
  rarity: Rarity;
  // Target-based pull model: the director "pulls" each car stat toward
  // their target value. Better directors have higher targets and stronger pull.
  // Effective boost per stat = (target - currentStat) * pullFactor, with a floor of 0
  // (a director never makes a car worse). This creates diminishing returns: an
  // already-good car gets a small bump, a poor car gets a huge bump (Brawn effect).
  speedTarget: number;
  accelTarget: number;
  turningTarget: number;
  reliabilityTarget: number;
  pullFactor: number; // 0-1, how much of the gap to close
  age: number;
  yearsRemaining: number; // 8-12 lifespan
}

export interface RaceDirector {
  id: string;
  name: string;
  rarity: Rarity;
  reliabilityBonus: number;  // small
  timeImprovementPct: number; // 0.5% common -> 2% legend
  age: number;
  yearsRemaining: number;
}

// ============================================================================
// CARS / TEAMS
// ============================================================================

export type TeamTier = 'top' | 'mid' | 'bottom';

export interface CarStats {
  maxSpeed: number;       // 0-100
  acceleration: number;   // 0-100
  turning: number;        // 0-100
  reliability: number;    // 0-100, higher = lower DNF chance
}

export interface Team {
  id: string;
  name: string;
  shortName: string;      // 3-letter code
  color: string;          // hex
  tier: TeamTier;
  legacyBaseValue: number; // 70 / 75 / 80
  car: CarStats;
  driver1Id: string | null;
  driver2Id: string | null;
  testDriverId: string | null;
  engDirectorId: string | null;
  raceDirectorId: string | null;
  marketPoints: number;   // 13 or 17
  // Season stats
  seasonPoints: number;
  seasonWins: number;
}

// ============================================================================
// CIRCUITS / EVENTS
// ============================================================================

export type CircuitProfile =
  | 'linear'      // favors max speed
  | 'mixed'       // favors acceleration
  | 'technical'   // favors turning
  | 'balanced';   // no strong favoritism

export type Weather = 'normal' | 'hot' | 'rain';

export interface Circuit {
  id: string;
  name: string;
  country: string;
  profile: CircuitProfile;
  laps: number; // we'll standardize to 50 for now
}

export interface GrandPrix {
  circuit: Circuit;
  round: number;
  weather: Weather;
}

// ============================================================================
// SEASON STATE
// ============================================================================

export type GamePhase =
  | 'season_start'
  | 'pre_race'        // pre-qualifying for a GP
  | 'qualifying_q1'
  | 'qualifying_q2'
  | 'qualifying_results'
  | 'race_grid'       // starting grid shown
  | 'race_running'
  | 'race_results'
  | 'season_summary'
  | 'new_cars'
  | 'market';

export interface SeasonState {
  year: number;
  drivers: Driver[];          // the full pool of 40
  teams: Team[];              // 12 teams
  engineeringDirectors: EngineeringDirector[];
  raceDirectors: RaceDirector[];
  calendar: GrandPrix[];
  currentRound: number;
  phase: GamePhase;
  // Standings (computed but cached)
  driverStandings: { driverId: string; points: number }[];
  teamStandings: { teamId: string; points: number }[];
  // Last race results so we can show them
  lastQualiResult?: QualifyingResult;
  lastRaceResult?: RaceResult;
  // Free agents (unsigned drivers/directors)
  freeAgentDriverIds: string[];
  freeAgentEngDirectorIds: string[];
  freeAgentRaceDirectorIds: string[];
}

// ============================================================================
// RACE / QUALIFYING RESULTS
// ============================================================================

export interface QualifyingLap {
  driverId: string;
  time: number; // seconds; lower is better
  inQ2: boolean;
}

// A tick within Q1 or Q2: shows the partial ranking as drivers complete laps.
// Used to drive a Peloton-style progressive reveal animation.
export interface QualifyingTick {
  stage: 'Q1' | 'Q2';
  // Ranking at this tick — only includes drivers who have set a time so far.
  ranking: string[];
  // Times set so far. Drivers not yet shown won't have entries.
  times: Record<string, number>;
}

export interface QualifyingResult {
  circuitId: string;
  // ranked driver IDs (positions 1-24)
  ranking: string[];
  times: Record<string, number>;
  poleDriverId: string;
  // Tick reveals: 3 ticks per stage (Q1 has 3, Q2 has 3) for UI animation.
  ticks: QualifyingTick[];
}

export interface RaceLapSnapshot {
  lap: number;
  ranking: string[];           // driverId in order
  positionsGainedVsQuali: Record<string, number>; // positive = gained, negative = lost
  newIncidents: RaceIncident[];
}

export type IncidentType = 'mechanical_dnf' | 'crash_dnf' | 'delay' | 'crash_delay';

export interface RaceIncident {
  driverId: string;
  lap: number;
  type: IncidentType;
  causesInjury: boolean;
  injuryRaces: number; // 0 if not injured
  delaySeconds: number; // 0 if DNF
}

export interface RaceResult {
  circuitId: string;
  snapshots: RaceLapSnapshot[]; // lap 0 (grid), 5, 10, ... 50
  finalRanking: string[];        // driverId, position 1 first; DNFs at the end
  dnfs: string[];                // driverIds that didn't finish
  fastestLapDriverId: string;
  incidents: RaceIncident[];
  pointsAwarded: Record<string, number>; // driverId -> points
}

// F1-style points for top 10
export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const FASTEST_LAP_BONUS = 1; // only if finished top 10

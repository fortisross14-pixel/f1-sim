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
// Per-rarity targets for the active driver pool. With 12 teams × 3 driver slots
// = 36 max signed drivers, plus free agents available for end-of-season market.
// Sum of these targets centers around 52-55 so there's a healthy free agent
// pool. Rares bumped up so there are enough mid-rarity options for the
// replacement pass — teams should have credible upgrade targets each year.
export const POOL_RARITY_TARGETS: Record<Rarity, [number, number]> = {
  legend: [3, 4],
  epic: [5, 6],
  rare: [10, 12],
  uncommon: [11, 13],
  common: [20, 25], // fills the rest
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

// One year's record for a driver — snapshotted at end of each season.
// Powers the "year-by-year" table in the driver detail popup.
export interface DriverYearRecord {
  year: number;
  teamId: string | null;  // null if free agent that year (rare — usually they're on test driver slot)
  teamName: string;       // captured at the time so post-rename still reads correctly
  position: 'driver1' | 'driver2' | 'testDriver' | 'free_agent';
  races: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  isWorldChampion: boolean;
  rarityAtTime: Rarity;
}

export interface Driver {
  id: string;
  name: string;
  country: string;             // display name (e.g., "United Kingdom")
  countryCode: string;         // ISO alpha-2 (e.g., "GB")
  flag: string;                // emoji
  rarity: Rarity;
  archetype: DriverArchetype;
  potentialSkills: DriverSkills; // ceiling
  age: number;
  careerStartAge: number;        // 23
  retirementAge: number;         // 32-39 (hidden until announced)
  retirementAnnounced: boolean;  // becomes true at start of final season
  retired: boolean;              // true when removed from active pool; kept forever in archive
  injuredRaces: number;          // GPs to miss
  // Season stats (reset each year)
  seasonWins: number;
  seasonPodiums: number;
  seasonPoints: number;
  seasonPoles: number;
  seasonFastestLaps: number;
  // Career totals (cumulative, never reset)
  careerWins: number;
  careerPodiums: number;
  careerPoles: number;
  careerChampionships: number;
  careerStarts: number;
  // Year-by-year history (one record per season completed)
  yearHistory: DriverYearRecord[];
}

// ============================================================================
// DIRECTORS
// ============================================================================

// One year's tenure record for a director — captured at end of each season.
// If they served at a team that year, this tracks the team's results so we can
// attribute race wins, podiums and championships to the director's lifetime record.
export interface DirectorYearRecord {
  year: number;
  teamId: string | null;  // null if unsigned that year
  teamName: string;
  teamRaceWins: number;
  teamPodiums: number;
  teamPoles: number;
  driverWC: boolean;       // did a driver of this team win the championship?
  constructorWC: boolean;  // did this team win the constructor title?
  rarityAtTime: Rarity;
}

export interface EngineeringDirector {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  flag: string;
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
  retired: boolean;
  yearHistory: DirectorYearRecord[];
}

export interface RaceDirector {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  flag: string;
  rarity: Rarity;
  reliabilityBonus: number;  // small
  timeImprovementPct: number; // 0.5% common -> 2% legend
  age: number;
  yearsRemaining: number;
  retired: boolean;
  yearHistory: DirectorYearRecord[];
}

// ============================================================================
// CARS / TEAMS
// ============================================================================

export type TeamTier = 'top' | 'mid' | 'bottom';

// A car's circuit specialty — applies a per-lap time bonus when matched to
// the circuit profile. all_rounder gets a smaller bonus on every circuit.
export type CarSpecialty =
  | 'linear'
  | 'mixed'
  | 'technical'
  | 'balanced'
  | 'all_rounder';

export interface CarStats {
  maxSpeed: number;       // 0-100
  acceleration: number;   // 0-100
  turning: number;        // 0-100
  reliability: number;    // 0-100, higher = lower DNF chance
  // Circuit specialty: rolled at season start, re-rolled each preseason.
  // Adds a time bonus on matching circuits; all_rounder adds a smaller
  // bonus on every circuit. Mismatch = no bonus, no penalty.
  circuitSpecialty: CarSpecialty;
}

// Records the per-stat delta of a temporary car upgrade. Each value is the
// number of points that were *added* to the corresponding car stat. Reverting
// the upgrade subtracts these from `team.car`. Total adds to ~5 points (avg
// of 4-6) spread across the four stats.
export interface TempCarUpgrade {
  maxSpeed: number;
  acceleration: number;
  turning: number;
  reliability: number;
}

// One year's record for a team. Captures final standings + key stats.
export interface TeamYearRecord {
  year: number;
  finalPosition: number;       // 1-12 in constructor standings
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  driverWC: boolean;            // did one of their drivers win the WDC?
  constructorWC: boolean;       // did they win the WCC?
  carAvg: number;               // final post-eng-director average
  driver1Id: string | null;
  driver2Id: string | null;
  testDriverId: string | null;
  engDirectorId: string | null;
  raceDirectorId: string | null;
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
  marketPoints: number;   // base cap: 13 or 17
  // Consecutive Drivers' Championship streak for this team. Each consecutive
  // year one of this team's drivers wins the WDC, this increments. The team's
  // effective cap is reduced by this amount (unbounded — a 4-time champion
  // runs at marketPoints − 4). Resets to 0 the first year they don't win the
  // WDC, restoring the full cap in one swing. This is the core dynasty-breaker.
  championStreak: number;
  // Temporary car upgrade purchased with spare budget points at end of preseason.
  // Applied when a team has exactly 3 spare points after market resolves and can't
  // sign anyone else. Reverts at the start of the next preseason — those points
  // come back into the market budget so the team can spend them on people first.
  // null means no temporary upgrade active.
  tempCarUpgrade: TempCarUpgrade | null;
  // Season stats (reset annually)
  seasonPoints: number;
  seasonWins: number;
  seasonPodiums: number;
  seasonPoles: number;
  // Career totals (cumulative)
  careerWins: number;
  careerPodiums: number;
  careerPoles: number;
  careerDriverWC: number;
  careerConstructorWC: number;
  // Year-by-year history (one record per completed season)
  yearHistory: TeamYearRecord[];
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
  | 'menu'              // main app shell — user is browsing tabs (default state)
  | 'pre_race'          // race weekend started: pre-qualifying screen
  | 'qualifying_q1'     // Q1 just completed, awaiting Q2 click
  | 'qualifying_q2'     // Q2 completed, awaiting race start
  | 'race_results'      // race finished, viewing snapshots
  | 'preseason';        // end-of-year: Summary / Market / Cars sub-tabs available

export interface SeasonState {
  year: number;
  drivers: Driver[];          // the full active pool of 40
  teams: Team[];              // 12 teams (constant across years)
  engineeringDirectors: EngineeringDirector[];
  raceDirectors: RaceDirector[];
  // Hall of fame: retired entities kept forever, marked retired=true.
  // Their year history persists so we can show their career arc in popups.
  retiredDrivers: Driver[];
  retiredEngDirectors: EngineeringDirector[];
  retiredRaceDirectors: RaceDirector[];
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
  // Completed race results this season (for "results so far" listing in WC tab).
  // Maps round number → { qualifying, race }. Cleared on new season.
  completedRaces: Record<number, { qualifying: QualifyingResult; race: RaceResult }>;
  // Per-circuit history: every race ever run at each circuit name, persists
  // across seasons. Keyed by circuit name (since circuit IDs regenerate each
  // year). Used for "Last year here" callouts and the circuit detail popup.
  circuitHistory: Record<string, CircuitHistoryEntry[]>;
  // Preseason cache: the most recent end-of-year transition data so the user
  // can browse Summary / Market / Cars even after entering year N+1.
  lastPreseasonData?: PreseasonData;
}

// One race result at a given circuit, captured for the long-term circuit log.
// Stored under SeasonState.circuitHistory[circuitName].
export interface CircuitHistoryEntry {
  year: number;
  round: number;
  weather: Weather;
  winnerDriverId: string;
  winnerDriverName: string;     // captured so retirement / rename later doesn't break the row
  winnerTeamId: string;
  winnerTeamName: string;
  winnerTeamColor: string;
  poleDriverId: string;
  poleDriverName: string;
  fastestLapDriverId: string;
  fastestLapDriverName: string;
}

// Captured at end of each season — drives the Preseason sub-tab.
export interface PreseasonData {
  yearEnded: number;
  championDriverId: string;
  championDriverName: string;
  constructorChampionTeamId: string;
  mostWinsDriverId: string;
  mostPolesDriverId: string;     // driver with the most pole positions this season
  mostPolesCount: number;        // how many poles they took
  rookieOfYearDriverId: string | null;
  finalDriverStandings: Array<{ driverId: string; driverName: string; teamName: string; points: number; wins: number }>;
  finalTeamStandings: Array<{ teamId: string; teamName: string; points: number; wins: number }>;
  retirements: Array<{ name: string; rarity: Rarity; kind: 'driver' | 'engDirector' | 'raceDirector' }>;
  rookieArrivals: Array<{ name: string; rarity: Rarity }>;
  signings: Array<{ name: string; rarity: Rarity; toTeam: string; position: string }>;
  releases: Array<{ name: string; rarity: Rarity; fromTeam: string; kind: 'driver' | 'engDirector' | 'raceDirector' }>;
  carEvolution: Array<{
    teamId: string;
    teamName: string;
    teamColor: string;
    before: CarStats;
    after: CarStats;
  }>;
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

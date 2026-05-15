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

export interface CarStats {
  maxSpeed: number;       // 0-100
  acceleration: number;   // 0-100
  turning: number;        // 0-100
  reliability: number;    // 0-100, higher = lower DNF chance
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
  marketPoints: number;   // 13 or 17
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
  // Preseason cache: the most recent end-of-year transition data so the user
  // can browse Summary / Market / Cars even after entering year N+1.
  lastPreseasonData?: PreseasonData;
}

// Captured at end of each season — drives the Preseason sub-tab.
export interface PreseasonData {
  yearEnded: number;
  championDriverId: string;
  championDriverName: string;
  constructorChampionTeamId: string;
  mostWinsDriverId: string;
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

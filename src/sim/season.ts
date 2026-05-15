import {
  Driver, Team, EngineeringDirector, RaceDirector,
  SeasonState, GamePhase, Rarity, POOL_RARITY_TARGETS,
  RaceResult,
} from './types';
import {
  createDriver, createEngineeringDirector, createRaceDirector,
  createTeams, createCalendar, generateDriverPool, generateEngDirectorPool,
  generateRaceDirectorPool, rollCarStats,
} from './generators';
import { runDraft, applyEngDirectorsToCars, runInitialAssignment } from './market';
import { MarketMove } from './market';
import { RNG } from './rng';

// ============================================================================
// NEW GAME
// ============================================================================
export function createNewSeason(seed?: number): SeasonState {
  const rng = new RNG(seed ?? Date.now());

  const drivers = generateDriverPool(rng, 40);
  const engDirectors = generateEngDirectorPool(rng, 20);
  const raceDirectors = generateRaceDirectorPool(rng, 20);
  const teams = createTeams(rng);
  const calendar = createCalendar(rng);

  // Initial universe setup: weighted random (legends bias toward top teams).
  // This differs from the end-of-season draft which is strict worst-first.
  const draftResult = runInitialAssignment({
    teams,
    drivers,
    engDirectors,
    raceDirectors,
    previousStandingsWorstFirst: [],
    freeAgentDriverIds: drivers.map(d => d.id),
    freeAgentEngDirectorIds: engDirectors.map(e => e.id),
    freeAgentRaceDirectorIds: raceDirectors.map(r => r.id),
  }, rng);

  // Apply engineering director boosts to cars
  applyEngDirectorsToCars(teams, engDirectors);

  return {
    year: 1,
    drivers,
    teams,
    engineeringDirectors: engDirectors,
    raceDirectors,
    calendar,
    currentRound: 1,
    phase: 'season_start',
    driverStandings: drivers.map(d => ({ driverId: d.id, points: 0 })),
    teamStandings: teams.map(t => ({ teamId: t.id, points: 0 })),
    freeAgentDriverIds: draftResult.freeAgentDriverIds,
    freeAgentEngDirectorIds: draftResult.freeAgentEngDirectorIds,
    freeAgentRaceDirectorIds: draftResult.freeAgentRaceDirectorIds,
  };
}

// ============================================================================
// STANDINGS RECALC (after each race)
// ============================================================================
export function recalcStandings(state: SeasonState): void {
  state.driverStandings = state.drivers
    .map(d => ({ driverId: d.id, points: d.seasonPoints }))
    .sort((a, b) => b.points - a.points);

  state.teamStandings = state.teams
    .map(t => ({ teamId: t.id, points: t.seasonPoints }))
    .sort((a, b) => b.points - a.points);
}

// Apply a finished race result to season state (points, stats, injuries)
export function applyRaceResult(state: SeasonState, result: RaceResult): void {
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamByDriver = new Map<string, Team>();
  for (const t of state.teams) {
    if (t.driver1Id) teamByDriver.set(t.driver1Id, t);
    if (t.driver2Id) teamByDriver.set(t.driver2Id, t);
    if (t.testDriverId) teamByDriver.set(t.testDriverId, t);
  }

  // Award points
  for (const [driverId, pts] of Object.entries(result.pointsAwarded)) {
    const d = driverMap.get(driverId);
    if (d) {
      d.seasonPoints += pts;
      const team = teamByDriver.get(driverId);
      if (team) team.seasonPoints += pts;
    }
  }

  // Wins / podiums
  for (let i = 0; i < Math.min(3, result.finalRanking.length); i++) {
    const id = result.finalRanking[i];
    if (result.dnfs.includes(id)) continue;
    const d = driverMap.get(id);
    if (!d) continue;
    if (i === 0) {
      d.seasonWins++;
      d.careerWins++; // permanent counter, never reset
      const t = teamByDriver.get(id);
      if (t) t.seasonWins++;
    }
    d.seasonPodiums++;
  }

  // Race starts (counts everyone who lined up)
  const startedIds = new Set(result.finalRanking);
  for (const id of startedIds) {
    const d = driverMap.get(id);
    if (d) d.careerStarts++;
  }

  // Fastest lap
  const flDriver = driverMap.get(result.fastestLapDriverId);
  if (flDriver) flDriver.seasonFastestLaps++;

  // Apply injuries
  for (const inc of result.incidents) {
    if (inc.causesInjury) {
      const d = driverMap.get(inc.driverId);
      if (d) d.injuredRaces = Math.max(d.injuredRaces, inc.injuryRaces);
    }
  }

  recalcStandings(state);
}

// Apply pole position points (just stats, no championship points for pole in F1)
export function applyQualiResult(state: SeasonState, poleDriverId: string): void {
  const d = state.drivers.find(x => x.id === poleDriverId);
  if (d) d.seasonPoles++;
}

// Decrement injury counters at the start of each GP
export function decrementInjuries(state: SeasonState): void {
  for (const d of state.drivers) {
    if (d.injuredRaces > 0) d.injuredRaces--;
  }
}

// ============================================================================
// END OF SEASON: who retires, new rookies, new directors, new cars
// ============================================================================

export interface SeasonSummary {
  year: number;
  championDriverId: string;
  championTeamId: string;
  mostWinsDriverId: string;
  rookieOfYearDriverId: string | null;
  finalDriverStandings: { driverId: string; points: number }[];
  finalTeamStandings: { teamId: string; points: number }[];
}

export function buildSeasonSummary(state: SeasonState): SeasonSummary {
  recalcStandings(state);
  const champ = state.driverStandings[0]?.driverId ?? state.drivers[0].id;
  const champTeam = state.teamStandings[0]?.teamId ?? state.teams[0].id;
  // Most wins
  const mostWinsDriver = state.drivers
    .slice()
    .sort((a, b) => b.seasonWins - a.seasonWins)[0];
  // Rookie of the year: any year-1 driver with the most points
  const rookies = state.drivers.filter(d => d.age - d.careerStartAge === 0);
  const roy = rookies.length
    ? rookies.slice().sort((a, b) => b.seasonPoints - a.seasonPoints)[0]
    : null;
  return {
    year: state.year,
    championDriverId: champ,
    championTeamId: champTeam,
    mostWinsDriverId: mostWinsDriver.id,
    rookieOfYearDriverId: roy?.id ?? null,
    finalDriverStandings: state.driverStandings,
    finalTeamStandings: state.teamStandings,
  };
}

// Advance to a new season: age everyone, retire those past retirement, generate replacements,
// re-roll cars with random factor, run market draft.
export function advanceToNewSeason(state: SeasonState, rng: RNG): {
  retirementMoves: MarketMove[];
  marketMoves: MarketMove[];
  newCarChanges: Array<{ teamId: string; before: Team['car']; after: Team['car'] }>;
} {
  const retirementMoves: MarketMove[] = [];

  // Champion gets a championship credit
  recalcStandings(state);
  const champId = state.driverStandings[0]?.driverId;
  if (champId) {
    const champ = state.drivers.find(d => d.id === champId);
    if (champ) champ.careerChampionships++;
  }

  // Age everyone and detect retirements
  const retiringDriverIds = new Set<string>();
  for (const d of state.drivers) {
    d.age++;
    if (d.age > d.retirementAge) {
      retiringDriverIds.add(d.id);
      retirementMoves.push({
        kind: 'driver_retired',
        entityName: d.name,
        entityRarity: d.rarity,
      });
    } else if (d.age === d.retirementAge && !d.retirementAnnounced) {
      d.retirementAnnounced = true;
      // Note: announcement appears in market UI but not as a move
    }
  }

  // Directors: decrement remaining years
  const retiringEngIds = new Set<string>();
  for (const e of state.engineeringDirectors) {
    e.age++;
    e.yearsRemaining--;
    if (e.yearsRemaining <= 0) {
      retiringEngIds.add(e.id);
      retirementMoves.push({
        kind: 'director_retired',
        entityName: e.name,
        entityRarity: e.rarity,
        position: 'engDirector',
      });
    }
  }
  const retiringRaceIds = new Set<string>();
  for (const r of state.raceDirectors) {
    r.age++;
    r.yearsRemaining--;
    if (r.yearsRemaining <= 0) {
      retiringRaceIds.add(r.id);
      retirementMoves.push({
        kind: 'director_retired',
        entityName: r.name,
        entityRarity: r.rarity,
        position: 'raceDirector',
      });
    }
  }

  // Remove retired drivers/directors from pools and from teams
  state.drivers = state.drivers.filter(d => !retiringDriverIds.has(d.id));
  state.engineeringDirectors = state.engineeringDirectors.filter(e => !retiringEngIds.has(e.id));
  state.raceDirectors = state.raceDirectors.filter(r => !retiringRaceIds.has(r.id));

  // Vacate slots on teams
  for (const t of state.teams) {
    if (t.driver1Id && retiringDriverIds.has(t.driver1Id)) t.driver1Id = null;
    if (t.driver2Id && retiringDriverIds.has(t.driver2Id)) t.driver2Id = null;
    if (t.testDriverId && retiringDriverIds.has(t.testDriverId)) t.testDriverId = null;
    if (t.engDirectorId && retiringEngIds.has(t.engDirectorId)) t.engDirectorId = null;
    if (t.raceDirectorId && retiringRaceIds.has(t.raceDirectorId)) t.raceDirectorId = null;
  }

  // FIRING UNDERPERFORMERS:
  // Bottom-3-finishing drivers on each team risk being released if their team finished poorly
  // and they weren't the better driver. We keep this simple for now: each team releases
  // their lowest-scoring driver if the team finished outside the top 8.
  const teamStandingsRanked = state.teams.slice().sort((a, b) => b.seasonPoints - a.seasonPoints);
  for (let i = 8; i < teamStandingsRanked.length; i++) {
    const t = teamStandingsRanked[i];
    const d1 = t.driver1Id ? state.drivers.find(d => d.id === t.driver1Id) : null;
    const d2 = t.driver2Id ? state.drivers.find(d => d.id === t.driver2Id) : null;
    if (d1 && d2) {
      // Release whichever scored less - but only if they aren't legends (legends are safe)
      const weaker = d1.seasonPoints < d2.seasonPoints ? d1 : d2;
      if (weaker.rarity !== 'legend' && rng.chance(0.6)) {
        if (t.driver1Id === weaker.id) t.driver1Id = null;
        if (t.driver2Id === weaker.id) t.driver2Id = null;
        retirementMoves.push({
          kind: 'driver_released',
          entityName: weaker.name,
          entityRarity: weaker.rarity,
          fromTeam: t.name,
        });
      }
    }
    // Bottom-4 teams may also fire a director (not legends, lower chance for engineering since
    // they're harder to replace and we want some stability)
    if (i >= 8) {
      // Engineering director: 30% release chance if not legend
      if (t.engDirectorId) {
        const eng = state.engineeringDirectors.find(e => e.id === t.engDirectorId);
        if (eng && eng.rarity !== 'legend' && rng.chance(0.30)) {
          t.engDirectorId = null;
          retirementMoves.push({
            kind: 'director_released',
            entityName: eng.name,
            entityRarity: eng.rarity,
            fromTeam: t.name,
            position: 'engDirector',
          });
        }
      }
      // Race director: 40% release chance if not legend (race strategy is more visibly blameable)
      if (t.raceDirectorId) {
        const rd = state.raceDirectors.find(r => r.id === t.raceDirectorId);
        if (rd && rd.rarity !== 'legend' && rng.chance(0.40)) {
          t.raceDirectorId = null;
          retirementMoves.push({
            kind: 'director_released',
            entityName: rd.name,
            entityRarity: rd.rarity,
            fromTeam: t.name,
            position: 'raceDirector',
          });
        }
      }
    }
  }

  // Reset season-only stats on everyone
  for (const d of state.drivers) {
    d.seasonWins = 0;
    d.seasonPodiums = 0;
    d.seasonPoints = 0;
    d.seasonPoles = 0;
    d.seasonFastestLaps = 0;
  }
  for (const t of state.teams) {
    t.seasonPoints = 0;
    t.seasonWins = 0;
  }

  // Generate new rookies: fill the pool back to 40
  // The replacement rarity follows the pool target distribution
  while (state.drivers.length < 40) {
    const rarity = nextRarityToFill(state.drivers, rng);
    const newDriver = createDriver(rng, rarity);
    // Brand new rookies are age 23
    newDriver.age = 23;
    state.drivers.push(newDriver);
    retirementMoves.push({
      kind: 'rookie_arrived',
      entityName: newDriver.name,
      entityRarity: newDriver.rarity,
    });
  }
  // Generate new directors to keep pools at size 20
  while (state.engineeringDirectors.length < 20) {
    const rarity = nextDirectorRarityToFill(state.engineeringDirectors.map(e => e.rarity), rng);
    state.engineeringDirectors.push(createEngineeringDirector(rng, rarity));
  }
  while (state.raceDirectors.length < 20) {
    const rarity = nextDirectorRarityToFill(state.raceDirectors.map(r => r.rarity), rng);
    state.raceDirectors.push(createRaceDirector(rng, rarity));
  }

  // Re-roll cars with year-to-year variation
  const newCarChanges: Array<{ teamId: string; before: Team['car']; after: Team['car'] }> = [];
  for (const t of state.teams) {
    const before = { ...t.car };
    // The team's "true legacy" for this year drifts by ±2 from base.
    // Bottom (65) can fall to 63 or rise to 67; top (85) similar swing.
    const drift = rng.int(-2, 2);
    const yearLegacy = Math.max(50, Math.min(95, t.legacyBaseValue + drift));
    t.car = rollCarStats(rng, yearLegacy);
    newCarChanges.push({ teamId: t.id, before, after: { ...t.car } });
  }

  // Compute previous standings for draft order (worst first)
  const standingsWorstFirst = state.teams
    .slice()
    .sort((a, b) => {
      // We already reset season points - so use the pre-reset standings we cached.
      return 0;
    })
    .map(t => t.id);
  // Actually use the pre-reset standings: rebuild from teamStandings before reset
  const worstFirst = state.teamStandings.slice().reverse().map(s => s.teamId);

  // Mark all unassigned drivers/directors as free agents
  const assignedDriverIds = new Set<string>();
  const assignedEngIds = new Set<string>();
  const assignedRaceIds = new Set<string>();
  for (const t of state.teams) {
    if (t.driver1Id) assignedDriverIds.add(t.driver1Id);
    if (t.driver2Id) assignedDriverIds.add(t.driver2Id);
    if (t.testDriverId) assignedDriverIds.add(t.testDriverId);
    if (t.engDirectorId) assignedEngIds.add(t.engDirectorId);
    if (t.raceDirectorId) assignedRaceIds.add(t.raceDirectorId);
  }
  const freeDrivers = state.drivers.filter(d => !assignedDriverIds.has(d.id)).map(d => d.id);
  const freeEng = state.engineeringDirectors.filter(e => !assignedEngIds.has(e.id)).map(e => e.id);
  const freeRace = state.raceDirectors.filter(r => !assignedRaceIds.has(r.id)).map(r => r.id);

  // Run the draft to fill all vacancies
  const draft = runDraft({
    teams: state.teams,
    drivers: state.drivers,
    engDirectors: state.engineeringDirectors,
    raceDirectors: state.raceDirectors,
    previousStandingsWorstFirst: worstFirst.length === state.teams.length ? worstFirst : standingsWorstFirst,
    freeAgentDriverIds: freeDrivers,
    freeAgentEngDirectorIds: freeEng,
    freeAgentRaceDirectorIds: freeRace,
  }, rng);

  state.freeAgentDriverIds = draft.freeAgentDriverIds;
  state.freeAgentEngDirectorIds = draft.freeAgentEngDirectorIds;
  state.freeAgentRaceDirectorIds = draft.freeAgentRaceDirectorIds;

  // Apply eng director boosts to cars
  applyEngDirectorsToCars(state.teams, state.engineeringDirectors);

  // Generate a new calendar (weather re-rolls)
  state.calendar = createCalendar(rng);
  state.currentRound = 1;
  state.year++;
  state.phase = 'season_start';

  recalcStandings(state);

  return { retirementMoves, marketMoves: draft.moves, newCarChanges };
}

// Decide which rarity to add when replacing a retired driver, keeping pool balanced
function nextRarityToFill(currentDrivers: Driver[], rng: RNG): Rarity {
  const counts: Record<Rarity, number> = {
    legend: 0, epic: 0, rare: 0, uncommon: 0, common: 0,
  };
  for (const d of currentDrivers) counts[d.rarity]++;

  // Check each rarity tier from highest to lowest; fill the first one below its min target.
  const checkOrder: Rarity[] = ['legend', 'epic', 'rare', 'uncommon', 'common'];
  for (const r of checkOrder) {
    const [lo] = POOL_RARITY_TARGETS[r];
    if (counts[r] < lo) return r;
  }
  // Everyone is at min; weight toward commons.
  return rng.pickWeighted(['common','uncommon','rare','epic','legend'] as Rarity[],
                          [0.55, 0.25, 0.13, 0.05, 0.02]);
}

function nextDirectorRarityToFill(current: Rarity[], rng: RNG): Rarity {
  const counts: Record<Rarity, number> = {
    legend: 0, epic: 0, rare: 0, uncommon: 0, common: 0,
  };
  for (const r of current) counts[r]++;
  // Directors target: 1-2 legend, 1-2 epic, 2-3 rare, rest uncommon/common
  if (counts.legend < 1) return 'legend';
  if (counts.epic < 1) return 'epic';
  if (counts.rare < 2) return 'rare';
  return rng.pickWeighted(['common','uncommon'] as Rarity[], [0.6, 0.4]);
}

export function setPhase(state: SeasonState, phase: GamePhase): void {
  state.phase = phase;
}

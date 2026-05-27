import {
  Driver, Team, EngineeringDirector, RaceDirector,
  SeasonState, GamePhase, Rarity, POOL_RARITY_TARGETS,
  RaceResult, PreseasonData, DriverYearRecord,
  CircuitHistoryEntry, Weather, CarStats,
} from './types';
import {
  createDriver, createEngineeringDirector, createRaceDirector,
  createTeams, createCalendar, generateDriverPool, generateEngDirectorPool,
  generateRaceDirectorPool, rollCarStats,
} from './generators';
import {
  runDraft, applyEngDirectorsToCars, runInitialAssignment, runCarUpgradePass,
  updateChampionStreaks, runDriverLoyaltyShuffle, enforceCapCompliance,
  applyDoubleChampionCarRegression, revertTempCarUpgrades,
} from './market';
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
    retiredDrivers: [],
    retiredEngDirectors: [],
    retiredRaceDirectors: [],
    calendar,
    currentRound: 1,
    phase: 'menu',
    driverStandings: drivers.map(d => ({ driverId: d.id, points: 0 })),
    teamStandings: teams.map(t => ({ teamId: t.id, points: 0 })),
    freeAgentDriverIds: draftResult.freeAgentDriverIds,
    freeAgentEngDirectorIds: draftResult.freeAgentEngDirectorIds,
    freeAgentRaceDirectorIds: draftResult.freeAgentRaceDirectorIds,
    completedRaces: {},
    circuitHistory: {},
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

  // Wins / podiums (driver + team aggregate)
  for (let i = 0; i < Math.min(3, result.finalRanking.length); i++) {
    const id = result.finalRanking[i];
    if (result.dnfs.includes(id)) continue;
    const d = driverMap.get(id);
    if (!d) continue;
    const t = teamByDriver.get(id);
    if (i === 0) {
      d.seasonWins++;
      d.careerWins++;
      if (t) {
        t.seasonWins++;
        t.careerWins++;
      }
    }
    d.seasonPodiums++;
    d.careerPodiums++;
    if (t) {
      t.seasonPodiums++;
      t.careerPodiums++;
    }
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

// Apply pole position: driver + team stat tracking (no points in F1, pole is prestige).
export function applyQualiResult(state: SeasonState, poleDriverId: string): void {
  const d = state.drivers.find(x => x.id === poleDriverId);
  if (d) {
    d.seasonPoles++;
    d.careerPoles++;
  }
  // Also credit the team
  const team = state.teams.find(t =>
    t.driver1Id === poleDriverId || t.driver2Id === poleDriverId || t.testDriverId === poleDriverId
  );
  if (team) {
    team.seasonPoles++;
    team.careerPoles++;
  }
}

// Decrement injury counters at the start of each GP
export function decrementInjuries(state: SeasonState): void {
  for (const d of state.drivers) {
    if (d.injuredRaces > 0) d.injuredRaces--;
  }
}

// Append a circuit history entry after a race finishes. Keeps the per-circuit
// log (keyed by circuit name) so we can show "Last year here" and a circuit
// detail popup with all-time results.
export function recordCircuitHistory(
  state: SeasonState,
  circuitName: string,
  round: number,
  weather: Weather,
  poleDriverId: string,
  result: RaceResult
): void {
  // Resolve names from current state. We pull team via current team-by-driver
  // map; if the winner has already retired before we get here, this still
  // works because retired drivers are still in state.drivers at the moment
  // of this call (retirement happens at season transition, not mid-race).
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamByDriver = new Map<string, Team>();
  for (const t of state.teams) {
    if (t.driver1Id) teamByDriver.set(t.driver1Id, t);
    if (t.driver2Id) teamByDriver.set(t.driver2Id, t);
    if (t.testDriverId) teamByDriver.set(t.testDriverId, t);
  }
  const winnerId = result.finalRanking[0];
  const winner = driverMap.get(winnerId);
  const winnerTeam = teamByDriver.get(winnerId);
  const pole = driverMap.get(poleDriverId);
  const flDriver = driverMap.get(result.fastestLapDriverId);

  const entry: CircuitHistoryEntry = {
    year: state.year,
    round,
    weather,
    winnerDriverId: winnerId,
    winnerDriverName: winner?.name ?? 'Unknown',
    winnerTeamId: winnerTeam?.id ?? '',
    winnerTeamName: winnerTeam?.name ?? 'Unknown',
    winnerTeamColor: winnerTeam?.color ?? '#888',
    poleDriverId: poleDriverId,
    poleDriverName: pole?.name ?? 'Unknown',
    fastestLapDriverId: result.fastestLapDriverId,
    fastestLapDriverName: flDriver?.name ?? 'Unknown',
  };
  if (!state.circuitHistory[circuitName]) {
    state.circuitHistory[circuitName] = [];
  }
  state.circuitHistory[circuitName].push(entry);
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

// Snapshot one year's record onto every driver, team, and director's yearHistory.
// MUST be called BEFORE seasonal stats get reset.
function snapshotYearHistory(
  state: SeasonState,
  championDriverId: string | undefined,
  constructorChampTeamId: string | undefined,
): void {
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamByDriver = new Map<string, Team>();
  const teamByEng = new Map<string, Team>();
  const teamByRace = new Map<string, Team>();
  for (const t of state.teams) {
    if (t.driver1Id) teamByDriver.set(t.driver1Id, t);
    if (t.driver2Id) teamByDriver.set(t.driver2Id, t);
    if (t.testDriverId) teamByDriver.set(t.testDriverId, t);
    if (t.engDirectorId) teamByEng.set(t.engDirectorId, t);
    if (t.raceDirectorId) teamByRace.set(t.raceDirectorId, t);
  }
  const finalDriverStandingsByPos = state.driverStandings;
  const finalTeamStandingsByPos = state.teamStandings;

  // ---- Drivers ----
  for (const d of state.drivers) {
    const team = teamByDriver.get(d.id) ?? null;
    let position: DriverYearRecord['position'] = 'free_agent';
    if (team) {
      if (team.driver1Id === d.id) position = 'driver1';
      else if (team.driver2Id === d.id) position = 'driver2';
      else if (team.testDriverId === d.id) position = 'testDriver';
    }
    // Approximate races participated: career starts is cumulative — we use the count
    // of races this year as: full calendar length if not on test driver, minus injured races.
    // For test drivers we use 0 unless they filled in for an injured regular (which we
    // didn't track granularly). Good-enough approximation:
    const racesThisYear = position === 'driver1' || position === 'driver2'
      ? state.calendar.length
      : 0;
    d.yearHistory.push({
      year: state.year,
      teamId: team?.id ?? null,
      teamName: team?.name ?? '—',
      position,
      races: racesThisYear,
      wins: d.seasonWins,
      podiums: d.seasonPodiums,
      poles: d.seasonPoles,
      fastestLaps: d.seasonFastestLaps,
      points: d.seasonPoints,
      isWorldChampion: d.id === championDriverId,
      rarityAtTime: d.rarity,
    });
  }

  // ---- Teams ----
  for (const t of state.teams) {
    const standingPos = finalTeamStandingsByPos.findIndex(s => s.teamId === t.id) + 1;
    const isConstructorChamp = t.id === constructorChampTeamId;
    const driverChamp = championDriverId !== undefined && (
      t.driver1Id === championDriverId || t.driver2Id === championDriverId || t.testDriverId === championDriverId
    );
    if (isConstructorChamp) t.careerConstructorWC++;
    if (driverChamp) t.careerDriverWC++;
    const carAvg = (t.car.maxSpeed + t.car.acceleration + t.car.turning + t.car.reliability) / 4;
    t.yearHistory.push({
      year: state.year,
      finalPosition: standingPos || finalTeamStandingsByPos.length,
      points: t.seasonPoints,
      wins: t.seasonWins,
      podiums: t.seasonPodiums,
      poles: t.seasonPoles,
      driverWC: driverChamp,
      constructorWC: isConstructorChamp,
      carAvg,
      driver1Id: t.driver1Id,
      driver2Id: t.driver2Id,
      testDriverId: t.testDriverId,
      engDirectorId: t.engDirectorId,
      raceDirectorId: t.raceDirectorId,
    });
  }

  // ---- Directors ----
  // For each director, find their team this year and capture team's stats.
  // This is what powers "wins on teams they were part of" in the Directors history view.
  for (const eng of state.engineeringDirectors) {
    const team = teamByEng.get(eng.id);
    eng.yearHistory.push({
      year: state.year,
      teamId: team?.id ?? null,
      teamName: team?.name ?? '—',
      teamRaceWins: team?.seasonWins ?? 0,
      teamPodiums: team?.seasonPodiums ?? 0,
      teamPoles: team?.seasonPoles ?? 0,
      driverWC: team !== undefined && championDriverId !== undefined &&
        (team.driver1Id === championDriverId || team.driver2Id === championDriverId || team.testDriverId === championDriverId),
      constructorWC: team?.id === constructorChampTeamId,
      rarityAtTime: eng.rarity,
    });
  }
  for (const rd of state.raceDirectors) {
    const team = teamByRace.get(rd.id);
    rd.yearHistory.push({
      year: state.year,
      teamId: team?.id ?? null,
      teamName: team?.name ?? '—',
      teamRaceWins: team?.seasonWins ?? 0,
      teamPodiums: team?.seasonPodiums ?? 0,
      teamPoles: team?.seasonPoles ?? 0,
      driverWC: team !== undefined && championDriverId !== undefined &&
        (team.driver1Id === championDriverId || team.driver2Id === championDriverId || team.testDriverId === championDriverId),
      constructorWC: team?.id === constructorChampTeamId,
      rarityAtTime: rd.rarity,
    });
  }
  // Suppress unused-param warning
  void driverMap;
  void finalDriverStandingsByPos;
}

// Advance to a new season: snapshots year history, archives retirees, generates rookies,
// re-rolls cars, runs market. Returns rich PreseasonData for the UI.
export function advanceToNewSeason(state: SeasonState, rng: RNG): PreseasonData {
  // ---- 1) Recalc final standings (before any reset) ----
  recalcStandings(state);
  const championDriverId = state.driverStandings[0]?.driverId;
  const constructorChampTeamId = state.teamStandings[0]?.teamId;

  // The team whose driver won the WDC — needed for the championship-streak
  // cap penalty. Found by scanning team rosters for the champion driver.
  let wdcTeamId: string | null = null;
  if (championDriverId) {
    for (const t of state.teams) {
      if (t.driver1Id === championDriverId || t.driver2Id === championDriverId || t.testDriverId === championDriverId) {
        wdcTeamId = t.id;
        break;
      }
    }
  }
  // A team won the "double" if it took both the WDC and the WCC.
  const doubleChampTeamId = (wdcTeamId && wdcTeamId === constructorChampTeamId) ? wdcTeamId : null;

  // ---- 2) Credit the champion ----
  if (championDriverId) {
    const champ = state.drivers.find(d => d.id === championDriverId);
    if (champ) champ.careerChampionships++;
  }

  // ---- 3) Snapshot year history BEFORE any retirement or stat reset ----
  snapshotYearHistory(state, championDriverId, constructorChampTeamId);

  // ---- 4) Build the preseason summary data (uses current pre-reset state) ----
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamMap = new Map(state.teams.map(t => [t.id, t]));
  const teamByDriver = new Map<string, Team>();
  for (const t of state.teams) {
    if (t.driver1Id) teamByDriver.set(t.driver1Id, t);
    if (t.driver2Id) teamByDriver.set(t.driver2Id, t);
    if (t.testDriverId) teamByDriver.set(t.testDriverId, t);
  }
  const championDriver = championDriverId ? driverMap.get(championDriverId) : undefined;
  const mostWinsDriver = state.drivers.slice().sort((a, b) => b.seasonWins - a.seasonWins)[0];
  const mostPolesDriver = state.drivers.slice().sort((a, b) => b.seasonPoles - a.seasonPoles)[0];
  const rookies = state.drivers.filter(d => d.age - d.careerStartAge === 0);
  const roy = rookies.length
    ? rookies.slice().sort((a, b) => b.seasonPoints - a.seasonPoints)[0]
    : null;
  const finalDriverStandings = state.driverStandings.map(s => {
    const d = driverMap.get(s.driverId)!;
    const team = teamByDriver.get(d.id);
    return {
      driverId: s.driverId,
      driverName: d.name,
      teamName: team?.name ?? '—',
      points: s.points,
      wins: d.seasonWins,
    };
  });
  const finalTeamStandings = state.teamStandings.map(s => ({
    teamId: s.teamId,
    teamName: teamMap.get(s.teamId)?.name ?? '—',
    points: s.points,
    wins: teamMap.get(s.teamId)?.seasonWins ?? 0,
  }));

  // ---- 5) Age everyone and detect retirements ----
  const retiringDriverIds = new Set<string>();
  const retirements: PreseasonData['retirements'] = [];
  for (const d of state.drivers) {
    d.age++;
    if (d.age > d.retirementAge) {
      retiringDriverIds.add(d.id);
      d.retired = true;
      retirements.push({ name: d.name, rarity: d.rarity, kind: 'driver' });
    } else if (d.age === d.retirementAge && !d.retirementAnnounced) {
      d.retirementAnnounced = true;
    }
  }

  const retiringEngIds = new Set<string>();
  for (const e of state.engineeringDirectors) {
    e.age++;
    e.yearsRemaining--;
    if (e.yearsRemaining <= 0) {
      retiringEngIds.add(e.id);
      e.retired = true;
      retirements.push({ name: e.name, rarity: e.rarity, kind: 'engDirector' });
    }
  }
  const retiringRaceIds = new Set<string>();
  for (const r of state.raceDirectors) {
    r.age++;
    r.yearsRemaining--;
    if (r.yearsRemaining <= 0) {
      retiringRaceIds.add(r.id);
      r.retired = true;
      retirements.push({ name: r.name, rarity: r.rarity, kind: 'raceDirector' });
    }
  }

  // ---- 6) Move retirees to archives (kept forever for History tab) ----
  state.retiredDrivers.push(...state.drivers.filter(d => retiringDriverIds.has(d.id)));
  state.retiredEngDirectors.push(...state.engineeringDirectors.filter(e => retiringEngIds.has(e.id)));
  state.retiredRaceDirectors.push(...state.raceDirectors.filter(r => retiringRaceIds.has(r.id)));
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

  // ---- 7) Fire underperformers ----
  const releases: PreseasonData['releases'] = [];
  const teamStandingsRanked = state.teams.slice().sort((a, b) => b.seasonPoints - a.seasonPoints);
  for (let i = 8; i < teamStandingsRanked.length; i++) {
    const t = teamStandingsRanked[i];
    const d1 = t.driver1Id ? state.drivers.find(d => d.id === t.driver1Id) : null;
    const d2 = t.driver2Id ? state.drivers.find(d => d.id === t.driver2Id) : null;
    if (d1 && d2) {
      const weaker = d1.seasonPoints < d2.seasonPoints ? d1 : d2;
      if (weaker.rarity !== 'legend' && rng.chance(0.6)) {
        if (t.driver1Id === weaker.id) t.driver1Id = null;
        if (t.driver2Id === weaker.id) t.driver2Id = null;
        releases.push({ name: weaker.name, rarity: weaker.rarity, fromTeam: t.name, kind: 'driver' });
      }
    }
    // Director firing
    if (t.engDirectorId) {
      const eng = state.engineeringDirectors.find(e => e.id === t.engDirectorId);
      if (eng && eng.rarity !== 'legend' && rng.chance(0.30)) {
        t.engDirectorId = null;
        releases.push({ name: eng.name, rarity: eng.rarity, fromTeam: t.name, kind: 'engDirector' });
      }
    }
    if (t.raceDirectorId) {
      const rd = state.raceDirectors.find(r => r.id === t.raceDirectorId);
      if (rd && rd.rarity !== 'legend' && rng.chance(0.40)) {
        t.raceDirectorId = null;
        releases.push({ name: rd.name, rarity: rd.rarity, fromTeam: t.name, kind: 'raceDirector' });
      }
    }
  }

  // ---- 8) Reset season-only stats ----
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
    t.seasonPodiums = 0;
    t.seasonPoles = 0;
  }

  // ---- 9) Generate new rookies and replacement directors ----
  // Targets match POOL_RARITY_TARGETS sums + a healthy free agent surplus.
  // 50 drivers = 36 team-signed max + ~14 free agents. 28 directors per kind
  // = 12 team-assigned + ~16 free agents per kind.
  const rookieArrivals: PreseasonData['rookieArrivals'] = [];
  while (state.drivers.length < 54) {
    const rarity = nextRarityToFill(state.drivers, rng);
    const newDriver = createDriver(rng, rarity);
    newDriver.age = 23;
    state.drivers.push(newDriver);
    rookieArrivals.push({ name: newDriver.name, rarity: newDriver.rarity });
  }
  while (state.engineeringDirectors.length < 28) {
    const rarity = nextDirectorRarityToFill(state.engineeringDirectors.map(e => e.rarity), rng);
    state.engineeringDirectors.push(createEngineeringDirector(rng, rarity));
  }
  while (state.raceDirectors.length < 28) {
    const rarity = nextDirectorRarityToFill(state.raceDirectors.map(r => r.rarity), rng);
    state.raceDirectors.push(createRaceDirector(rng, rarity));
  }

  // ---- 10) Update championship streaks ----
  // Must run before the draft so effectiveCap reflects the new penalty.
  // The WDC team's streak grows by 1; everyone else resets to 0 (cap restored).
  updateChampionStreaks(state.teams, wdcTeamId);

  // ---- 11) Re-roll cars ----
  // tempCarUpgrade is reverted implicitly here — re-rolling t.car replaces the
  // previous car wholesale, so the previous year's temp upgrade is gone. The
  // Team-level marker is set to null so a fresh upgrade can be applied later.
  //
  // Drift is biased by finishing position to prevent dynasty compounding.
  // The reigning constructors champion gets the harshest pullback, bottom
  // teams a meaningful boost — the F1 reality of rivals copying winning designs
  // while backmarkers benefit from radical redesigns. A team that won BOTH
  // titles takes an additional guaranteed regression on top of this.
  const positionByTeam = new Map<string, number>();
  state.teamStandings.forEach((s, i) => positionByTeam.set(s.teamId, i + 1));
  const carBefore: Record<string, CarStats> = {};
  for (const t of state.teams) {
    carBefore[t.id] = { ...t.car };
    const pos = positionByTeam.get(t.id) ?? 6;
    // Drift range:
    //   P1  → [-5, -2]  (champion regression)
    //   P6  → [-2, +2]  (mid-pack: normal variance)
    //   P12 → [+1, +5]  (cellar dweller: meaningful boost)
    const t01 = (pos - 1) / 11; // 0 at P1, 1 at P12
    const driftMin = Math.round(-5 + t01 * 6);  // -5 → +1
    const driftMax = Math.round(-2 + t01 * 7);  // -2 → +5
    const drift = rng.int(driftMin, driftMax);
    const yearLegacy = Math.max(50, Math.min(95, t.legacyBaseValue + drift));
    t.car = rollCarStats(rng, yearLegacy);
    t.tempCarUpgrade = null;
    // Double champion: guaranteed extra car regression, no randomness in
    // whether it happens (only in the stat distribution).
    if (doubleChampTeamId && t.id === doubleChampTeamId) {
      applyDoubleChampionCarRegression(t.car, rng);
    }
  }

  // ---- 11b) Driver loyalty shuffle ----
  // Some drivers request a move and enter free agency before the draft.
  const loyaltyDepartures = runDriverLoyaltyShuffle(
    state.teams, state.drivers, constructorChampTeamId ?? null, rng
  );

  // ---- 11) Run draft (worst-first based on the just-finished standings) ----
  const worstFirst = state.teamStandings.slice().reverse().map(s => s.teamId);
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

  const draft = runDraft({
    teams: state.teams,
    drivers: state.drivers,
    engDirectors: state.engineeringDirectors,
    raceDirectors: state.raceDirectors,
    previousStandingsWorstFirst: worstFirst,
    freeAgentDriverIds: freeDrivers,
    freeAgentEngDirectorIds: freeEng,
    freeAgentRaceDirectorIds: freeRace,
  }, rng);

  const signings: PreseasonData['signings'] = draft.moves
    .filter(m => m.kind === 'driver_signed' || m.kind === 'director_signed')
    .map(m => ({
      name: m.entityName,
      rarity: m.entityRarity!,
      toTeam: m.toTeam!,
      position: m.position ?? '',
    }));

  state.freeAgentDriverIds = draft.freeAgentDriverIds;
  state.freeAgentEngDirectorIds = draft.freeAgentEngDirectorIds;
  state.freeAgentRaceDirectorIds = draft.freeAgentRaceDirectorIds;

  // ---- 12) Off-season cap enforcement ----
  // After the draft + replacement passes, force every team within its
  // effective cap (which may be reduced by the championship streak penalty).
  // Resolution: release the strongest person to free agency, repeat until
  // legal; only regress the car as a last resort. This is what makes the
  // champion cap penalty bite — a docked team is forced to shed a star.
  const capReleases = enforceCapCompliance(
    state.teams, state.drivers, state.engineeringDirectors, state.raceDirectors
  );
  // Fold loyalty departures + cap-enforcement releases into the preseason
  // releases report so they show up in the Market sub-tab.
  for (const dep of loyaltyDepartures) {
    releases.push({ name: dep.name, rarity: dep.rarity, fromTeam: dep.fromTeam, kind: 'driver' });
  }
  for (const rel of capReleases) {
    releases.push({ name: rel.name, rarity: rel.rarity, fromTeam: rel.fromTeam, kind: rel.kind });
  }
  // Rebuild free agent lists — cap enforcement may have released people.
  {
    const assignedD = new Set<string>();
    const assignedE = new Set<string>();
    const assignedR = new Set<string>();
    for (const t of state.teams) {
      if (t.driver1Id) assignedD.add(t.driver1Id);
      if (t.driver2Id) assignedD.add(t.driver2Id);
      if (t.testDriverId) assignedD.add(t.testDriverId);
      if (t.engDirectorId) assignedE.add(t.engDirectorId);
      if (t.raceDirectorId) assignedR.add(t.raceDirectorId);
    }
    state.freeAgentDriverIds = state.drivers.filter(d => !assignedD.has(d.id)).map(d => d.id);
    state.freeAgentEngDirectorIds = state.engineeringDirectors.filter(e => !assignedE.has(e.id)).map(e => e.id);
    state.freeAgentRaceDirectorIds = state.raceDirectors.filter(r => !assignedR.has(r.id)).map(r => r.id);
  }

  // ---- 13) Car upgrade pass: teams with exactly 3 spare points upgrade their car ----
  // Stored on the team as tempCarUpgrade so it can be reverted next preseason.
  runCarUpgradePass(state.teams, state.drivers, state.engineeringDirectors, state.raceDirectors, rng);

  // ---- 14) Build car evolution snapshot (after re-roll AND any temp upgrade) ----
  const carEvolution: PreseasonData['carEvolution'] = state.teams.map(t => ({
    teamId: t.id,
    teamName: t.name,
    teamColor: t.color,
    before: carBefore[t.id],
    after: { ...t.car },
  }));

  // ---- 15) Apply eng director boosts to new cars ----
  applyEngDirectorsToCars(state.teams, state.engineeringDirectors);

  // ---- 15) Bump year, generate new calendar ----
  state.calendar = createCalendar(rng);
  state.currentRound = 1;
  state.year++;
  state.completedRaces = {};
  state.lastQualiResult = undefined;
  state.lastRaceResult = undefined;
  state.phase = 'preseason';

  recalcStandings(state);

  // ---- 16) Build and cache PreseasonData ----
  const preseasonData: PreseasonData = {
    yearEnded: state.year - 1,
    championDriverId: championDriverId ?? '',
    championDriverName: championDriver?.name ?? '—',
    constructorChampionTeamId: constructorChampTeamId ?? '',
    mostWinsDriverId: mostWinsDriver?.id ?? '',
    mostPolesDriverId: mostPolesDriver?.id ?? '',
    mostPolesCount: mostPolesDriver?.seasonPoles ?? 0,
    rookieOfYearDriverId: roy?.id ?? null,
    finalDriverStandings,
    finalTeamStandings,
    retirements,
    rookieArrivals,
    signings,
    releases,
    carEvolution,
  };
  state.lastPreseasonData = preseasonData;

  return preseasonData;
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

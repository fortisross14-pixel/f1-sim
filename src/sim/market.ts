import {
  Team, Driver, EngineeringDirector, RaceDirector,
  RARITY_COST, Rarity,
} from './types';
import { carStatsWithDirector } from './generators';
import { RNG } from './rng';

// Combined cost cap across all three driver slots (driver1 + driver2 + testDriver).
// Prevents teams from stacking Legend + Legend or Legend + Epic on the driving squad,
// even if their budget would allow it. Forces the "you have a legend, surround them
// with rookies/journeymen" trade-off.
export const DRIVING_SQUAD_CAP = 6;

// Compute current cost of a team's driving squad (driver1 + driver2 + testDriver).
function currentSquadCost(team: Team, driverMap: Map<string, Driver>): number {
  let cost = 0;
  for (const id of [team.driver1Id, team.driver2Id, team.testDriverId]) {
    if (id && driverMap.has(id)) cost += RARITY_COST[driverMap.get(id)!.rarity];
  }
  return cost;
}

// Market move log entry shown to the user.
export interface MarketMove {
  kind: 'driver_signed' | 'driver_released' | 'director_signed' | 'director_released' |
        'driver_retired' | 'director_retired' | 'rookie_arrived';
  entityName: string;
  entityRarity?: Rarity;
  fromTeam?: string;
  toTeam?: string;
  position?: 'driver1' | 'driver2' | 'testDriver' | 'engDirector' | 'raceDirector';
}

// Compute "car points" cost: avg(car_skills_with_eng_dir) - 50, divided by 5, rounded.
// Per spec: "Car adds their average skill for next year minus 50 and the result over 5"
// Important nuance: this is computed BEFORE eng director is hired (using base car stats only),
// because the team draft has to know how much budget it has for personnel.
export function carPointCost(team: Team): number {
  const c = team.car;
  const avg = (c.maxSpeed + c.acceleration + c.turning + c.reliability) / 4;
  return Math.max(0, Math.round((avg - 50) / 5));
}

// What a team currently has signed costs, in market points.
export function currentPersonnelCost(
  team: Team,
  drivers: Driver[],
  engDirs: EngineeringDirector[],
  raceDirs: RaceDirector[]
): number {
  let cost = 0;
  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const engMap = new Map(engDirs.map(e => [e.id, e]));
  const rdMap = new Map(raceDirs.map(r => [r.id, r]));

  for (const id of [team.driver1Id, team.driver2Id, team.testDriverId]) {
    if (id && driverMap.has(id)) cost += RARITY_COST[driverMap.get(id)!.rarity];
  }
  if (team.engDirectorId && engMap.has(team.engDirectorId)) {
    cost += RARITY_COST[engMap.get(team.engDirectorId)!.rarity];
  }
  if (team.raceDirectorId && rdMap.has(team.raceDirectorId)) {
    cost += RARITY_COST[rdMap.get(team.raceDirectorId)!.rarity];
  }
  return cost;
}

export function remainingPoints(
  team: Team,
  drivers: Driver[],
  engDirs: EngineeringDirector[],
  raceDirs: RaceDirector[]
): number {
  return team.marketPoints - carPointCost(team) - currentPersonnelCost(team, drivers, engDirs, raceDirs);
}

// ============================================================================
// DRAFT ORDER & SLOT NEED
// ============================================================================

// A team's "slot needs" are which positions are vacant.
function vacantSlots(t: Team): Array<'driver1' | 'driver2' | 'testDriver' | 'engDirector' | 'raceDirector'> {
  const slots: Array<'driver1' | 'driver2' | 'testDriver' | 'engDirector' | 'raceDirector'> = [];
  if (!t.driver1Id) slots.push('driver1');
  if (!t.driver2Id) slots.push('driver2');
  if (!t.testDriverId) slots.push('testDriver');
  if (!t.engDirectorId) slots.push('engDirector');
  if (!t.raceDirectorId) slots.push('raceDirector');
  return slots;
}

function assignToSlot(
  team: Team,
  slot: 'driver1' | 'driver2' | 'testDriver' | 'engDirector' | 'raceDirector',
  entityId: string
): void {
  if (slot === 'driver1') team.driver1Id = entityId;
  else if (slot === 'driver2') team.driver2Id = entityId;
  else if (slot === 'testDriver') team.testDriverId = entityId;
  else if (slot === 'engDirector') team.engDirectorId = entityId;
  else if (slot === 'raceDirector') team.raceDirectorId = entityId;
}

// ============================================================================
// MAIN DRAFT - called once at the start of each season's market
// ============================================================================

export interface DraftInput {
  teams: Team[];
  drivers: Driver[];
  engDirectors: EngineeringDirector[];
  raceDirectors: RaceDirector[];
  // Standings order from previous season (worst to best). Used for draft order.
  // If empty (first season), we use reverse tier order: bottom teams first.
  previousStandingsWorstFirst: string[]; // teamIds
  freeAgentDriverIds: string[];
  freeAgentEngDirectorIds: string[];
  freeAgentRaceDirectorIds: string[];
}

export interface DraftResult {
  moves: MarketMove[];
  freeAgentDriverIds: string[];
  freeAgentEngDirectorIds: string[];
  freeAgentRaceDirectorIds: string[];
}

export function runDraft(input: DraftInput, rng: RNG): DraftResult {
  const { teams, drivers, engDirectors, raceDirectors } = input;
  const moves: MarketMove[] = [];

  // Working sets of available entities
  const availDrivers = new Set(input.freeAgentDriverIds);
  const availEng = new Set(input.freeAgentEngDirectorIds);
  const availRace = new Set(input.freeAgentRaceDirectorIds);

  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const engMap = new Map(engDirectors.map(e => [e.id, e]));
  const rdMap = new Map(raceDirectors.map(r => [r.id, r]));
  const teamMap = new Map(teams.map(t => [t.id, t]));

  // Draft order: worst-ranked team picks first.
  let draftOrder: Team[];
  if (input.previousStandingsWorstFirst.length === teams.length) {
    draftOrder = input.previousStandingsWorstFirst
      .map(id => teamMap.get(id))
      .filter((t): t is Team => !!t);
  } else {
    // First-season fallback: bottom tier first, then mid, then top.
    const order: Team[] = [];
    for (const tier of ['bottom', 'mid', 'top'] as const) {
      const tierTeams = teams.filter(t => t.tier === tier);
      order.push(...rng.shuffle(tierTeams));
    }
    draftOrder = order;
  }

  // Multiple draft rounds: each round, every team gets to fill one slot if they have points and need.
  // We loop until no team can pick anything.
  let safetyCounter = 0;
  while (safetyCounter++ < 30) {
    let anyPicked = false;

    for (const team of draftOrder) {
      const slots = vacantSlots(team);
      if (slots.length === 0) continue;
      const remaining = remainingPoints(team, drivers, engDirectors, raceDirectors);
      if (remaining <= 0 && !canSignZeroCost(slots, availDrivers, availEng, availRace, driverMap, engMap, rdMap)) {
        continue;
      }

      // Decide which slot to fill next (priority: driver1, driver2, engDirector, raceDirector, testDriver)
      const priorityOrder: typeof slots = ['driver1', 'driver2', 'engDirector', 'raceDirector', 'testDriver'];
      const slot = priorityOrder.find(s => slots.includes(s));
      if (!slot) continue;

      // Pick the best available entity that fits the budget
      const picked = pickBestForSlot(team, slot, remaining, availDrivers, availEng, availRace, driverMap, engMap, rdMap);
      if (!picked) continue;

      assignToSlot(team, slot, picked.id);
      if (picked.kind === 'driver') {
        availDrivers.delete(picked.id);
        moves.push({
          kind: 'driver_signed',
          entityName: picked.name,
          entityRarity: picked.rarity,
          toTeam: team.name,
          position: slot as 'driver1' | 'driver2' | 'testDriver',
        });
      } else if (picked.kind === 'eng') {
        availEng.delete(picked.id);
        moves.push({
          kind: 'director_signed',
          entityName: picked.name,
          entityRarity: picked.rarity,
          toTeam: team.name,
          position: 'engDirector',
        });
      } else {
        availRace.delete(picked.id);
        moves.push({
          kind: 'director_signed',
          entityName: picked.name,
          entityRarity: picked.rarity,
          toTeam: team.name,
          position: 'raceDirector',
        });
      }
      anyPicked = true;
    }

    if (!anyPicked) break;
  }

  // Balance pass: any team with 5+ unused points "splurges" on a legend/epic driver
  // from the free agent pool to use their budget headroom.
  // This is bounded by the driving squad cap so a team can't end up Legend+Legend.
  for (const team of draftOrder) {
    const rem = remainingPoints(team, drivers, engDirectors, raceDirectors);
    if (rem < 5) continue;
    const slots = vacantSlots(team);
    const driverSlots = slots.filter(s => s === 'driver1' || s === 'driver2' || s === 'testDriver');
    if (driverSlots.length === 0) continue;

    const currentSquad = currentSquadCost(team, driverMap);
    const squadHeadroom = DRIVING_SQUAD_CAP - currentSquad;
    if (squadHeadroom <= 0) continue; // squad cap reached

    const effectiveBudget = Math.min(rem, squadHeadroom);
    const targets = ['legend', 'epic', 'rare'] as Rarity[];
    for (const r of targets) {
      if (RARITY_COST[r] > effectiveBudget) continue;
      const fa = [...availDrivers]
        .map(id => driverMap.get(id)!)
        .filter(d => d.rarity === r);
      if (fa.length === 0) continue;
      const pick = rng.pick(fa);
      const slot = driverSlots.includes('driver1') ? 'driver1'
                 : driverSlots.includes('driver2') ? 'driver2'
                 : 'testDriver';
      assignToSlot(team, slot, pick.id);
      availDrivers.delete(pick.id);
      moves.push({
        kind: 'driver_signed',
        entityName: pick.name,
        entityRarity: pick.rarity,
        toTeam: team.name,
        position: slot,
      });
      break;
    }
  }

  return {
    moves,
    freeAgentDriverIds: [...availDrivers],
    freeAgentEngDirectorIds: [...availEng],
    freeAgentRaceDirectorIds: [...availRace],
  };
}

// Find the best entity for a given slot within the team's budget.
// "Best" = highest rarity that fits, with ties broken by skill where applicable.
type PickedEntity =
  | { kind: 'driver'; id: string; name: string; rarity: Rarity }
  | { kind: 'eng';    id: string; name: string; rarity: Rarity }
  | { kind: 'race';   id: string; name: string; rarity: Rarity };

function pickBestForSlot(
  team: Team,
  slot: 'driver1' | 'driver2' | 'testDriver' | 'engDirector' | 'raceDirector',
  budget: number,
  availDrivers: Set<string>,
  availEng: Set<string>,
  availRace: Set<string>,
  driverMap: Map<string, Driver>,
  engMap: Map<string, EngineeringDirector>,
  rdMap: Map<string, RaceDirector>
): PickedEntity | null {
  if (slot === 'driver1' || slot === 'driver2' || slot === 'testDriver') {
    // Enforce the driving squad cap: combined rarity cost of all 3 driver slots <= 6.
    // The new driver's cost can't push the squad total above 6.
    const currentSquad = currentSquadCost(team, driverMap);
    const squadHeadroom = DRIVING_SQUAD_CAP - currentSquad;
    const effectiveBudget = Math.min(budget, squadHeadroom);
    const list = [...availDrivers]
      .map(id => driverMap.get(id)!)
      .filter(d => RARITY_COST[d.rarity] <= effectiveBudget);
    if (list.length === 0) return null;
    // Sort: rarity desc, then average skill desc
    list.sort((a, b) => {
      const ra = RARITY_COST[a.rarity] - RARITY_COST[b.rarity];
      if (ra !== 0) return -ra;
      return avgSkill(b) - avgSkill(a);
    });
    // Test driver tends to be a weaker pick (per spec)
    const target = slot === 'testDriver' ? list[list.length - 1] : list[0];
    return { kind: 'driver', id: target.id, name: target.name, rarity: target.rarity };
  } else if (slot === 'engDirector') {
    const list = [...availEng]
      .map(id => engMap.get(id)!)
      .filter(e => RARITY_COST[e.rarity] <= budget);
    if (list.length === 0) return null;
    list.sort((a, b) => RARITY_COST[b.rarity] - RARITY_COST[a.rarity]);
    return { kind: 'eng', id: list[0].id, name: list[0].name, rarity: list[0].rarity };
  } else {
    const list = [...availRace]
      .map(id => rdMap.get(id)!)
      .filter(r => RARITY_COST[r.rarity] <= budget);
    if (list.length === 0) return null;
    list.sort((a, b) => RARITY_COST[b.rarity] - RARITY_COST[a.rarity]);
    return { kind: 'race', id: list[0].id, name: list[0].name, rarity: list[0].rarity };
  }
}

function avgSkill(d: Driver): number {
  const s = d.potentialSkills;
  return (s.driving + s.physical + s.carSetup + s.speed) / 4;
}

// True if any vacant slot has at least one available common-rarity entity
function canSignZeroCost(
  slots: Array<'driver1' | 'driver2' | 'testDriver' | 'engDirector' | 'raceDirector'>,
  availDrivers: Set<string>,
  availEng: Set<string>,
  availRace: Set<string>,
  driverMap: Map<string, Driver>,
  engMap: Map<string, EngineeringDirector>,
  rdMap: Map<string, RaceDirector>
): boolean {
  const hasZero = (rarity: Rarity) => RARITY_COST[rarity] === 0;
  for (const s of slots) {
    if (s === 'driver1' || s === 'driver2' || s === 'testDriver') {
      for (const id of availDrivers) if (hasZero(driverMap.get(id)!.rarity)) return true;
    } else if (s === 'engDirector') {
      for (const id of availEng) if (hasZero(engMap.get(id)!.rarity)) return true;
    } else {
      for (const id of availRace) if (hasZero(rdMap.get(id)!.rarity)) return true;
    }
  }
  return false;
}

// Apply post-director boost to car stats for the season.
// Called after the draft completes.
export function applyEngDirectorsToCars(
  teams: Team[],
  engDirectors: EngineeringDirector[]
): void {
  const engMap = new Map(engDirectors.map(e => [e.id, e]));
  for (const t of teams) {
    if (t.engDirectorId && engMap.has(t.engDirectorId)) {
      t.car = carStatsWithDirector(t.car, engMap.get(t.engDirectorId)!);
    }
  }
}

// ============================================================================
// INITIAL UNIVERSE ASSIGNMENT
// Used only when a new game starts (year 1). Unlike the end-of-season draft
// which is worst-first (so bottom teams get rookie legends), the initial setup
// is *biased random*: legends and epics are more likely to land on top teams,
// rookies/commons on bottom teams. This sets up the realistic "Ferrari has the
// legendary driver" starting state. The end-of-season draft then redistributes
// over time.
// ============================================================================

// Tier weight matrix: for each rarity, how likely is each tier to be picked.
// Higher = more likely. These are relative weights.
const INITIAL_TIER_WEIGHTS: Record<Rarity, Record<'top' | 'mid' | 'bottom', number>> = {
  legend:   { top: 5, mid: 2, bottom: 1 },  // legends overwhelmingly top
  epic:     { top: 4, mid: 3, bottom: 1 },  // epics mostly top/mid
  rare:     { top: 2, mid: 3, bottom: 2 },  // rares spread across
  uncommon: { top: 1, mid: 2, bottom: 3 },  // uncommons bias lower
  common:   { top: 1, mid: 1, bottom: 2 },  // commons fill in
};

export function runInitialAssignment(input: DraftInput, rng: RNG): DraftResult {
  const { teams, drivers, engDirectors, raceDirectors } = input;
  const moves: MarketMove[] = [];

  const availDrivers = new Set(input.freeAgentDriverIds);
  const availEng = new Set(input.freeAgentEngDirectorIds);
  const availRace = new Set(input.freeAgentRaceDirectorIds);

  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const engMap = new Map(engDirectors.map(e => [e.id, e]));
  const rdMap = new Map(raceDirectors.map(r => [r.id, r]));

  // ---- Drivers: assign from highest rarity to lowest ----
  // Within each rarity, shuffle drivers and try to place each on a tier-weighted team.
  const rarityOrder: Rarity[] = ['legend', 'epic', 'rare', 'uncommon', 'common'];
  for (const rarity of rarityOrder) {
    const driversOfRarity = rng.shuffle(
      [...availDrivers].map(id => driverMap.get(id)!).filter(d => d.rarity === rarity)
    );
    for (const d of driversOfRarity) {
      // Find teams with vacant driver slots that can afford this driver
      const eligible = teams.filter(t => {
        const slots = vacantSlots(t).filter(s => s === 'driver1' || s === 'driver2' || s === 'testDriver');
        if (slots.length === 0) return false;
        const rem = remainingPoints(t, drivers, engDirectors, raceDirectors);
        if (rem < RARITY_COST[d.rarity]) return false;
        const squadCost = currentSquadCost(t, driverMap);
        if (squadCost + RARITY_COST[d.rarity] > DRIVING_SQUAD_CAP) return false;
        return true;
      });
      if (eligible.length === 0) continue; // driver becomes free agent

      // Weighted pick by tier
      const weights = eligible.map(t => INITIAL_TIER_WEIGHTS[d.rarity][t.tier]);
      const team = rng.pickWeighted(eligible, weights);
      // Fill the highest-priority vacant driver slot
      const driverSlots = vacantSlots(team).filter(s => s === 'driver1' || s === 'driver2' || s === 'testDriver');
      const slot = (driverSlots.includes('driver1') ? 'driver1'
                  : driverSlots.includes('driver2') ? 'driver2'
                  : 'testDriver') as 'driver1' | 'driver2' | 'testDriver';
      assignToSlot(team, slot, d.id);
      availDrivers.delete(d.id);
      moves.push({
        kind: 'driver_signed',
        entityName: d.name,
        entityRarity: d.rarity,
        toTeam: team.name,
        position: slot,
      });
    }
  }

  // ---- Engineering Directors: same tier-weighted approach ----
  for (const rarity of rarityOrder) {
    const list = rng.shuffle(
      [...availEng].map(id => engMap.get(id)!).filter(e => e.rarity === rarity)
    );
    for (const e of list) {
      const eligible = teams.filter(t => {
        if (t.engDirectorId) return false;
        const rem = remainingPoints(t, drivers, engDirectors, raceDirectors);
        return rem >= RARITY_COST[e.rarity];
      });
      if (eligible.length === 0) continue;
      const weights = eligible.map(t => INITIAL_TIER_WEIGHTS[e.rarity][t.tier]);
      const team = rng.pickWeighted(eligible, weights);
      team.engDirectorId = e.id;
      availEng.delete(e.id);
      moves.push({
        kind: 'director_signed',
        entityName: e.name,
        entityRarity: e.rarity,
        toTeam: team.name,
        position: 'engDirector',
      });
    }
  }

  // ---- Race Directors ----
  for (const rarity of rarityOrder) {
    const list = rng.shuffle(
      [...availRace].map(id => rdMap.get(id)!).filter(r => r.rarity === rarity)
    );
    for (const r of list) {
      const eligible = teams.filter(t => {
        if (t.raceDirectorId) return false;
        const rem = remainingPoints(t, drivers, engDirectors, raceDirectors);
        return rem >= RARITY_COST[r.rarity];
      });
      if (eligible.length === 0) continue;
      const weights = eligible.map(t => INITIAL_TIER_WEIGHTS[r.rarity][t.tier]);
      const team = rng.pickWeighted(eligible, weights);
      team.raceDirectorId = r.id;
      availRace.delete(r.id);
      moves.push({
        kind: 'director_signed',
        entityName: r.name,
        entityRarity: r.rarity,
        toTeam: team.name,
        position: 'raceDirector',
      });
    }
  }

  // ---- Fallback fill: any team with empty slots gets commons/uncommons from free agents ----
  // After the weighted random pass, some teams may have unfilled slots (especially test driver).
  // Greedy-fill them with the cheapest available entity.
  for (const team of teams) {
    let safety = 0;
    while (safety++ < 10) {
      const slots = vacantSlots(team);
      if (slots.length === 0) break;
      const rem = remainingPoints(team, drivers, engDirectors, raceDirectors);
      const slot = slots[0];
      const picked = pickBestForSlot(team, slot, rem, availDrivers, availEng, availRace, driverMap, engMap, rdMap);
      if (!picked) break;
      assignToSlot(team, slot, picked.id);
      if (picked.kind === 'driver') availDrivers.delete(picked.id);
      else if (picked.kind === 'eng') availEng.delete(picked.id);
      else availRace.delete(picked.id);
      moves.push({
        kind: picked.kind === 'driver' ? 'driver_signed' : 'director_signed',
        entityName: picked.name,
        entityRarity: picked.rarity,
        toTeam: team.name,
        position: slot,
      });
    }
  }

  return {
    moves,
    freeAgentDriverIds: [...availDrivers],
    freeAgentEngDirectorIds: [...availEng],
    freeAgentRaceDirectorIds: [...availRace],
  };
}

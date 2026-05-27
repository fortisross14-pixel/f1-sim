import {
  Team, Driver, EngineeringDirector, RaceDirector,
  RARITY_COST, Rarity, TempCarUpgrade, CarStats,
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

// A team's effective budget cap for the season. Base cap (13 or 17) minus
// the championship-streak penalty: each consecutive WDC costs 1 cap point,
// unbounded. A 4-time-champion team runs at base − 4, which typically forces
// them to sell a legend or epic. The penalty vanishes entirely (cap restored)
// the first year they fail to win the WDC.
export function effectiveCap(team: Team): number {
  return team.marketPoints - team.championStreak;
}

export function remainingPoints(
  team: Team,
  drivers: Driver[],
  engDirs: EngineeringDirector[],
  raceDirs: RaceDirector[]
): number {
  return effectiveCap(team) - carPointCost(team) - currentPersonnelCost(team, drivers, engDirs, raceDirs);
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

  // ---- Replacement pass ----
  // Bottom-up by previous standings: each team gets ONE chance to swap their
  // weakest person (across drivers + directors) for a strictly higher-rarity
  // free agent. Released people return to free agency. This drives the
  // "rich-poor exploitation" — top teams raiding lesser teams via FA — and
  // also keeps free agency churning rather than stagnating.
  for (const team of draftOrder) {
    runReplacementForTeam(
      team, drivers, engDirectors, raceDirectors,
      availDrivers, availEng, availRace,
      driverMap, engMap, rdMap, moves
    );
  }

  return {
    moves,
    freeAgentDriverIds: [...availDrivers],
    freeAgentEngDirectorIds: [...availEng],
    freeAgentRaceDirectorIds: [...availRace],
  };
}

// One replacement attempt for a team. Looks at all 5 slots (driver1/2/test/eng/race)
// and finds the slot where swapping the current person for a free agent gains the
// most rarity. Performs at most one swap per call. Released person goes back to
// the free agent pool (rule: free agency, not retirement).
function runReplacementForTeam(
  team: Team,
  drivers: Driver[],
  engDirectors: EngineeringDirector[],
  raceDirectors: RaceDirector[],
  availDrivers: Set<string>,
  availEng: Set<string>,
  availRace: Set<string>,
  driverMap: Map<string, Driver>,
  engMap: Map<string, EngineeringDirector>,
  rdMap: Map<string, RaceDirector>,
  moves: MarketMove[]
): void {
  // Build candidate swaps: for each slot, what's the best FA upgrade available?
  type SwapCandidate = {
    slot: 'driver1' | 'driver2' | 'testDriver' | 'engDirector' | 'raceDirector';
    currentRarity: Rarity;
    currentName: string;
    currentId: string;
    newId: string;
    newName: string;
    newRarity: Rarity;
    rarityGain: number; // higher = bigger upgrade
    netPointDelta: number; // RARITY_COST[new] - RARITY_COST[old], can be neg
  };
  const candidates: SwapCandidate[] = [];

  // Helper: a swap is valid if (a) new rarity > current rarity, (b) team has
  // enough budget AFTER the swap (currentSpare + freed cost - new cost >= 0),
  // and for drivers (c) it respects the driving-squad cap.
  const remBefore = remainingPoints(team, drivers, engDirectors, raceDirectors);

  const driverSlots: Array<'driver1' | 'driver2' | 'testDriver'> = ['driver1', 'driver2', 'testDriver'];
  for (const slot of driverSlots) {
    const currentId = team[`${slot}Id` as 'driver1Id' | 'driver2Id' | 'testDriverId'];
    if (!currentId) continue;
    const current = driverMap.get(currentId);
    if (!current) continue;
    const currentCost = RARITY_COST[current.rarity];
    // Find best FA driver with higher rarity that fits budget+cap after swap
    const candidatesFA = [...availDrivers].map(id => driverMap.get(id)!).filter(d => {
      if (rarityOrder(d.rarity) <= rarityOrder(current.rarity)) return false;
      const newCost = RARITY_COST[d.rarity];
      const netDelta = newCost - currentCost;
      if (remBefore - netDelta < 0) return false;
      // Check driving-squad cap with the swap applied
      const newSquadCost = currentSquadCost(team, driverMap) - currentCost + newCost;
      if (newSquadCost > DRIVING_SQUAD_CAP) return false;
      return true;
    });
    const best = pickBestFA(candidatesFA);
    if (best) {
      candidates.push({
        slot, currentRarity: current.rarity, currentName: current.name, currentId,
        newId: best.id, newName: best.name, newRarity: best.rarity,
        rarityGain: rarityOrder(best.rarity) - rarityOrder(current.rarity),
        netPointDelta: RARITY_COST[best.rarity] - currentCost,
      });
    }
  }

  // Eng director slot
  if (team.engDirectorId) {
    const cur = engMap.get(team.engDirectorId);
    if (cur) {
      const currentCost = RARITY_COST[cur.rarity];
      const candidatesFA = [...availEng].map(id => engMap.get(id)!).filter(e => {
        if (rarityOrder(e.rarity) <= rarityOrder(cur.rarity)) return false;
        const netDelta = RARITY_COST[e.rarity] - currentCost;
        return remBefore - netDelta >= 0;
      });
      const best = pickBestFA(candidatesFA);
      if (best) {
        candidates.push({
          slot: 'engDirector', currentRarity: cur.rarity, currentName: cur.name, currentId: cur.id,
          newId: best.id, newName: best.name, newRarity: best.rarity,
          rarityGain: rarityOrder(best.rarity) - rarityOrder(cur.rarity),
          netPointDelta: RARITY_COST[best.rarity] - currentCost,
        });
      }
    }
  }
  // Race director slot
  if (team.raceDirectorId) {
    const cur = rdMap.get(team.raceDirectorId);
    if (cur) {
      const currentCost = RARITY_COST[cur.rarity];
      const candidatesFA = [...availRace].map(id => rdMap.get(id)!).filter(r => {
        if (rarityOrder(r.rarity) <= rarityOrder(cur.rarity)) return false;
        const netDelta = RARITY_COST[r.rarity] - currentCost;
        return remBefore - netDelta >= 0;
      });
      const best = pickBestFA(candidatesFA);
      if (best) {
        candidates.push({
          slot: 'raceDirector', currentRarity: cur.rarity, currentName: cur.name, currentId: cur.id,
          newId: best.id, newName: best.name, newRarity: best.rarity,
          rarityGain: rarityOrder(best.rarity) - rarityOrder(cur.rarity),
          netPointDelta: RARITY_COST[best.rarity] - currentCost,
        });
      }
    }
  }

  if (candidates.length === 0) return;

  // Pick the swap with the biggest rarity gain. Tiebreak: prefer drivers
  // (more central to gameplay) then by net point delta (smaller is preferred,
  // i.e. cheaper upgrades win ties).
  candidates.sort((a, b) => {
    if (a.rarityGain !== b.rarityGain) return b.rarityGain - a.rarityGain;
    const aIsDriver = a.slot === 'driver1' || a.slot === 'driver2' || a.slot === 'testDriver';
    const bIsDriver = b.slot === 'driver1' || b.slot === 'driver2' || b.slot === 'testDriver';
    if (aIsDriver !== bIsDriver) return aIsDriver ? -1 : 1;
    return a.netPointDelta - b.netPointDelta;
  });
  const swap = candidates[0];

  // Execute swap: release current → free agency, sign new
  if (swap.slot === 'driver1' || swap.slot === 'driver2' || swap.slot === 'testDriver') {
    availDrivers.add(swap.currentId);
    moves.push({
      kind: 'driver_released',
      entityName: swap.currentName,
      entityRarity: swap.currentRarity,
      fromTeam: team.name,
      position: swap.slot,
    });
    assignToSlot(team, swap.slot, swap.newId);
    availDrivers.delete(swap.newId);
    moves.push({
      kind: 'driver_signed',
      entityName: swap.newName,
      entityRarity: swap.newRarity,
      toTeam: team.name,
      position: swap.slot,
    });
  } else if (swap.slot === 'engDirector') {
    availEng.add(swap.currentId);
    moves.push({
      kind: 'director_released',
      entityName: swap.currentName,
      entityRarity: swap.currentRarity,
      fromTeam: team.name,
      position: 'engDirector',
    });
    team.engDirectorId = swap.newId;
    availEng.delete(swap.newId);
    moves.push({
      kind: 'director_signed',
      entityName: swap.newName,
      entityRarity: swap.newRarity,
      toTeam: team.name,
      position: 'engDirector',
    });
  } else {
    availRace.add(swap.currentId);
    moves.push({
      kind: 'director_released',
      entityName: swap.currentName,
      entityRarity: swap.currentRarity,
      fromTeam: team.name,
      position: 'raceDirector',
    });
    team.raceDirectorId = swap.newId;
    availRace.delete(swap.newId);
    moves.push({
      kind: 'director_signed',
      entityName: swap.newName,
      entityRarity: swap.newRarity,
      toTeam: team.name,
      position: 'raceDirector',
    });
  }
}

function rarityOrder(r: Rarity): number {
  switch (r) {
    case 'common': return 1;
    case 'uncommon': return 2;
    case 'rare': return 3;
    case 'epic': return 4;
    case 'legend': return 5;
  }
}

// Pick the highest-rarity FA from a list. Random tiebreak among equals at the
// top to avoid deterministic same-pick-every-season patterns. For simplicity
// the random tiebreak is just "first one we see" — input order is already
// shuffled-ish from the Set iteration.
function pickBestFA<T extends { rarity: Rarity }>(list: T[]): T | null {
  if (list.length === 0) return null;
  let best = list[0];
  for (const x of list) {
    if (rarityOrder(x.rarity) > rarityOrder(best.rarity)) best = x;
  }
  return best;
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

// Revert any temporary car upgrades — called at the START of preseason
// before the market opens. Subtracts the previous year's upgrade values from
// car stats and clears the field. The freed budget points naturally come
// back because RARITY_COST sums + carPointCost will be lower next round.
export function revertTempCarUpgrades(teams: Team[]): void {
  for (const t of teams) {
    if (!t.tempCarUpgrade) continue;
    t.car.maxSpeed     = Math.max(0, t.car.maxSpeed     - t.tempCarUpgrade.maxSpeed);
    t.car.acceleration = Math.max(0, t.car.acceleration - t.tempCarUpgrade.acceleration);
    t.car.turning      = Math.max(0, t.car.turning      - t.tempCarUpgrade.turning);
    t.car.reliability  = Math.max(0, t.car.reliability  - t.tempCarUpgrade.reliability);
    t.tempCarUpgrade = null;
  }
}

// Update championship streaks after a season. The team whose driver won the
// WDC has its streak incremented; every other team's streak resets to 0.
// The streak directly reduces effectiveCap, so a repeat champion is squeezed
// progressively harder until they fail to win — at which point the entire
// penalty is removed in one go.
export function updateChampionStreaks(teams: Team[], wdcTeamId: string | null): void {
  for (const t of teams) {
    if (t.id === wdcTeamId) {
      t.championStreak += 1;
    } else {
      t.championStreak = 0;
    }
  }
}

// Driver loyalty shuffle — runs at the start of preseason, before the draft.
// Each signed driver has a small chance of requesting to leave their team and
// entering free agency, even with a year left on a "contract". Probability is
// higher for stronger drivers on teams that didn't win the constructors title
// (restless ambition — they want a winning seat), and lower but still nonzero
// for drivers already on the champion team. Released drivers go to FA where
// the draft + replacement pass redistribute them.
//
// Returns the list of drivers who left (for preseason reporting).
export function runDriverLoyaltyShuffle(
  teams: Team[],
  drivers: Driver[],
  constructorChampTeamId: string | null,
  rng: RNG
): Array<{ name: string; rarity: Rarity; fromTeam: string }> {
  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const departures: Array<{ name: string; rarity: Rarity; fromTeam: string }> = [];

  for (const t of teams) {
    const onChampTeam = t.id === constructorChampTeamId;
    // Evaluate each driver slot. Test drivers are far less likely to agitate.
    const slots: Array<['driver1Id' | 'driver2Id' | 'testDriverId', boolean]> = [
      ['driver1Id', false],
      ['driver2Id', false],
      ['testDriverId', true],
    ];
    for (const [slotKey, isTest] of slots) {
      const id = t[slotKey];
      if (!id) continue;
      const d = driverMap.get(id);
      if (!d) continue;

      // Base leave chance by rarity. Anchored so a star driver sits around
      // 1/10 — over a full grid this yields roughly 2-3 voluntary moves per
      // season, enough that the driver market visibly churns without being
      // chaotic. Lower rarities are stickier (they're glad to have a seat).
      let chance =
        d.rarity === 'legend'   ? 0.11 :
        d.rarity === 'epic'     ? 0.10 :
        d.rarity === 'rare'     ? 0.08 :
        d.rarity === 'uncommon' ? 0.05 :
        0.03;
      // Champion-team drivers are more loyal — they're already winning.
      if (onChampTeam) chance *= 0.5;
      // Test drivers rarely force a move.
      if (isTest) chance *= 0.5;

      if (rng.next() < chance) {
        // Driver leaves → slot cleared, driver becomes a free agent.
        t[slotKey] = null;
        departures.push({ name: d.name, rarity: d.rarity, fromTeam: t.name });
      }
    }
  }
  return departures;
}

// Off-season cap enforcement. After all market activity (draft + replacement +
// car upgrade), no team may exceed its effective cap. Resolution order per the
// design:
//   1. If over cap, release the weakest person (driver or director) to free
//      agency. Repeat until legal.
//   2. Only if releasing everyone still leaves them over (shouldn't happen in
//      practice) does the car regress.
// This is what makes the champion cap penalty "bite" — a team docked enough
// cap points is forced to shed a legend/epic, who then re-enters the market.
//
// Returns released people for preseason reporting.
export function enforceCapCompliance(
  teams: Team[],
  drivers: Driver[],
  engDirectors: EngineeringDirector[],
  raceDirectors: RaceDirector[]
): Array<{ name: string; rarity: Rarity; fromTeam: string; kind: 'driver' | 'engDirector' | 'raceDirector' }> {
  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const engMap = new Map(engDirectors.map(e => [e.id, e]));
  const rdMap = new Map(raceDirectors.map(r => [r.id, r]));
  const released: Array<{ name: string; rarity: Rarity; fromTeam: string; kind: 'driver' | 'engDirector' | 'raceDirector' }> = [];

  for (const t of teams) {
    // Keep releasing the weakest person until the team is within cap.
    let guard = 0;
    while (remainingPoints(t, drivers, engDirectors, raceDirectors) < 0 && guard < 10) {
      guard++;
      // Gather all releasable people with their rarity cost.
      type Releasable = {
        slot: 'driver1Id' | 'driver2Id' | 'testDriverId' | 'engDirectorId' | 'raceDirectorId';
        kind: 'driver' | 'engDirector' | 'raceDirector';
        id: string;
        name: string;
        rarity: Rarity;
        rarityRank: number;
      };
      const people: Releasable[] = [];
      const pushDriver = (slot: 'driver1Id' | 'driver2Id' | 'testDriverId') => {
        const id = t[slot];
        if (!id) return;
        const d = driverMap.get(id);
        if (!d) return;
        people.push({ slot, kind: 'driver', id, name: d.name, rarity: d.rarity, rarityRank: rarityOrder(d.rarity) });
      };
      pushDriver('driver1Id');
      pushDriver('driver2Id');
      pushDriver('testDriverId');
      if (t.engDirectorId) {
        const e = engMap.get(t.engDirectorId);
        if (e) people.push({ slot: 'engDirectorId', kind: 'engDirector', id: e.id, name: e.name, rarity: e.rarity, rarityRank: rarityOrder(e.rarity) });
      }
      if (t.raceDirectorId) {
        const r = rdMap.get(t.raceDirectorId);
        if (r) people.push({ slot: 'raceDirectorId', kind: 'raceDirector', id: r.id, name: r.name, rarity: r.rarity, rarityRank: rarityOrder(r.rarity) });
      }
      if (people.length === 0) break;

      // Release the HIGHEST-rarity person — that frees the most cap. The point
      // of the penalty is to force champions to give up their stars. (Releasing
      // the weakest would barely move the needle and they'd never recover cap.)
      people.sort((a, b) => b.rarityRank - a.rarityRank);
      const victim = people[0];
      t[victim.slot] = null;
      released.push({ name: victim.name, rarity: victim.rarity, fromTeam: t.name, kind: victim.kind });
    }

    // Fallback: if somehow still over cap after releasing everyone possible,
    // regress the car stat-by-stat until legal.
    let carGuard = 0;
    while (remainingPoints(t, drivers, engDirectors, raceDirectors) < 0 && carGuard < 40) {
      carGuard++;
      // Drop the highest car stat by 1 (keeps the car balanced as it shrinks).
      const stats: Array<keyof Pick<typeof t.car, 'maxSpeed' | 'acceleration' | 'turning' | 'reliability'>> =
        ['maxSpeed', 'acceleration', 'turning', 'reliability'];
      stats.sort((a, b) => t.car[b] - t.car[a]);
      t.car[stats[0]] = Math.max(40, t.car[stats[0]] - 1);
    }
  }
  return released;
}

// Guaranteed car regression for a team that won BOTH titles (WDC + WCC) in the
// same season. Applied during the car re-roll step in addition to the normal
// position-based drift. This is deterministic — a double champion's car always
// goes backwards, no luck involved.
export function applyDoubleChampionCarRegression(car: CarStats, rng: RNG): void {
  // Remove ~6-9 points spread across the four stats. Roughly the inverse of
  // a strong car-upgrade. Always applied, never random in whether it happens —
  // only the distribution is randomized.
  const total = rng.int(6, 9);
  for (let i = 0; i < total; i++) {
    const stats: Array<keyof Pick<CarStats, 'maxSpeed' | 'acceleration' | 'turning' | 'reliability'>> =
      ['maxSpeed', 'acceleration', 'turning', 'reliability'];
    // Drop a random stat, biased toward the currently-highest so the car
    // regresses from its strengths.
    stats.sort((a, b) => car[b] - car[a]);
    const pick = rng.next() < 0.6 ? stats[0] : stats[rng.int(0, 3)];
    car[pick] = Math.max(40, car[pick] - 1);
  }
}

// Car upgrade pass — runs AFTER the regular draft + replacement pass.
// Any team with EXACTLY 3 spare points (the most they can have without
// being able to sign anyone meaningful — rare costs 2, uncommon 1, but if
// they could replace someone they already did) spends those 3 points on a
// ~5-point car upgrade distributed across the four stats. The upgrade is
// stored on the team so it can be reverted next preseason.
//
// 3 spare is the trigger threshold — 4+ means they could still sign a legend
// or epic from FA via the replacement pass, so we don't drain those.
export function runCarUpgradePass(
  teams: Team[],
  drivers: Driver[],
  engDirectors: EngineeringDirector[],
  raceDirectors: RaceDirector[],
  rng: RNG
): void {
  for (const t of teams) {
    // Don't stack upgrades; revertTempCarUpgrades should have cleared any
    // previous one before we get here, but skip if somehow still set.
    if (t.tempCarUpgrade) continue;
    const rem = remainingPoints(t, drivers, engDirectors, raceDirectors);
    if (rem !== 3) continue;

    // Distribute ~5 points across the 4 stats. Use 4-6 total (avg 5) for
    // a bit of variety, weighted slightly toward more rather than less.
    const total = rng.int(4, 6);
    const distrib = distributeRandom(total, 4, rng);
    const upgrade: TempCarUpgrade = {
      maxSpeed:     distrib[0],
      acceleration: distrib[1],
      turning:      distrib[2],
      reliability:  distrib[3],
    };
    t.car.maxSpeed     = Math.min(99, t.car.maxSpeed     + upgrade.maxSpeed);
    t.car.acceleration = Math.min(99, t.car.acceleration + upgrade.acceleration);
    t.car.turning      = Math.min(99, t.car.turning      + upgrade.turning);
    t.car.reliability  = Math.min(99, t.car.reliability  + upgrade.reliability);
    t.tempCarUpgrade = upgrade;
  }
}

// Distribute `total` units randomly across `bins` bins, each ≥ 0.
// Used for spreading car upgrade points across the 4 car stats.
function distributeRandom(total: number, bins: number, rng: RNG): number[] {
  const out = new Array(bins).fill(0);
  for (let i = 0; i < total; i++) {
    out[rng.int(0, bins - 1)]++;
  }
  return out;
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

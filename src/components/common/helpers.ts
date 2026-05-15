// Shared utility functions used across multiple components.
import { Driver, Team, Rarity, SeasonState } from '../../sim/types';

// Map from driverId → team that owns them (across all 3 driver slots).
export function teamByDriverMap(teams: Team[]): Map<string, Team> {
  const m = new Map<string, Team>();
  for (const t of teams) {
    if (t.driver1Id) m.set(t.driver1Id, t);
    if (t.driver2Id) m.set(t.driver2Id, t);
    if (t.testDriverId) m.set(t.testDriverId, t);
  }
  return m;
}

// Map from driverId → driver, including retired drivers.
// Use this for lookups in result views — winners and pole-sitters may have
// retired since the race was run (e.g. when revisiting old calendar entries).
export function allDriversMap(state: SeasonState): Map<string, Driver> {
  return new Map([...state.drivers, ...state.retiredDrivers].map(d => [d.id, d]));
}

// Sort weighting for rarity: legend < epic < rare < uncommon < common.
// Used so "rarity DESC" puts legends first.
export function rarityOrder(r: Rarity): number {
  return { legend: 0, epic: 1, rare: 2, uncommon: 3, common: 4 }[r];
}

// Toggle helper for sortable column headers: clicking same column flips
// direction; clicking a new column resets to descending.
export function toggleSort<T extends string>(
  k: T, current: T, asc: boolean,
  setKey: (k: T) => void, setAsc: (b: boolean) => void
): void {
  if (k === current) setAsc(!asc);
  else { setKey(k); setAsc(false); }
}

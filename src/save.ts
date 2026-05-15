// Universe save/load system using localStorage.
//
// Layout:
//   f1sim:universes        → JSON array of UniverseMeta (the index)
//   f1sim:universe:<id>    → JSON-serialized SeasonState
//   f1sim:settings         → audio prefs etc.
//
// Each universe is one save slot. Players can create multiple universes,
// load any one, and delete them from the home screen.

import { SeasonState } from './sim/types';

const INDEX_KEY = 'f1sim:universes';
const UNIVERSE_PREFIX = 'f1sim:universe:';
const SETTINGS_KEY = 'f1sim:settings';

export interface UniverseMeta {
  id: string;             // stable identifier
  name: string;           // user-chosen label
  year: number;           // current year
  currentRound: number;   // current calendar position
  lastPlayed: number;     // ms timestamp
  createdAt: number;      // ms timestamp
}

export interface Settings {
  audioEnabled: boolean;
  audioVolume: number;    // 0-1
}

const DEFAULT_SETTINGS: Settings = {
  audioEnabled: true,
  audioVolume: 0.5,
};

// ---- Index management ----

export function listUniverses(): UniverseMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.lastPlayed - a.lastPlayed);
  } catch {
    return [];
  }
}

function writeIndex(universes: UniverseMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(universes));
}

// ---- Universe save/load ----

export function saveUniverse(id: string, name: string, state: SeasonState): UniverseMeta {
  // Serialize the state. Records (e.g., completedRaces: Record<number, ...>) survive
  // JSON.stringify naturally. We don't need any custom replacer.
  const blob = JSON.stringify(state);
  localStorage.setItem(UNIVERSE_PREFIX + id, blob);

  const meta: UniverseMeta = {
    id,
    name,
    year: state.year,
    currentRound: state.currentRound,
    lastPlayed: Date.now(),
    createdAt: Date.now(),
  };

  // Update index — replace existing or insert new
  const existing = listUniverses();
  const idx = existing.findIndex(u => u.id === id);
  if (idx >= 0) {
    // preserve createdAt
    meta.createdAt = existing[idx].createdAt;
    existing[idx] = meta;
  } else {
    existing.push(meta);
  }
  writeIndex(existing);
  return meta;
}

export function loadUniverse(id: string): SeasonState | null {
  try {
    const raw = localStorage.getItem(UNIVERSE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as SeasonState;
  } catch (err) {
    console.error('Failed to load universe', id, err);
    return null;
  }
}

export function deleteUniverse(id: string): void {
  localStorage.removeItem(UNIVERSE_PREFIX + id);
  const existing = listUniverses().filter(u => u.id !== id);
  writeIndex(existing);
}

export function generateUniverseId(): string {
  return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---- Settings ----

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

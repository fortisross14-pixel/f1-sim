import { useState } from 'react';
import { SeasonState } from '../../sim/types';
import { createNewSeason } from '../../GameContext';
import {
  listUniverses, loadUniverse, deleteUniverse, saveUniverse,
  generateUniverseId, UniverseMeta,
} from '../../save';

export interface LoadedUniverse {
  id: string;
  name: string;
  state: SeasonState;
}

// Universe selection / creation / deletion screen.
// Shown when no universe is currently loaded.
export function Home({ onLoad }: { onLoad: (u: LoadedUniverse) => void }) {
  const [universes, setUniverses] = useState<UniverseMeta[]>(() => listUniverses());
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = () => setUniverses(listUniverses());

  const create = () => {
    const trimmed = newName.trim() || `Universe ${universes.length + 1}`;
    const id = generateUniverseId();
    const state = createNewSeason();
    saveUniverse(id, trimmed, state);
    onLoad({ id, name: trimmed, state });
  };

  const load = (meta: UniverseMeta) => {
    const state = loadUniverse(meta.id);
    if (state) onLoad({ id: meta.id, name: meta.name, state });
    else alert(`Couldn't load "${meta.name}" — the save data may be corrupted.`);
  };

  const doDelete = (id: string) => {
    deleteUniverse(id);
    setConfirmDelete(null);
    refresh();
  };

  return (
    <div className="app">
      <header className="header">
        <h1><span>F1 Sim</span></h1>
        <div className="header-info"><span>Universe selection</span></div>
      </header>
      <main>
        <div className="screen home-screen">
          <h2>Choose a universe</h2>
          {universes.length === 0 && !showCreate && (
            <p className="muted">No universes saved yet. Create one to start.</p>
          )}
          {universes.length > 0 && (
            <div className="universe-list">
              {universes.map(u => (
                <div key={u.id} className="universe-card">
                  <div className="universe-info">
                    <strong>{u.name}</strong>
                    <div className="muted">
                      Year {u.year} · Round {u.currentRound} · Last played {formatRelativeTime(u.lastPlayed)}
                    </div>
                  </div>
                  <div className="universe-actions">
                    <button className="primary" onClick={() => load(u)}>Load</button>
                    <button className="danger" onClick={() => setConfirmDelete(u.id)}>Delete</button>
                  </div>
                  {confirmDelete === u.id && (
                    <div className="delete-confirm">
                      Delete "{u.name}" permanently?
                      <button className="danger" onClick={() => doDelete(u.id)}>Yes, delete</button>
                      <button onClick={() => setConfirmDelete(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showCreate ? (
            <div className="create-form">
              <h3>New universe</h3>
              <input
                type="text"
                placeholder="Universe name (e.g., Universe Alpha)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') create(); }}
                autoFocus
              />
              <div className="actions">
                <button onClick={() => { setShowCreate(false); setNewName(''); }}>Cancel</button>
                <button className="primary big" onClick={create}>Create &amp; play →</button>
              </div>
            </div>
          ) : (
            <div className="actions" style={{ marginTop: 20 }}>
              <button className="primary big" onClick={() => setShowCreate(true)}>+ New Universe</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

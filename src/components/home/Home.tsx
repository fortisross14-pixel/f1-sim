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
//
// Visual language: large F1-branded hero panel at the top, universe cards
// rendered as horizontal rows with a left-edge red accent that slides in on
// hover. Delete confirmation expands inline beneath the card without taking
// the user away from the list.
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
    <div className="app home-app">
      {/* Hero panel — replaces the standard header for the home page */}
      <div className="home-hero">
        <div className="home-hero-content">
          <div className="home-logo">F1</div>
          <div>
            <h1 className="home-title">SIM</h1>
            <div className="home-tagline">Career Mode Simulator</div>
          </div>
        </div>
      </div>

      <main>
        <div className="home-content">
          <div className="home-section-header">
            <h2>Select a universe</h2>
            {!showCreate && universes.length > 0 && (
              <button className="primary" onClick={() => setShowCreate(true)}>
                + New Universe
              </button>
            )}
          </div>

          {universes.length === 0 && !showCreate && (
            <div className="home-empty">
              <p className="home-empty-title">No universes yet</p>
              <p className="muted">Create your first universe to start the championship.</p>
              <button className="primary big" onClick={() => setShowCreate(true)}>
                + New Universe
              </button>
            </div>
          )}

          {universes.length > 0 && (
            <div className="universe-list">
              {universes.map(u => (
                <div key={u.id} className="universe-card">
                  <div className="universe-card-row">
                    <div className="universe-info">
                      <div className="universe-name">{u.name}</div>
                      <div className="universe-meta">
                        <span><span className="meta-label">Year</span> <strong>{u.year}</strong></span>
                        <span><span className="meta-label">Round</span> <strong>{u.currentRound}</strong></span>
                        <span><span className="meta-label">Last played</span> <strong>{formatRelativeTime(u.lastPlayed)}</strong></span>
                      </div>
                    </div>
                    <div className="universe-actions">
                      <button className="primary" onClick={() => load(u)}>Play →</button>
                      <button className="universe-delete-link" onClick={() => setConfirmDelete(u.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  {confirmDelete === u.id && (
                    <div className="delete-confirm">
                      <span>Permanently delete <strong>"{u.name}"</strong>?</span>
                      <div className="delete-confirm-actions">
                        <button onClick={() => setConfirmDelete(null)}>Cancel</button>
                        <button className="danger" onClick={() => doDelete(u.id)}>Yes, delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showCreate && (
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

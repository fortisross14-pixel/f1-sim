import { useState, useEffect, useMemo } from 'react';
import { GameProvider, useGame, createNewSeason } from './GameContext';
import { AudioProvider, useAudio } from './audio';
import {
  listUniverses, loadUniverse, deleteUniverse, saveUniverse,
  generateUniverseId, UniverseMeta,
} from './save';
import {
  Driver, Team, EngineeringDirector, RaceDirector,
  PreseasonData, Rarity, DriverYearRecord, DirectorYearRecord, TeamYearRecord,
  SeasonState,
} from './sim/types';
import { effectiveDriverSkills, driverOverall } from './sim/generators';
import { remainingPoints, carPointCost } from './sim/market';

import './App.css';

// ============================================================================
// TOP-LEVEL APP — Home screen OR an in-game universe.
// ============================================================================
interface LoadedUniverse {
  id: string;
  name: string;
  state: SeasonState;
}

export default function App() {
  // null = on Home screen; otherwise we have a universe loaded.
  const [loaded, setLoaded] = useState<LoadedUniverse | null>(null);

  return (
    <AudioProvider>
      {loaded === null ? (
        <Home onLoad={setLoaded} />
      ) : (
        <GameProvider
          initialState={loaded.state}
          universeId={loaded.id}
          universeName={loaded.name}
          onExit={() => setLoaded(null)}
        >
          <Shell />
        </GameProvider>
      )}
    </AudioProvider>
  );
}

// ============================================================================
// HOME SCREEN
// ============================================================================
function Home({ onLoad }: { onLoad: (u: LoadedUniverse) => void }) {
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
        <h1>F1 Sim</h1>
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
                    <div className="muted">Year {u.year} · Round {u.currentRound} · Last played {formatRelativeTime(u.lastPlayed)}</div>
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

function Shell() {
  const { state } = useGame();
  // If we're inside a race weekend (qualifying/race), show the race flow overlay.
  // Otherwise show the persistent tabbed menu.
  if (state.phase === 'pre_race' || state.phase === 'qualifying_q1' ||
      state.phase === 'qualifying_q2' || state.phase === 'race_results') {
    return <RaceWeekendOverlay />;
  }
  return <Menu />;
}

// ============================================================================
// MAIN MENU - persistent top-level tabs
// ============================================================================
type TopTab = 'wc' | 'pilots' | 'teams' | 'history';

function Menu() {
  const { state, universeName } = useGame();
  const [tab, setTab] = useState<TopTab>('wc');

  return (
    <div className="app">
      <header className="header">
        <h1>F1 Sim <span className="universe-label">— {universeName}</span></h1>
        <div className="header-info">
          <span>Year {state.year}</span>
          <span>Round {state.currentRound} / {state.calendar.length}</span>
          <GearMenu />
        </div>
      </header>
      <nav className="top-tabs">
        <button onClick={() => setTab('wc')} className={tab === 'wc' ? 'active' : ''}>World Championship</button>
        <button onClick={() => setTab('pilots')} className={tab === 'pilots' ? 'active' : ''}>Pilots</button>
        <button onClick={() => setTab('teams')} className={tab === 'teams' ? 'active' : ''}>Teams</button>
        <button onClick={() => setTab('history')} className={tab === 'history' ? 'active' : ''}>History</button>
      </nav>
      <main>
        {tab === 'wc' && <WorldChampionshipTab />}
        {tab === 'pilots' && <PilotsTab />}
        {tab === 'teams' && <TeamsTab />}
        {tab === 'history' && <HistoryTab />}
      </main>
    </div>
  );
}

// ============================================================================
// GEAR MENU — top-right dropdown for Save / Audio / Exit
// ============================================================================
function GearMenu() {
  const { saveNow, exitToHome } = useGame();
  const { enabled, volume, setEnabled, setVolume, play } = useAudio();
  const [open, setOpen] = useState<boolean>(false);
  const [savedFlash, setSavedFlash] = useState<boolean>(false);

  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement);
      if (!el.closest('.gear-menu-container')) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const handleSave = () => {
    saveNow();
    setSavedFlash(true);
    play('click');
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="gear-menu-container">
      <button className="gear-btn" onClick={() => setOpen(o => !o)} title="Menu">⚙</button>
      {open && (
        <div className="gear-menu">
          <button onClick={handleSave}>
            {savedFlash ? '✓ Saved!' : '💾 Save now'}
          </button>
          <div className="gear-audio">
            <label>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              {' '}🔊 Audio
            </label>
            {enabled && (
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
              />
            )}
          </div>
          <button onClick={exitToHome}>🏠 Back to Home</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WORLD CHAMPIONSHIP TAB
// ============================================================================
function WorldChampionshipTab() {
  const { state } = useGame();
  const [sub, setSub] = useState<'current' | 'preseason'>(state.phase === 'preseason' ? 'preseason' : 'current');
  // If user enters preseason via end-of-season, auto-switch to preseason sub-tab.
  useEffect(() => {
    if (state.phase === 'preseason') setSub('preseason');
  }, [state.phase]);

  return (
    <div className="screen">
      <div className="sub-tabs">
        <button onClick={() => setSub('current')} className={sub === 'current' ? 'active' : ''}>Current</button>
        <button onClick={() => setSub('preseason')} className={sub === 'preseason' ? 'active' : ''} disabled={!state.lastPreseasonData}>
          Pre-season
        </button>
      </div>
      {sub === 'current' && <WCCurrentView />}
      {sub === 'preseason' && state.lastPreseasonData && <WCPreseasonView data={state.lastPreseasonData} />}
      {sub === 'preseason' && !state.lastPreseasonData && (
        <p className="muted">No pre-season data yet — finish a season to see retirements, market moves, and car changes.</p>
      )}
    </div>
  );
}

function WCCurrentView() {
  const { state, startRaceWeekend, startNewYear } = useGame();
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);
  const [popupTeam, setPopupTeam] = useState<Team | null>(null);

  const isPreseason = state.phase === 'preseason';
  const seasonComplete = state.currentRound > state.calendar.length || isPreseason;

  return (
    <>
      <div className="wc-header">
        <h2>Year {state.year} — World Championship</h2>
        {!seasonComplete && (
          <button className="primary big" onClick={() => startRaceWeekend()}>Run next race →</button>
        )}
        {isPreseason && (
          <button className="primary big" onClick={() => startNewYear()}>Begin Year {state.year} →</button>
        )}
      </div>

      <h3>Calendar &amp; results</h3>
      <table className="data-table">
        <thead>
          <tr><th>#</th><th>Circuit</th><th>Country</th><th>Profile</th><th>Weather</th><th>Pole</th><th>Winner</th><th>Fastest lap</th></tr>
        </thead>
        <tbody>
          {state.calendar.map((gp) => {
            const completed = state.completedRaces[gp.round];
            const isCurrent = gp.round === state.currentRound && !seasonComplete;
            const poleId = completed?.qualifying.poleDriverId;
            const winnerId = completed?.race.finalRanking[0];
            const flId = completed?.race.fastestLapDriverId;
            return (
              <tr key={gp.circuit.id} className={isCurrent ? 'current' : ''}>
                <td>{gp.round}</td>
                <td>{gp.circuit.name}</td>
                <td>{gp.circuit.country}</td>
                <td>{gp.circuit.profile}</td>
                <td>{gp.weather}</td>
                <td>{poleId ? <DriverLink id={poleId} onClick={d => setPopupDriver(d)} drivers={state.drivers.concat(state.retiredDrivers)} /> : (isCurrent ? '⟶ next' : '')}</td>
                <td>{winnerId ? <DriverLink id={winnerId} onClick={d => setPopupDriver(d)} drivers={state.drivers.concat(state.retiredDrivers)} /> : ''}</td>
                <td>{flId ? <DriverLink id={flId} onClick={d => setPopupDriver(d)} drivers={state.drivers.concat(state.retiredDrivers)} /> : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="standings-side-by-side">
        <div>
          <h3>Driver Standings</h3>
          <table className="data-table compact">
            <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Pts</th><th>W</th></tr></thead>
            <tbody>
              {state.driverStandings.map((s, i) => {
                const d = driverMap.get(s.driverId);
                const t = teamByDriver.get(s.driverId);
                if (!d) return null;
                return (
                  <tr key={s.driverId}>
                    <td>{i + 1}</td>
                    <td><button className="link-btn" onClick={() => setPopupDriver(d)}>{d.name}</button></td>
                    <td style={{ color: t?.color }}>{t?.shortName ?? '—'}</td>
                    <td>{s.points}</td>
                    <td>{d.seasonWins}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Constructor Standings</h3>
          <table className="data-table compact">
            <thead><tr><th>Pos</th><th>Team</th><th>Pts</th><th>W</th></tr></thead>
            <tbody>
              {state.teamStandings.map((s, i) => {
                const t = teamMap.get(s.teamId);
                if (!t) return null;
                return (
                  <tr key={s.teamId}>
                    <td>{i + 1}</td>
                    <td><button className="link-btn" style={{ color: t.color }} onClick={() => setPopupTeam(t)}>{t.name}</button></td>
                    <td>{s.points}</td>
                    <td>{t.seasonWins}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
      {popupTeam && <TeamDetailPopup team={popupTeam} onClose={() => setPopupTeam(null)} />}
    </>
  );
}

function WCPreseasonView({ data }: { data: PreseasonData }) {
  const { state, startNewYear } = useGame();
  const [section, setSection] = useState<'summary' | 'market' | 'cars'>('summary');
  const isCurrentlyInPreseason = state.phase === 'preseason';

  return (
    <>
      <div className="sub-sub-tabs">
        <button onClick={() => setSection('summary')} className={section === 'summary' ? 'active' : ''}>Season {data.yearEnded} Summary</button>
        <button onClick={() => setSection('market')} className={section === 'market' ? 'active' : ''}>Market</button>
        <button onClick={() => setSection('cars')} className={section === 'cars' ? 'active' : ''}>Car Evolution</button>
      </div>
      {section === 'summary' && <PreseasonSummary data={data} />}
      {section === 'market' && <PreseasonMarket data={data} />}
      {section === 'cars' && <PreseasonCars data={data} />}
      {isCurrentlyInPreseason && (
        <div className="actions">
          <button className="primary big" onClick={() => startNewYear()}>Begin Year {state.year} →</button>
        </div>
      )}
    </>
  );
}

function PreseasonSummary({ data }: { data: PreseasonData }) {
  const audio = useAudio();
  useEffect(() => { audio.play('champion'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="awards">
        <div>🏆 World Champion: <strong>{data.championDriverName}</strong></div>
        <div>🏭 Constructors': <strong>{data.finalTeamStandings[0]?.teamName ?? '—'}</strong></div>
        <div>🥇 Most wins: <strong>{data.finalDriverStandings.find(d => d.driverId === data.mostWinsDriverId)?.driverName ?? '—'}</strong></div>
        {data.rookieOfYearDriverId && (
          <div>🌟 Rookie of the Year: <strong>{data.finalDriverStandings.find(d => d.driverId === data.rookieOfYearDriverId)?.driverName ?? '—'}</strong></div>
        )}
      </div>
      <h3>Final Driver Standings</h3>
      <table className="data-table"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Points</th><th>Wins</th></tr></thead>
        <tbody>
          {data.finalDriverStandings.map((s, i) => (
            <tr key={s.driverId}><td>{i + 1}</td><td>{s.driverName}</td><td>{s.teamName}</td><td>{s.points}</td><td>{s.wins}</td></tr>
          ))}
        </tbody>
      </table>
      <h3>Final Constructor Standings</h3>
      <table className="data-table"><thead><tr><th>Pos</th><th>Team</th><th>Points</th><th>Wins</th></tr></thead>
        <tbody>
          {data.finalTeamStandings.map((s, i) => (
            <tr key={s.teamId}><td>{i + 1}</td><td>{s.teamName}</td><td>{s.points}</td><td>{s.wins}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PreseasonMarket({ data }: { data: PreseasonData }) {
  return (
    <>
      <h3>Retirements ({data.retirements.length})</h3>
      <div className="market-list">
        {data.retirements.map((r, i) => (
          <div key={i} className="move-card">
            <strong>⏹️ Retired</strong>
            <div>{r.name} <span className={`rarity rarity-${r.rarity}`}>{r.rarity}</span></div>
            <div className="muted">{r.kind === 'driver' ? 'Driver' : r.kind === 'engDirector' ? 'Eng Director' : 'Race Director'}</div>
          </div>
        ))}
      </div>
      <h3>Rookies arrived ({data.rookieArrivals.length})</h3>
      <div className="market-list">
        {data.rookieArrivals.map((r, i) => (
          <div key={i} className="move-card">
            <strong>🌟 Rookie</strong>
            <div>{r.name} <span className={`rarity rarity-${r.rarity}`}>{r.rarity}</span></div>
          </div>
        ))}
      </div>
      <h3>Released ({data.releases.length})</h3>
      <div className="market-list">
        {data.releases.map((r, i) => (
          <div key={i} className="move-card">
            <strong>👋 Released</strong>
            <div>{r.name} <span className={`rarity rarity-${r.rarity}`}>{r.rarity}</span></div>
            <div className="muted">from {r.fromTeam}</div>
          </div>
        ))}
      </div>
      <h3>Signings ({data.signings.length})</h3>
      <div className="market-list">
        {data.signings.map((r, i) => (
          <div key={i} className="move-card">
            <strong>✍️ Signed</strong>
            <div>{r.name} <span className={`rarity rarity-${r.rarity}`}>{r.rarity}</span></div>
            <div className="muted">to {r.toTeam}</div>
            <div className="muted">{r.position}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function PreseasonCars({ data }: { data: PreseasonData }) {
  return (
    <>
      <h3>Car evolution year {data.yearEnded} → {data.yearEnded + 1}</h3>
      <table className="data-table">
        <thead><tr><th>Team</th><th>Speed</th><th>Accel</th><th>Turn</th><th>Reliab</th></tr></thead>
        <tbody>
          {data.carEvolution.map(c => (
            <tr key={c.teamId}>
              <td style={{ color: c.teamColor }}>{c.teamName}</td>
              <td><Delta before={c.before.maxSpeed} after={c.after.maxSpeed} /></td>
              <td><Delta before={c.before.acceleration} after={c.after.acceleration} /></td>
              <td><Delta before={c.before.turning} after={c.after.turning} /></td>
              <td><Delta before={c.before.reliability} after={c.after.reliability} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">(Stats above are pre-engineering-director boost.)</p>
    </>
  );
}

function Delta({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  return (
    <span>{before} → <strong>{after}</strong>{' '}
      {diff > 0 ? <span className="up">+{diff}</span> : diff < 0 ? <span className="down">{diff}</span> : <span>—</span>}
    </span>
  );
}

// ============================================================================
// PILOTS TAB
// ============================================================================
type DriverSortKey = 'name' | 'team' | 'age' | 'rarity' | 'driving' | 'physical' | 'carSetup' | 'speed' | 'overall' | 'years';

function PilotsTab() {
  const { state } = useGame();
  const [sortKey, setSortKey] = useState<DriverSortKey>('overall');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);

  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const sorted = useMemo(() => sortDrivers(state.drivers, sortKey, sortAsc, teamByDriver), [state.drivers, sortKey, sortAsc, teamByDriver]);

  return (
    <div className="screen">
      <h2>Pilots ({state.drivers.length} active)</h2>
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader label="Name" k="name" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <th>Country</th>
            <SortHeader label="Team" k="team" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Yrs" k="years" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Age" k="age" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Rarity" k="rarity" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <th>Archetype</th>
            <SortHeader label="OVR" k="overall" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="DRV" k="driving" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="PHY" k="physical" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="CAR" k="carSetup" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="SPD" k="speed" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => {
            const t = teamByDriver.get(d.id);
            const sk = effectiveDriverSkills(d);
            const ovr = driverOverall(d);
            return (
              <tr key={d.id}>
                <td><button className="link-btn" onClick={() => setPopupDriver(d)}>{d.name}</button>
                  {d.retirementAnnounced && <span className="retiring"> ⏳</span>}
                  {d.injuredRaces > 0 && <span className="injury"> 🚑{d.injuredRaces}</span>}</td>
                <td title={d.country}>{d.flag}</td>
                <td style={{ color: t?.color }}>{t?.name ?? <em className="muted">Free Agent</em>}</td>
                <td>{d.age - d.careerStartAge + 1}</td>
                <td>{d.age}</td>
                <td><span className={`rarity rarity-${d.rarity}`}>{d.rarity}</span></td>
                <td>{d.archetype}</td>
                <td><strong>{ovr}</strong></td>
                <td>{sk.driving}</td>
                <td>{sk.physical}</td>
                <td>{sk.carSetup}</td>
                <td>{sk.speed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
    </div>
  );
}

// ============================================================================
// TEAMS TAB
// ============================================================================
function TeamsTab() {
  const { state } = useGame();
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const engMap = useMemo(() => new Map(state.engineeringDirectors.map(e => [e.id, e])), [state.engineeringDirectors]);
  const rdMap = useMemo(() => new Map(state.raceDirectors.map(r => [r.id, r])), [state.raceDirectors]);
  const [popupTeam, setPopupTeam] = useState<Team | null>(null);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);
  const [popupEng, setPopupEng] = useState<EngineeringDirector | null>(null);
  const [popupRD, setPopupRD] = useState<RaceDirector | null>(null);

  const sorted = [...state.teams].sort((a, b) => {
    const aAvg = (a.car.maxSpeed + a.car.acceleration + a.car.turning + a.car.reliability) / 4;
    const bAvg = (b.car.maxSpeed + b.car.acceleration + b.car.turning + b.car.reliability) / 4;
    return bAvg - aAvg;
  });

  return (
    <div className="screen">
      <h2>Teams</h2>
      <div className="teams-grid">
        {sorted.map(t => {
          const d1 = t.driver1Id ? driverMap.get(t.driver1Id) : null;
          const d2 = t.driver2Id ? driverMap.get(t.driver2Id) : null;
          const td = t.testDriverId ? driverMap.get(t.testDriverId) : null;
          const eng = t.engDirectorId ? engMap.get(t.engDirectorId) : null;
          const rd = t.raceDirectorId ? rdMap.get(t.raceDirectorId) : null;
          const rem = remainingPoints(t, state.drivers, state.engineeringDirectors, state.raceDirectors);
          const carPts = carPointCost(t);
          return (
            <div key={t.id} className="team-card" style={{ borderLeft: `4px solid ${t.color}` }}>
              <h3>
                <button className="link-btn" style={{ color: t.color }} onClick={() => setPopupTeam(t)}>{t.name}</button>
                <small>  ({t.shortName})</small>
              </h3>
              <div className="row">
                <span>Tier: {t.tier}</span>
                <span>Cap: {t.marketPoints}</span>
                <span>Car: {carPts}pts</span>
                <span>Unused: {rem}</span>
              </div>
              <div className="row">
                <span>Speed: {t.car.maxSpeed}</span>
                <span>Accel: {t.car.acceleration}</span>
                <span>Turn: {t.car.turning}</span>
                <span>Reliab: {t.car.reliability}</span>
              </div>
              <div className="roster">
                <RosterLine label="D1" d={d1} onClick={() => d1 && setPopupDriver(d1)} />
                <RosterLine label="D2" d={d2} onClick={() => d2 && setPopupDriver(d2)} />
                <RosterLine label="Test" d={td} onClick={() => td && setPopupDriver(td)} />
                <div className="director-line">
                  Eng Dir: {eng ?
                    <><button className="link-btn" onClick={() => setPopupEng(eng)}>{eng.name}</button> <span className={`rarity rarity-${eng.rarity}`}>{eng.rarity}</span></>
                    : '—'}
                </div>
                <div className="director-line">
                  Race Dir: {rd ?
                    <><button className="link-btn" onClick={() => setPopupRD(rd)}>{rd.name}</button> <span className={`rarity rarity-${rd.rarity}`}>{rd.rarity}</span></>
                    : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {popupTeam && <TeamDetailPopup team={popupTeam} onClose={() => setPopupTeam(null)} />}
      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
      {popupEng && <EngDirectorDetailPopup director={popupEng} onClose={() => setPopupEng(null)} />}
      {popupRD && <RaceDirectorDetailPopup director={popupRD} onClose={() => setPopupRD(null)} />}
    </div>
  );
}

function RosterLine({ label, d, onClick }: { label: string; d: Driver | null | undefined; onClick?: () => void }) {
  if (!d) return <div className="driver-line">{label}: —</div>;
  const ovr = driverOverall(d);
  return (
    <div className="driver-line">
      <strong>{label}:</strong> <span title={d.country}>{d.flag}</span>{' '}
      <button className="link-btn" onClick={onClick}>{d.name}</button>{' '}
      <span className={`rarity rarity-${d.rarity}`}>{d.rarity}</span>{' '}
      <span className="ovr-badge">OVR {ovr}</span>
      {d.injuredRaces > 0 && <span className="injury"> 🚑 out {d.injuredRaces}</span>}
      {d.retirementAnnounced && <span className="retiring"> ⏳ final season</span>}
    </div>
  );
}

// ============================================================================
// HISTORY TAB
// ============================================================================
type HistorySubTab = 'drivers' | 'directors' | 'teams';
type HistoryFilter = 'active' | 'retired' | 'all';

function HistoryTab() {
  const [sub, setSub] = useState<HistorySubTab>('drivers');
  return (
    <div className="screen">
      <h2>History</h2>
      <div className="sub-tabs">
        <button onClick={() => setSub('drivers')} className={sub === 'drivers' ? 'active' : ''}>Drivers</button>
        <button onClick={() => setSub('directors')} className={sub === 'directors' ? 'active' : ''}>Directors</button>
        <button onClick={() => setSub('teams')} className={sub === 'teams' ? 'active' : ''}>Teams</button>
      </div>
      {sub === 'drivers' && <DriverHistory />}
      {sub === 'directors' && <DirectorHistory />}
      {sub === 'teams' && <TeamHistory />}
    </div>
  );
}

type DriverHistSort = 'name' | 'rarity' | 'races' | 'wins' | 'podiums' | 'poles' | 'points' | 'championships';

function DriverHistory() {
  const { state } = useGame();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [sortKey, setSortKey] = useState<DriverHistSort>('championships');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);

  const drivers: Driver[] = filter === 'active' ? state.drivers
    : filter === 'retired' ? state.retiredDrivers
    : [...state.drivers, ...state.retiredDrivers];

  const totalPoints = (d: Driver) => d.yearHistory.reduce((a, b) => a + b.points, 0);
  const sorted = [...drivers].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortKey) {
      case 'name': return dir * a.name.localeCompare(b.name);
      case 'rarity': return dir * (rarityOrder(a.rarity) - rarityOrder(b.rarity));
      case 'races': return dir * (a.careerStarts - b.careerStarts);
      case 'wins': return dir * (a.careerWins - b.careerWins);
      case 'podiums': return dir * (a.careerPodiums - b.careerPodiums);
      case 'poles': return dir * (a.careerPoles - b.careerPoles);
      case 'points': return dir * (totalPoints(a) - totalPoints(b));
      case 'championships': return dir * (a.careerChampionships - b.careerChampionships);
    }
  });

  return (
    <>
      <div className="filter-row">
        <span>Filter: </span>
        <button onClick={() => setFilter('active')} className={filter === 'active' ? 'active' : ''}>Active</button>
        <button onClick={() => setFilter('retired')} className={filter === 'retired' ? 'active' : ''}>Retired</button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>All</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader label="Name" k="name" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Rarity" k="rarity" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <th>Status</th>
            <SortHeader label="Races" k="races" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Wins" k="wins" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Podiums" k="podiums" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Poles" k="poles" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="Points" k="points" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
            <SortHeader label="WC" k="championships" curr={sortKey} asc={sortAsc} onClick={k => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc)} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => (
            <tr key={d.id}>
              <td><button className="link-btn" onClick={() => setPopupDriver(d)}>{d.name}</button></td>
              <td><span className={`rarity rarity-${d.rarity}`}>{d.rarity}</span></td>
              <td>{d.retired ? <span className="muted">Retired</span> : 'Active'}</td>
              <td>{d.careerStarts}</td>
              <td>{d.careerWins}</td>
              <td>{d.careerPodiums}</td>
              <td>{d.careerPoles}</td>
              <td>{totalPoints(d)}</td>
              <td>{d.careerChampionships}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
    </>
  );
}

function DirectorHistory() {
  const { state } = useGame();
  const [kind, setKind] = useState<'eng' | 'race'>('eng');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [popupEng, setPopupEng] = useState<EngineeringDirector | null>(null);
  const [popupRD, setPopupRD] = useState<RaceDirector | null>(null);

  const engs: EngineeringDirector[] = filter === 'active' ? state.engineeringDirectors
    : filter === 'retired' ? state.retiredEngDirectors
    : [...state.engineeringDirectors, ...state.retiredEngDirectors];
  const rds: RaceDirector[] = filter === 'active' ? state.raceDirectors
    : filter === 'retired' ? state.retiredRaceDirectors
    : [...state.raceDirectors, ...state.retiredRaceDirectors];

  const yearsActive = (h: DirectorYearRecord[]) => h.filter(y => y.teamId !== null).length;
  const totalTeamWins = (h: DirectorYearRecord[]) => h.reduce((a, b) => a + b.teamRaceWins, 0);
  const totalDriverWC = (h: DirectorYearRecord[]) => h.filter(y => y.driverWC).length;
  const totalConstructorWC = (h: DirectorYearRecord[]) => h.filter(y => y.constructorWC).length;

  return (
    <>
      <div className="filter-row">
        <span>Type: </span>
        <button onClick={() => setKind('eng')} className={kind === 'eng' ? 'active' : ''}>Engineering</button>
        <button onClick={() => setKind('race')} className={kind === 'race' ? 'active' : ''}>Race</button>
        <span style={{ marginLeft: 20 }}>Filter: </span>
        <button onClick={() => setFilter('active')} className={filter === 'active' ? 'active' : ''}>Active</button>
        <button onClick={() => setFilter('retired')} className={filter === 'retired' ? 'active' : ''}>Retired</button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>All</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Name</th><th>Rarity</th><th>Status</th><th>Years Active</th><th>Team Wins</th><th>Driver WC</th><th>Constructor WC</th></tr></thead>
        <tbody>
          {(kind === 'eng' ? engs : rds).sort((a, b) => totalTeamWins(b.yearHistory) - totalTeamWins(a.yearHistory)).map(d => (
            <tr key={d.id}>
              <td><button className="link-btn" onClick={() => kind === 'eng' ? setPopupEng(d as EngineeringDirector) : setPopupRD(d as RaceDirector)}>{d.name}</button></td>
              <td><span className={`rarity rarity-${d.rarity}`}>{d.rarity}</span></td>
              <td>{d.retired ? <span className="muted">Retired</span> : 'Active'}</td>
              <td>{yearsActive(d.yearHistory)}</td>
              <td>{totalTeamWins(d.yearHistory)}</td>
              <td>{totalDriverWC(d.yearHistory)}</td>
              <td>{totalConstructorWC(d.yearHistory)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {popupEng && <EngDirectorDetailPopup director={popupEng} onClose={() => setPopupEng(null)} />}
      {popupRD && <RaceDirectorDetailPopup director={popupRD} onClose={() => setPopupRD(null)} />}
    </>
  );
}

function TeamHistory() {
  const { state } = useGame();
  const [popupTeam, setPopupTeam] = useState<Team | null>(null);
  return (
    <>
      <table className="data-table">
        <thead><tr><th>Team</th><th>Years</th><th>Wins</th><th>Podiums</th><th>Poles</th><th>Driver WC</th><th>Constructor WC</th></tr></thead>
        <tbody>
          {[...state.teams].sort((a, b) => b.careerConstructorWC - a.careerConstructorWC || b.careerWins - a.careerWins).map(t => (
            <tr key={t.id}>
              <td><button className="link-btn" style={{ color: t.color }} onClick={() => setPopupTeam(t)}>{t.name}</button></td>
              <td>{t.yearHistory.length}</td>
              <td>{t.careerWins}</td>
              <td>{t.careerPodiums}</td>
              <td>{t.careerPoles}</td>
              <td>{t.careerDriverWC}</td>
              <td>{t.careerConstructorWC}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {popupTeam && <TeamDetailPopup team={popupTeam} onClose={() => setPopupTeam(null)} />}
    </>
  );
}

// ============================================================================
// DETAIL POPUPS
// ============================================================================
function PopupShell({ title, onClose, children, accentColor }: { title: string; onClose: () => void; children: React.ReactNode; accentColor?: string }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup" onClick={e => e.stopPropagation()}>
        <div className="popup-header" style={{ borderBottom: accentColor ? `3px solid ${accentColor}` : undefined }}>
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function DriverDetailPopup({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const { state } = useGame();
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  const sk = effectiveDriverSkills(driver);
  const ovr = driverOverall(driver);
  const totalPoints = driver.yearHistory.reduce((a, b) => a + b.points, 0);
  return (
    <PopupShell title={`${driver.flag} ${driver.name}`} onClose={onClose}>
      <div className="popup-meta">
        <div><span className={`rarity rarity-${driver.rarity}`}>{driver.rarity}</span> · {driver.archetype} · <strong>OVR {ovr}</strong></div>
        <div>{driver.country} · Age {driver.age} · Years active: {driver.yearHistory.length || (driver.age - driver.careerStartAge + 1)}</div>
        {driver.retired && <div className="muted">⏹️ Retired</div>}
        {driver.retirementAnnounced && !driver.retired && <div className="retiring">⏳ Final season announced</div>}
      </div>
      <h3>Current skills</h3>
      <div className="skills-row">
        <span>Driving <strong>{sk.driving}</strong></span>
        <span>Physical <strong>{sk.physical}</strong></span>
        <span>Car Setup <strong>{sk.carSetup}</strong></span>
        <span>Speed <strong>{sk.speed}</strong></span>
      </div>
      <h3>Career totals</h3>
      <div className="stats-row">
        <span>WC titles: <strong>{driver.careerChampionships}</strong></span>
        <span>Race wins: <strong>{driver.careerWins}</strong></span>
        <span>Podiums: <strong>{driver.careerPodiums}</strong></span>
        <span>Pole positions: <strong>{driver.careerPoles}</strong></span>
        <span>Race starts: <strong>{driver.careerStarts}</strong></span>
        <span>Total points: <strong>{totalPoints}</strong></span>
      </div>
      <h3>Year-by-year</h3>
      {driver.yearHistory.length === 0 ? <p className="muted">No completed seasons yet.</p> : (
        <table className="data-table compact history-table">
          <thead><tr><th>Year</th><th>Team</th><th>Races</th><th>Wins</th><th>Podiums</th><th>Poles</th><th>Points</th><th>Title</th></tr></thead>
          <tbody>
            {driver.yearHistory.map((y, i) => (
              <tr key={i}>
                <td>{y.year}</td>
                <td style={{ color: teamMap.get(y.teamId ?? '')?.color }}>{y.teamName}</td>
                <td>{y.races}</td>
                <td>{y.wins}</td>
                <td>{y.podiums}</td>
                <td>{y.poles}</td>
                <td>{y.points}</td>
                <td>{y.isWorldChampion ? '🏆' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PopupShell>
  );
}

function TeamDetailPopup({ team, onClose }: { team: Team; onClose: () => void }) {
  return (
    <PopupShell title={team.name} onClose={onClose} accentColor={team.color}>
      <div className="popup-meta">
        <div>{team.shortName} · Tier: {team.tier} · Legacy base: {team.legacyBaseValue}</div>
      </div>
      <h3>Current car</h3>
      <div className="skills-row">
        <span>Max Speed <strong>{team.car.maxSpeed}</strong></span>
        <span>Acceleration <strong>{team.car.acceleration}</strong></span>
        <span>Turning <strong>{team.car.turning}</strong></span>
        <span>Reliability <strong>{team.car.reliability}</strong></span>
      </div>
      <h3>Career totals</h3>
      <div className="stats-row">
        <span>Race wins: <strong>{team.careerWins}</strong></span>
        <span>Podiums: <strong>{team.careerPodiums}</strong></span>
        <span>Poles: <strong>{team.careerPoles}</strong></span>
        <span>Driver WC: <strong>{team.careerDriverWC}</strong></span>
        <span>Constructor WC: <strong>{team.careerConstructorWC}</strong></span>
      </div>
      <h3>Year-by-year</h3>
      {team.yearHistory.length === 0 ? <p className="muted">No completed seasons yet.</p> : (
        <table className="data-table compact history-table">
          <thead><tr><th>Year</th><th>Pos</th><th>Points</th><th>Wins</th><th>Podiums</th><th>Poles</th><th>Car Avg</th><th>Titles</th></tr></thead>
          <tbody>
            {team.yearHistory.map((y: TeamYearRecord, i) => (
              <tr key={i}>
                <td>{y.year}</td>
                <td>{y.finalPosition}</td>
                <td>{y.points}</td>
                <td>{y.wins}</td>
                <td>{y.podiums}</td>
                <td>{y.poles}</td>
                <td>{y.carAvg.toFixed(1)}</td>
                <td>{y.driverWC && '🏆D'}{y.constructorWC && ' 🏭C'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PopupShell>
  );
}

function EngDirectorDetailPopup({ director, onClose }: { director: EngineeringDirector; onClose: () => void }) {
  const { state } = useGame();
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  return (
    <PopupShell title={director.name} onClose={onClose}>
      <div className="popup-meta">
        <div><span className={`rarity rarity-${director.rarity}`}>{director.rarity}</span> · Engineering Director</div>
        <div>Age {director.age} · Years remaining: {Math.max(0, director.yearsRemaining)}</div>
        {director.retired && <div className="muted">⏹️ Retired</div>}
      </div>
      <h3>Skills</h3>
      <div className="skills-row">
        <span>Speed target <strong>{director.speedTarget}</strong></span>
        <span>Accel target <strong>{director.accelTarget}</strong></span>
        <span>Turning target <strong>{director.turningTarget}</strong></span>
        <span>Reliability target <strong>{director.reliabilityTarget}</strong></span>
        <span>Pull factor <strong>{Math.round(director.pullFactor * 100)}%</strong></span>
      </div>
      <h3>Career at teams</h3>
      {director.yearHistory.length === 0 ? <p className="muted">No completed seasons yet.</p> : (
        <table className="data-table compact history-table">
          <thead><tr><th>Year</th><th>Team</th><th>Team Wins</th><th>Podiums</th><th>Poles</th><th>Titles</th></tr></thead>
          <tbody>
            {director.yearHistory.map((y, i) => (
              <tr key={i}>
                <td>{y.year}</td>
                <td style={{ color: teamMap.get(y.teamId ?? '')?.color }}>{y.teamName}</td>
                <td>{y.teamRaceWins}</td>
                <td>{y.teamPodiums}</td>
                <td>{y.teamPoles}</td>
                <td>{y.driverWC && '🏆D'}{y.constructorWC && ' 🏭C'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PopupShell>
  );
}

function RaceDirectorDetailPopup({ director, onClose }: { director: RaceDirector; onClose: () => void }) {
  const { state } = useGame();
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  return (
    <PopupShell title={director.name} onClose={onClose}>
      <div className="popup-meta">
        <div><span className={`rarity rarity-${director.rarity}`}>{director.rarity}</span> · Race Director</div>
        <div>Age {director.age} · Years remaining: {Math.max(0, director.yearsRemaining)}</div>
        {director.retired && <div className="muted">⏹️ Retired</div>}
      </div>
      <h3>Skills</h3>
      <div className="skills-row">
        <span>Time improvement <strong>{director.timeImprovementPct}%</strong></span>
        <span>Reliability bonus <strong>+{director.reliabilityBonus}</strong></span>
      </div>
      <h3>Career at teams</h3>
      {director.yearHistory.length === 0 ? <p className="muted">No completed seasons yet.</p> : (
        <table className="data-table compact history-table">
          <thead><tr><th>Year</th><th>Team</th><th>Team Wins</th><th>Podiums</th><th>Poles</th><th>Titles</th></tr></thead>
          <tbody>
            {director.yearHistory.map((y, i) => (
              <tr key={i}>
                <td>{y.year}</td>
                <td style={{ color: teamMap.get(y.teamId ?? '')?.color }}>{y.teamName}</td>
                <td>{y.teamRaceWins}</td>
                <td>{y.teamPodiums}</td>
                <td>{y.teamPoles}</td>
                <td>{y.driverWC && '🏆D'}{y.constructorWC && ' 🏭C'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PopupShell>
  );
}

// ============================================================================
// RACE WEEKEND OVERLAY — invoked when phase is pre_race / qualifying_* / race_results
// ============================================================================
function RaceWeekendOverlay() {
  const { state, returnToMenu, runQualifying, startRace, finishCurrentRace, universeName } = useGame();
  const gp = state.calendar[state.currentRound - 1];
  const driverMap = useMemo(() => allDriversMap(state), [state]);

  return (
    <div className="app">
      <header className="header">
        <h1>F1 Sim <span className="universe-label">— {universeName}</span></h1>
        <div className="header-info">
          <span>Year {state.year}</span>
          <span>Round {state.currentRound} / {state.calendar.length}</span>
          <button onClick={returnToMenu} className="cancel-btn">← Back to menu</button>
          <GearMenu />
        </div>
      </header>
      <main>
        <div className="screen">
          {state.phase === 'pre_race' && <PreRacePane gp={gp} onRunQ={runQualifying} />}
          {(state.phase === 'qualifying_q1' || state.phase === 'qualifying_q2') && state.lastQualiResult && (
            <QualifyingPane gp={gp} onStartRace={startRace} />
          )}
          {state.phase === 'race_results' && state.lastRaceResult && (
            <RaceResultsPane onFinish={finishCurrentRace} />
          )}
        </div>
      </main>
    </div>
  );
  void driverMap; // suppress unused — used inside child panes via context
}

function PreRacePane({ gp, onRunQ }: { gp: any; onRunQ: () => void }) {
  return (
    <>
      <h2>Round {gp.round} — {gp.circuit.name} ({gp.circuit.country})</h2>
      <div className="info-box">
        <p>Circuit profile: <strong>{gp.circuit.profile}</strong></p>
        <p>Weather: <strong>{gp.weather}</strong></p>
        <p>Laps: <strong>{gp.circuit.laps}</strong></p>
        {gp.weather === 'hot' && <p>🔥 Extreme heat - drivers with high physical/cardio favored.</p>}
        {gp.weather === 'rain' && <p>🌧️ Rain - high driving skill & wet specialists favored.</p>}
      </div>
      <div className="actions">
        <button className="primary big" onClick={onRunQ}>Run Qualifying →</button>
      </div>
    </>
  );
}

function QualifyingPane({ onStartRace }: { gp: any; onStartRace: () => void }) {
  const { state } = useGame();
  const audio = useAudio();
  const q = state.lastQualiResult!;
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);

  // Phase logic:
  //  - state.phase === 'qualifying_q1' → only Q1 ticks revealed (steps 0..2 = ticks 0..2, step 3 = "Q1 final").
  //  - state.phase === 'qualifying_q2' → Q2 ticks (steps 0..2 = ticks 3..5, step 3 = "Q2 final").
  // We keep separate step counters per phase and reset when transitioning.
  const isQ1Phase = state.phase === 'qualifying_q1';
  const maxStep = 4; // 3 ticks + 1 final view per stage
  const [step, setStep] = useState<number>(0);
  const [autoplay, setAutoplay] = useState<boolean>(true);

  // Reset step when phase changes (Q1 → Q2)
  useEffect(() => {
    setStep(0);
    setAutoplay(true);
  }, [isQ1Phase]);

  useEffect(() => {
    if (!autoplay || step >= maxStep - 1) return;
    const t = setTimeout(() => setStep(s => s + 1), 1200);
    return () => clearTimeout(t);
  }, [step, autoplay, maxStep]);

  // Audio cue when reveal advances
  useEffect(() => {
    if (step > 0 && step < maxStep - 1) audio.play('tick');
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pole sound at Q2 final
  useEffect(() => {
    if (!isQ1Phase && step === maxStep - 1) audio.play('pole');
  }, [step, isQ1Phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const isQ1Done = isQ1Phase && step === maxStep - 1;
  const isQ2Done = !isQ1Phase && step === maxStep - 1;
  // Get the actual tick: Q1 uses ticks 0..2, Q2 uses ticks 3..5
  const tickIndex = (isQ1Phase ? 0 : 3) + step;
  const showFinal = step === maxStep - 1; // "final" view of the current stage
  const currentTick = !showFinal && tickIndex < q.ticks.length ? q.ticks[tickIndex] : null;
  // What to display:
  // - During Q1 ticks: show partial Q1 ranking from currentTick.
  // - At Q1 final (showFinal && isQ1Phase): show full Q1 ranking sorted by Q1 times — but our QualifyingResult.ranking is post-Q2.
  //   So we need to reconstruct Q1 final manually. Or better: the last Q1 tick (index 2) already shows all 24 drivers.
  //   So Q1 final = Q1 tick 3.
  // - During Q2 ticks: show ticks 3..5.
  // - At Q2 final: show q.ranking (which is Q2-sorted top 10 + Q1-sorted 11-24).
  let ranking: string[];
  let times: Record<string, number>;
  let stageLabel: string;

  if (isQ1Phase) {
    if (showFinal) {
      // Use last Q1 tick (index 2)
      const lastQ1Tick = q.ticks[2];
      ranking = lastQ1Tick.ranking;
      times = lastQ1Tick.times;
      stageLabel = 'Q1 — Final results';
    } else {
      ranking = currentTick!.ranking;
      times = currentTick!.times;
      stageLabel = `Q1 — Tick ${step + 1}/3`;
    }
  } else {
    if (showFinal) {
      ranking = q.ranking;
      times = q.times;
      stageLabel = 'Final qualifying results';
    } else {
      ranking = currentTick!.ranking;
      times = currentTick!.times;
      stageLabel = `Q2 — Tick ${step + 1}/3`;
    }
  }

  return (
    <>
      <h2>Qualifying — {stageLabel}</h2>
      {isQ2Done && q.poleDriverId && (
        <p>🏆 Pole position: <strong>{driverMap.get(q.poleDriverId)?.name}</strong></p>
      )}
      <div className="tick-controls">
        <button onClick={() => setStep(0)} disabled={step === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.min(maxStep - 1, step + 1)); }} disabled={step >= maxStep - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setStep(maxStep - 1); }} disabled={step === maxStep - 1}>⏭ Skip</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time</th><th>Stage</th></tr></thead>
        <tbody>
          {ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const time = times[id];
            const stage = isQ1Phase ? 'Q1' : (i < 10 ? 'Q2' : 'Q1');
            return (
              <tr key={id}>
                <td>{i + 1}</td>
                <td>{d?.name}</td>
                <td style={{ color: t?.color }}>{t?.shortName ?? '—'}</td>
                <td>{time !== undefined ? time.toFixed(3) : '—'}</td>
                <td>{stage}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="actions">
        {isQ1Done && <Q1DoneAction />}
        {isQ2Done && <button className="primary big" onClick={onStartRace}>Start Race →</button>}
      </div>
    </>
  );
}

function Q1DoneAction() {
  const { advanceToQ2 } = useGame();
  return (
    <button className="primary big" onClick={advanceToQ2}>Run Q2 →</button>
  );
}

function RaceResultsPane({ onFinish }: { onFinish: () => void }) {
  const { state } = useGame();
  const audio = useAudio();
  const r = state.lastRaceResult!;
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const totalSnapshots = r.snapshots.length;
  const [snap, setSnap] = useState<number>(0);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const cur = r.snapshots[snap];
  const isFinal = snap === totalSnapshots - 1;

  useEffect(() => {
    if (!autoplay || snap >= totalSnapshots - 1) return;
    const dramatic = snap === 0 || snap === totalSnapshots - 2;
    const t = setTimeout(() => setSnap(s => s + 1), dramatic ? 2000 : 1400);
    return () => clearTimeout(t);
  }, [snap, autoplay, totalSnapshots]);

  // Audio: lights out when component mounts (race start), engine loop during race,
  // checkered at end. Cleanup ensures engine stops if user navigates away.
  useEffect(() => {
    audio.play('lights_out');
    // Start engine loop a bit after lights out
    const startTimer = setTimeout(() => audio.startEngineLoop(), 1500);
    return () => {
      clearTimeout(startTimer);
      audio.stopEngineLoop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cues per snapshot reveal: incidents → crash sound, big position swings → overtake.
  useEffect(() => {
    if (snap === 0) return;
    // Crash if any incident this lap is a real DNF/collision
    const hasCrash = cur.newIncidents.some(inc =>
      inc.type === 'crash_dnf' || inc.type === 'mechanical_dnf' || inc.causesInjury
    );
    if (hasCrash) audio.play('crash');
    // Overtakes: count drivers who gained ≥2 positions vs quali at this snapshot
    const bigMover = Object.values(cur.positionsGainedVsQuali).filter(v => v >= 2).length;
    if (!hasCrash && bigMover > 0) audio.play('overtake');
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checkered + engine stop at final reveal
  useEffect(() => {
    if (isFinal) {
      audio.stopEngineLoop();
      setTimeout(() => audio.play('checkered'), 200);
    }
  }, [isFinal]); // eslint-disable-line react-hooks/exhaustive-deps

  const lapLabel = (lap: number) => {
    if (lap === 0) return 'Starting Grid';
    if (lap === 3) return 'After Lap 3 — Opening Laps';
    if (lap === 48) return 'After Lap 48 — Closing In';
    if (lap === 50) return 'Final Result (Lap 50)';
    return `After Lap ${lap}`;
  };

  return (
    <>
      <h2>Race — {lapLabel(cur.lap)}</h2>
      {isFinal && (
        <p>🏁 Winner: <strong>{driverMap.get(r.finalRanking[0])?.name}</strong> &nbsp;|&nbsp;
          ⚡ Fastest lap: <strong>{driverMap.get(r.fastestLapDriverId)?.name}</strong> &nbsp;|&nbsp;
          DNFs: {r.dnfs.length}</p>
      )}
      <div className="tick-controls">
        <button onClick={() => setSnap(0)} disabled={snap === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setSnap(Math.max(0, snap - 1)); }} disabled={snap === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setSnap(Math.min(totalSnapshots - 1, snap + 1)); }} disabled={snap >= totalSnapshots - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setSnap(totalSnapshots - 1); }} disabled={isFinal}>⏭ Skip</button>
      </div>
      <div className="lap-controls">
        <span>Jump to:</span>
        {r.snapshots.map((s, i) => (
          <button key={i} className={i === snap ? 'active' : ''} onClick={() => { setAutoplay(false); setSnap(i); }}>
            {s.lap === 0 ? 'Grid' : `L${s.lap}`}
          </button>
        ))}
      </div>
      <table className="data-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Δ vs Quali</th><th>Status</th></tr></thead>
        <tbody>
          {cur.ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const delta = cur.positionsGainedVsQuali[id] ?? 0;
            const isDNF = r.dnfs.includes(id);
            return (
              <tr key={id}>
                <td>{i + 1}</td>
                <td>{d?.name}</td>
                <td style={{ color: t?.color }}>{t?.shortName ?? '—'}</td>
                <td>{delta > 0 ? <span className="up">▲ {delta}</span> : delta < 0 ? <span className="down">▼ {-delta}</span> : '—'}</td>
                <td>{isDNF ? <span className="down">DNF</span> : ''}{isFinal && !isDNF && r.pointsAwarded[id] ? `+${r.pointsAwarded[id]} pts` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cur.newIncidents.length > 0 && (
        <div className="incidents">
          <h4>Incidents on lap {cur.lap}:</h4>
          <ul>
            {cur.newIncidents.map((inc, i) => (
              <li key={i}>{driverMap.get(inc.driverId)?.name}: {inc.type.replace('_', ' ')}
                {inc.causesInjury && ` (injury — out for ${inc.injuryRaces} race${inc.injuryRaces > 1 ? 's' : ''})`}
                {inc.delaySeconds > 0 && ` (lost ${inc.delaySeconds}s)`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="actions">
        <button className="primary big" onClick={onFinish} disabled={!isFinal}>
          {isFinal ? (state.currentRound === state.calendar.length ? 'End Season →' : 'Continue →') : 'Wait...'}
        </button>
      </div>
    </>
  );
}

// ============================================================================
// HELPERS
// ============================================================================
function teamByDriverMap(teams: Team[]): Map<string, Team> {
  const m = new Map<string, Team>();
  for (const t of teams) {
    if (t.driver1Id) m.set(t.driver1Id, t);
    if (t.driver2Id) m.set(t.driver2Id, t);
    if (t.testDriverId) m.set(t.testDriverId, t);
  }
  return m;
}

// Map of all drivers including retired — for lookups in result views (winners might be retired now)
function allDriversMap(state: ReturnType<typeof useGame>['state']): Map<string, Driver> {
  return new Map([...state.drivers, ...state.retiredDrivers].map(d => [d.id, d]));
}

function rarityOrder(r: Rarity): number {
  return { legend: 0, epic: 1, rare: 2, uncommon: 3, common: 4 }[r];
}

function sortDrivers(drivers: Driver[], k: DriverSortKey, asc: boolean, teamByDriver: Map<string, Team>): Driver[] {
  const dir = asc ? 1 : -1;
  return [...drivers].sort((a, b) => {
    const sa = effectiveDriverSkills(a);
    const sb = effectiveDriverSkills(b);
    const teamA = teamByDriver.get(a.id)?.name ?? '~Free Agent';
    const teamB = teamByDriver.get(b.id)?.name ?? '~Free Agent';
    switch (k) {
      case 'name': return dir * a.name.localeCompare(b.name);
      case 'team': return dir * teamA.localeCompare(teamB);
      case 'age': return dir * (a.age - b.age);
      case 'rarity': return dir * (rarityOrder(a.rarity) - rarityOrder(b.rarity));
      case 'driving': return dir * (sa.driving - sb.driving);
      case 'physical': return dir * (sa.physical - sb.physical);
      case 'carSetup': return dir * (sa.carSetup - sb.carSetup);
      case 'speed': return dir * (sa.speed - sb.speed);
      case 'overall': return dir * (driverOverall(a) - driverOverall(b));
      case 'years': return dir * ((a.age - a.careerStartAge) - (b.age - b.careerStartAge));
    }
  });
}

function toggleSort<T extends string>(
  k: T, current: T, asc: boolean,
  setKey: (k: T) => void, setAsc: (b: boolean) => void
) {
  if (k === current) setAsc(!asc);
  else { setKey(k); setAsc(false); }
}

function SortHeader<T extends string>({ label, k, curr, asc, onClick }: {
  label: string; k: T; curr: T; asc: boolean; onClick: (k: T) => void;
}) {
  return (
    <th onClick={() => onClick(k)} className="sortable">
      {label} {k === curr ? (asc ? '▲' : '▼') : ''}
    </th>
  );
}

function DriverLink({ id, drivers, onClick }: { id: string; drivers: Driver[]; onClick: (d: Driver) => void }) {
  const d = drivers.find(x => x.id === id);
  if (!d) return <span>—</span>;
  return <button className="link-btn" onClick={() => onClick(d)}>{d.name}</button>;
}

// Suppress unused-import warning (DriverYearRecord is used by type narrowing only)
void ({} as DriverYearRecord);

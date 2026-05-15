import { useState, useEffect } from 'react';
import { GameProvider, useGame } from './GameContext';
import { Driver, Team } from './sim/types';
import { effectiveDriverSkills } from './sim/generators';
import { remainingPoints, carPointCost, MarketMove } from './sim/market';
import { SeasonSummary } from './sim/season';

import './App.css';

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}

function GameShell() {
  const { state } = useGame();
  return (
    <div className="app">
      <header className="header">
        <h1>F1 Sim</h1>
        <div className="header-info">
          <span>Year {state.year}</span>
          <span>Round {state.currentRound} / {state.calendar.length}</span>
          <span>Phase: {state.phase}</span>
        </div>
      </header>
      <main>
        <Router />
      </main>
    </div>
  );
}

function Router() {
  const { state } = useGame();
  switch (state.phase) {
    case 'season_start':       return <SeasonStartScreen />;
    case 'pre_race':           return <PreRaceScreen />;
    case 'qualifying_results': return <QualiResultsScreen />;
    case 'race_results':       return <RaceResultsScreen />;
    case 'season_summary':     return <SeasonSummaryScreen />;
    default:                   return <SeasonStartScreen />;
  }
}

// ============================================================================
// SEASON START - shows teams, rosters, calendar
// ============================================================================
function SeasonStartScreen() {
  const { state, advanceToNextGP } = useGame();
  const [tab, setTab] = useState<'teams' | 'pool' | 'calendar'>('teams');

  return (
    <div className="screen">
      <h2>Season {state.year}</h2>
      <div className="tabs">
        <button onClick={() => setTab('teams')} className={tab === 'teams' ? 'active' : ''}>Teams</button>
        <button onClick={() => setTab('pool')} className={tab === 'pool' ? 'active' : ''}>Driver Pool</button>
        <button onClick={() => setTab('calendar')} className={tab === 'calendar' ? 'active' : ''}>Calendar</button>
      </div>
      {tab === 'teams' && <TeamsView />}
      {tab === 'pool' && <DriverPoolView />}
      {tab === 'calendar' && <CalendarView />}
      <div className="actions">
        <button className="primary" onClick={() => { advanceToNextGP(); }}>
          Start Season → Round 1
        </button>
      </div>
    </div>
  );
}

function TeamsView() {
  const { state } = useGame();
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const engMap = new Map(state.engineeringDirectors.map(e => [e.id, e]));
  const rdMap = new Map(state.raceDirectors.map(r => [r.id, r]));
  const sorted = [...state.teams].sort((a, b) => {
    const aAvg = (a.car.maxSpeed + a.car.acceleration + a.car.turning + a.car.reliability) / 4;
    const bAvg = (b.car.maxSpeed + b.car.acceleration + b.car.turning + b.car.reliability) / 4;
    return bAvg - aAvg;
  });
  return (
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
            <h3>{t.name} <small>({t.shortName})</small></h3>
            <div className="row">
              <span>Tier: {t.tier}</span>
              <span>Cap: {t.marketPoints}</span>
              <span>Car cost: {carPts}</span>
              <span>Unused: {rem}</span>
            </div>
            <div className="row">
              <span>Speed: {t.car.maxSpeed}</span>
              <span>Accel: {t.car.acceleration}</span>
              <span>Turn: {t.car.turning}</span>
              <span>Reliab: {t.car.reliability}</span>
            </div>
            <div className="roster">
              <RosterLine label="D1" d={d1} />
              <RosterLine label="D2" d={d2} />
              <RosterLine label="Test" d={td} />
              <div className="director-line">
                Eng Dir: {eng ? `${eng.name} (${eng.rarity}) targets S${eng.speedTarget}/A${eng.accelTarget}/T${eng.turningTarget}/R${eng.reliabilityTarget} @${Math.round(eng.pullFactor * 100)}% pull` : '—'}
              </div>
              <div className="director-line">
                Race Dir: {rd ? `${rd.name} (${rd.rarity}) ${rd.timeImprovementPct}% / +${rd.reliabilityBonus}rel` : '—'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RosterLine({ label, d }: { label: string; d: Driver | null | undefined }) {
  if (!d) return <div>{label}: —</div>;
  const skills = effectiveDriverSkills(d);
  return (
    <div className="driver-line">
      <strong>{label}:</strong> {d.name} <span className={`rarity rarity-${d.rarity}`}>{d.rarity}</span>
      &nbsp;<em>{d.archetype}</em> &nbsp;age {d.age}
      &nbsp;[D{skills.driving} P{skills.physical} C{skills.carSetup} S{skills.speed}]
      {d.injuredRaces > 0 && <span className="injury"> 🚑 out {d.injuredRaces}</span>}
      {d.retirementAnnounced && <span className="retiring"> ⏳ final season</span>}
    </div>
  );
}

function DriverPoolView() {
  const { state } = useGame();
  const sorted = [...state.drivers].sort((a, b) => {
    const order = { legend: 0, epic: 1, rare: 2, uncommon: 3, common: 4 } as const;
    return order[a.rarity] - order[b.rarity];
  });
  return (
    <div>
      <p>Total drivers: {state.drivers.length}. Free agents: {state.freeAgentDriverIds.length}</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th><th>Rarity</th><th>Archetype</th><th>Age</th><th>D</th><th>P</th><th>C</th><th>S</th><th>Wins</th><th>Champs</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => {
            const s = effectiveDriverSkills(d);
            return (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td className={`rarity rarity-${d.rarity}`}>{d.rarity}</td>
                <td>{d.archetype}</td>
                <td>{d.age}</td>
                <td>{s.driving}</td>
                <td>{s.physical}</td>
                <td>{s.carSetup}</td>
                <td>{s.speed}</td>
                <td>{d.careerWins}</td>
                <td>{d.careerChampionships}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView() {
  const { state } = useGame();
  return (
    <table className="data-table">
      <thead>
        <tr><th>#</th><th>Circuit</th><th>Country</th><th>Profile</th><th>Weather</th></tr>
      </thead>
      <tbody>
        {state.calendar.map((gp, i) => (
          <tr key={gp.circuit.id} className={i + 1 === state.currentRound ? 'current' : ''}>
            <td>{gp.round}</td>
            <td>{gp.circuit.name}</td>
            <td>{gp.circuit.country}</td>
            <td>{gp.circuit.profile}</td>
            <td>{gp.weather}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================
// PRE-RACE
// ============================================================================
function PreRaceScreen() {
  const { state, runQualifying } = useGame();
  const gp = state.calendar[state.currentRound - 1];
  return (
    <div className="screen">
      <h2>Round {gp.round} - {gp.circuit.name} ({gp.circuit.country})</h2>
      <div className="info-box">
        <p>Circuit profile: <strong>{gp.circuit.profile}</strong></p>
        <p>Weather: <strong>{gp.weather}</strong></p>
        <p>Laps: <strong>{gp.circuit.laps}</strong></p>
        {gp.weather === 'hot' && <p>🔥 Extreme heat - drivers with high physical/cardio favored.</p>}
        {gp.weather === 'rain' && <p>🌧️ Rain - high driving skill & wet specialists favored.</p>}
      </div>
      <StandingsPreview />
      <div className="actions">
        <button className="primary" onClick={() => runQualifying()}>Run Qualifying</button>
      </div>
    </div>
  );
}

function StandingsPreview() {
  const { state } = useGame();
  if (state.currentRound === 1) return null;
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamMap = new Map(state.teams.map(t => [t.id, t]));
  return (
    <div className="standings-preview">
      <div>
        <h3>Driver Standings (top 10)</h3>
        <ol>
          {state.driverStandings.slice(0, 10).map(s => {
            const d = driverMap.get(s.driverId);
            return <li key={s.driverId}>{d?.name} - {s.points}</li>;
          })}
        </ol>
      </div>
      <div>
        <h3>Team Standings</h3>
        <ol>
          {state.teamStandings.map(s => {
            const t = teamMap.get(s.teamId);
            return <li key={s.teamId}>{t?.name} - {s.points}</li>;
          })}
        </ol>
      </div>
    </div>
  );
}

// ============================================================================
// QUALI RESULTS - with progressive tick reveal animation
// ============================================================================
function QualiResultsScreen() {
  const { state, runRace } = useGame();
  const q = state.lastQualiResult;
  if (!q) return <p>No quali result.</p>;
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamByDriver = teamByDriverMap(state.teams);

  // Tick state: which tick is currently shown (0 = empty grid, then ticks 1..N, then full result)
  const totalSteps = q.ticks.length + 1; // +1 for final result step
  const [step, setStep] = useState<number>(0);
  const [autoplay, setAutoplay] = useState<boolean>(true);

  useEffect(() => {
    if (!autoplay) return;
    if (step >= totalSteps - 1) return;
    const t = setTimeout(() => setStep(s => s + 1), 1200);
    return () => clearTimeout(t);
  }, [step, autoplay, totalSteps]);

  // Decide what to show at current step
  const isFinalStep = step >= q.ticks.length;
  const currentTick = !isFinalStep ? q.ticks[step] : null;
  const ranking = isFinalStep ? q.ranking : currentTick!.ranking;
  const times = isFinalStep ? q.times : currentTick!.times;
  const stageLabel = isFinalStep
    ? 'Final Results'
    : `${currentTick!.stage} — Tick ${q.ticks.filter((t, i) => i <= step && t.stage === currentTick!.stage).length}/3`;

  return (
    <div className="screen">
      <h2>Qualifying — {stageLabel}</h2>
      {isFinalStep && (
        <p>🏆 Pole position: <strong>{driverMap.get(q.poleDriverId)?.name}</strong></p>
      )}
      <div className="tick-controls">
        <button onClick={() => setStep(0)} disabled={step === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.min(totalSteps - 1, step + 1)); }} disabled={step >= totalSteps - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setStep(totalSteps - 1); }} disabled={step === totalSteps - 1}>⏭ Skip to end</button>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time</th><th>Q</th></tr>
        </thead>
        <tbody>
          {ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const time = times[id];
            // Q stage indicator: if we're in Q1 tick, everyone shown is Q1.
            // If we're in Q2 tick or final, top 10 are Q2.
            const stage = isFinalStep
              ? (i < 10 ? 'Q2' : 'Q1')
              : currentTick!.stage;
            return (
              <tr key={id}>
                <td>{i + 1}</td>
                <td>{d?.name}</td>
                <td style={{ color: t?.color }}>{t?.shortName}</td>
                <td>{time !== undefined ? time.toFixed(3) : '—'}</td>
                <td>{stage}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="actions">
        <button className="primary" onClick={() => runRace()} disabled={!isFinalStep}>
          {isFinalStep ? 'Start Race!' : 'Wait for results...'}
        </button>
      </div>
    </div>
  );
}

function teamByDriverMap(teams: Team[]): Map<string, Team> {
  const map = new Map<string, Team>();
  for (const t of teams) {
    if (t.driver1Id) map.set(t.driver1Id, t);
    if (t.driver2Id) map.set(t.driver2Id, t);
    if (t.testDriverId) map.set(t.testDriverId, t);
  }
  return map;
}

// ============================================================================
// RACE RESULTS — with auto-playing snapshot reveals (5 snapshots + grid).
// Snapshots: Grid → after L3 → after L18 → after L33 → after L48 → after L50 (final)
// ============================================================================
function RaceResultsScreen() {
  const { state, advanceToNextGP, finishSeason } = useGame();
  const r = state.lastRaceResult;
  if (!r) return <p>No race result.</p>;
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamByDriver = teamByDriverMap(state.teams);

  const totalSnapshots = r.snapshots.length; // 6 total: grid + 5 segments
  const [activeSnapshot, setActiveSnapshot] = useState<number>(0);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const snap = r.snapshots[activeSnapshot];
  const isFinalSnapshot = activeSnapshot === totalSnapshots - 1;
  const isLastGP = state.currentRound === state.calendar.length;

  // Auto-advance through snapshots
  useEffect(() => {
    if (!autoplay) return;
    if (activeSnapshot >= totalSnapshots - 1) return;
    // Slower for opening/closing (more drama), faster for mid-race
    const isDramaticSnapshot = activeSnapshot === 0 || activeSnapshot === totalSnapshots - 2;
    const delay = isDramaticSnapshot ? 2000 : 1400;
    const t = setTimeout(() => setActiveSnapshot(s => s + 1), delay);
    return () => clearTimeout(t);
  }, [activeSnapshot, autoplay, totalSnapshots]);

  const lapLabel = (lap: number): string => {
    if (lap === 0) return 'Starting Grid';
    if (lap === 3) return 'After Lap 3 — Opening Laps';
    if (lap === 48) return 'After Lap 48 — Closing In';
    if (lap === 50) return 'Final Result (Lap 50)';
    return `After Lap ${lap}`;
  };

  return (
    <div className="screen">
      <h2>Race — {lapLabel(snap.lap)}</h2>
      {isFinalSnapshot && (
        <p>
          🏁 Winner: <strong>{driverMap.get(r.finalRanking[0])?.name}</strong> &nbsp;|&nbsp;
          ⚡ Fastest lap: <strong>{driverMap.get(r.fastestLapDriverId)?.name}</strong> &nbsp;|&nbsp;
          DNFs: {r.dnfs.length}
        </p>
      )}

      <div className="tick-controls">
        <button onClick={() => setActiveSnapshot(0)} disabled={activeSnapshot === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setActiveSnapshot(Math.max(0, activeSnapshot - 1)); }} disabled={activeSnapshot === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setActiveSnapshot(Math.min(totalSnapshots - 1, activeSnapshot + 1)); }} disabled={activeSnapshot >= totalSnapshots - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setActiveSnapshot(totalSnapshots - 1); }} disabled={isFinalSnapshot}>⏭ Skip to end</button>
      </div>

      <div className="lap-controls">
        <span>Jump to:</span>
        {r.snapshots.map((s, i) => (
          <button key={i} className={i === activeSnapshot ? 'active' : ''} onClick={() => { setAutoplay(false); setActiveSnapshot(i); }}>
            {s.lap === 0 ? 'Grid' : `L${s.lap}`}
          </button>
        ))}
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Pos</th><th>Driver</th><th>Team</th><th>Δ vs Quali</th><th>Status</th></tr>
        </thead>
        <tbody>
          {snap.ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const delta = snap.positionsGainedVsQuali[id] ?? 0;
            const isDNF = r.dnfs.includes(id);
            return (
              <tr key={id}>
                <td>{i + 1}</td>
                <td>{d?.name}</td>
                <td style={{ color: t?.color }}>{t?.shortName}</td>
                <td>
                  {delta > 0 ? <span className="up">▲ {delta}</span> :
                   delta < 0 ? <span className="down">▼ {-delta}</span> :
                   <span>—</span>}
                </td>
                <td>
                  {isDNF ? <span className="down">DNF</span> : ''}
                  {isFinalSnapshot && !isDNF && r.pointsAwarded[id] ? `+${r.pointsAwarded[id]} pts` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {snap.newIncidents.length > 0 && (
        <div className="incidents">
          <h4>Incidents on lap {snap.lap}:</h4>
          <ul>
            {snap.newIncidents.map((inc, i) => (
              <li key={i}>
                {driverMap.get(inc.driverId)?.name}: {inc.type.replace('_', ' ')}
                {inc.causesInjury && ` (injury — out for ${inc.injuryRaces} race${inc.injuryRaces > 1 ? 's' : ''})`}
                {inc.delaySeconds > 0 && ` (lost ${inc.delaySeconds}s)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions">
        {!isLastGP && <button className="primary" onClick={advanceToNextGP} disabled={!isFinalSnapshot}>
          {isFinalSnapshot ? 'Next Grand Prix →' : 'Wait for race to finish...'}
        </button>}
        {isLastGP && <button className="primary" onClick={() => finishSeason()} disabled={!isFinalSnapshot}>
          {isFinalSnapshot ? 'End of Season →' : 'Wait for race to finish...'}
        </button>}
      </div>
    </div>
  );
}

// ============================================================================
// SEASON SUMMARY -> NEW CARS -> MARKET -> NEW SEASON
// ============================================================================
function SeasonSummaryScreen() {
  const { state, startNewSeason, finishSeason } = useGame();
  const [stage, setStage] = useState<'summary' | 'cars' | 'market'>('summary');
  const [summary] = useState<SeasonSummary>(() => finishSeason());
  const [marketResult, setMarketResult] = useState<{
    retirementMoves: MarketMove[];
    marketMoves: MarketMove[];
    newCarChanges: Array<{ teamId: string; before: Team['car']; after: Team['car'] }>;
  } | null>(null);
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamMap = new Map(state.teams.map(t => [t.id, t]));

  if (stage === 'summary') {
    return (
      <div className="screen">
        <h2>Season {summary.year} Summary</h2>
        <div className="awards">
          <div>🏆 Champion: <strong>{driverMap.get(summary.championDriverId)?.name}</strong></div>
          <div>🏭 Constructor: <strong>{teamMap.get(summary.championTeamId)?.name}</strong></div>
          <div>🥇 Most wins: <strong>{driverMap.get(summary.mostWinsDriverId)?.name}</strong> ({driverMap.get(summary.mostWinsDriverId)?.seasonWins})</div>
          {summary.rookieOfYearDriverId && (
            <div>🌟 Rookie of the Year: <strong>{driverMap.get(summary.rookieOfYearDriverId)?.name}</strong></div>
          )}
        </div>
        <h3>Final Driver Standings</h3>
        <table className="data-table">
          <thead><tr><th>Pos</th><th>Driver</th><th>Points</th><th>Wins</th></tr></thead>
          <tbody>
            {summary.finalDriverStandings.map((s, i) => {
              const d = driverMap.get(s.driverId);
              return <tr key={s.driverId}><td>{i + 1}</td><td>{d?.name}</td><td>{s.points}</td><td>{d?.seasonWins ?? 0}</td></tr>;
            })}
          </tbody>
        </table>
        <h3>Final Constructor Standings</h3>
        <table className="data-table">
          <thead><tr><th>Pos</th><th>Team</th><th>Points</th></tr></thead>
          <tbody>
            {summary.finalTeamStandings.map((s, i) => {
              const t = teamMap.get(s.teamId);
              return <tr key={s.teamId}><td>{i + 1}</td><td style={{ color: t?.color }}>{t?.name}</td><td>{s.points}</td></tr>;
            })}
          </tbody>
        </table>
        <div className="actions">
          <button className="primary" onClick={() => {
            const result = startNewSeason();
            setMarketResult(result);
            setStage('cars');
          }}>New Cars Unveiling →</button>
        </div>
      </div>
    );
  }

  if (stage === 'cars' && marketResult) {
    return (
      <div className="screen">
        <h2>{state.year} Cars Unveiled</h2>
        <table className="data-table">
          <thead>
            <tr><th>Team</th><th>Speed</th><th>Accel</th><th>Turn</th><th>Reliab</th></tr>
          </thead>
          <tbody>
            {marketResult.newCarChanges.map(c => {
              const t = teamMap.get(c.teamId);
              if (!t) return null;
              return (
                <tr key={c.teamId}>
                  <td style={{ color: t.color }}>{t.name}</td>
                  <td><Delta before={c.before.maxSpeed} after={c.after.maxSpeed} /></td>
                  <td><Delta before={c.before.acceleration} after={c.after.acceleration} /></td>
                  <td><Delta before={c.before.turning} after={c.after.turning} /></td>
                  <td><Delta before={c.before.reliability} after={c.after.reliability} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p><em>(Stats shown are pre-engineering-director boost.)</em></p>
        <div className="actions">
          <button className="primary" onClick={() => setStage('market')}>Market Summary →</button>
        </div>
      </div>
    );
  }

  if (stage === 'market' && marketResult) {
    return (
      <div className="screen">
        <h2>{state.year} Market Summary</h2>
        <h3>Retirements & New Arrivals</h3>
        <div className="market-list">
          {marketResult.retirementMoves.map((m, i) => <MoveCard key={i} m={m} />)}
        </div>
        <h3>Signings</h3>
        <div className="market-list">
          {marketResult.marketMoves.map((m, i) => <MoveCard key={i} m={m} />)}
        </div>
        <div className="actions">
          <button className="primary" onClick={() => window.location.reload()}>
            Start Season {state.year} →
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Delta({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  return (
    <span>
      {before} → <strong>{after}</strong>{' '}
      {diff > 0 ? <span className="up">+{diff}</span> :
       diff < 0 ? <span className="down">{diff}</span> :
       <span>—</span>}
    </span>
  );
}

function MoveCard({ m }: { m: MarketMove }) {
  return (
    <div className="move-card">
      <strong>{labelFor(m.kind)}</strong>
      <div>{m.entityName} {m.entityRarity && <span className={`rarity rarity-${m.entityRarity}`}>{m.entityRarity}</span>}</div>
      {m.fromTeam && <div>From: {m.fromTeam}</div>}
      {m.toTeam && <div>To: {m.toTeam}</div>}
      {m.position && <div className="muted">{m.position}</div>}
    </div>
  );
}

function labelFor(kind: MarketMove['kind']): string {
  switch (kind) {
    case 'driver_signed':    return '✍️ Signed';
    case 'driver_released':  return '👋 Released';
    case 'driver_retired':   return '⏹️ Retired';
    case 'rookie_arrived':   return '🌟 New rookie';
    case 'director_signed':  return '✍️ Director signed';
    case 'director_released':return '👋 Director released';
    case 'director_retired': return '⏹️ Director retired';
  }
}

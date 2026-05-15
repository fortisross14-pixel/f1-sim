import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../../GameContext';
import { PreseasonData, Driver, Team } from '../../sim/types';
import { useAudio } from '../../audio';
import { DriverDetailPopup } from '../popups/DriverDetailPopup';
import { TeamDetailPopup } from '../popups/TeamDetailPopup';
import { DriverLink } from '../common/DriverLink';
import { allDriversMap, teamByDriverMap } from '../common/helpers';

// World Championship tab — split into Current and Pre-season sub-tabs.
// Auto-switches to Pre-season when the season just ended.
export function WorldChampionshipTab() {
  const { state } = useGame();
  const [sub, setSub] = useState<'current' | 'preseason'>(
    state.phase === 'preseason' ? 'preseason' : 'current'
  );

  useEffect(() => {
    if (state.phase === 'preseason') setSub('preseason');
  }, [state.phase]);

  return (
    <div className="screen">
      <div className="sub-tabs">
        <button onClick={() => setSub('current')} className={sub === 'current' ? 'active' : ''}>
          Current
        </button>
        <button
          onClick={() => setSub('preseason')}
          className={sub === 'preseason' ? 'active' : ''}
          disabled={!state.lastPreseasonData}
        >
          Pre-season
        </button>
      </div>
      {sub === 'current' && <WCCurrentView />}
      {sub === 'preseason' && state.lastPreseasonData && (
        <WCPreseasonView data={state.lastPreseasonData} />
      )}
      {sub === 'preseason' && !state.lastPreseasonData && (
        <p className="muted">
          No pre-season data yet — finish a season to see retirements, market moves, and car changes.
        </p>
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
          <button className="primary big" onClick={() => startRaceWeekend()}>
            Run next race →
          </button>
        )}
        {isPreseason && (
          <button className="primary big" onClick={() => startNewYear()}>
            Begin Year {state.year} →
          </button>
        )}
      </div>

      <h3>Calendar &amp; results</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th><th>Circuit</th><th>Country</th><th>Profile</th>
            <th>Weather</th><th>Pole</th><th>Winner</th><th>Fastest lap</th>
          </tr>
        </thead>
        <tbody>
          {state.calendar.map((gp) => {
            const completed = state.completedRaces[gp.round];
            const isCurrent = gp.round === state.currentRound && !seasonComplete;
            const poleId = completed?.qualifying.poleDriverId;
            const winnerId = completed?.race.finalRanking[0];
            const flId = completed?.race.fastestLapDriverId;
            const allDrivers = state.drivers.concat(state.retiredDrivers);
            return (
              <tr key={gp.circuit.id} className={isCurrent ? 'current' : ''}>
                <td>{gp.round}</td>
                <td>{gp.circuit.name}</td>
                <td>{gp.circuit.country}</td>
                <td>{gp.circuit.profile}</td>
                <td>{gp.weather}</td>
                <td>
                  {poleId ? (
                    <DriverLink id={poleId} onClick={setPopupDriver} drivers={allDrivers} />
                  ) : (isCurrent ? '⟶ next' : '')}
                </td>
                <td>
                  {winnerId ? (
                    <DriverLink id={winnerId} onClick={setPopupDriver} drivers={allDrivers} />
                  ) : ''}
                </td>
                <td>
                  {flId ? (
                    <DriverLink id={flId} onClick={setPopupDriver} drivers={allDrivers} />
                  ) : ''}
                </td>
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
                    <td>
                      <button className="link-btn" style={{ color: t.color }} onClick={() => setPopupTeam(t)}>
                        {t.name}
                      </button>
                    </td>
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

// ============================================================================
// PRESEASON SUB-VIEW
// ============================================================================
function WCPreseasonView({ data }: { data: PreseasonData }) {
  const { state, startNewYear } = useGame();
  const [section, setSection] = useState<'summary' | 'market' | 'cars'>('summary');
  const isCurrentlyInPreseason = state.phase === 'preseason';

  return (
    <>
      <div className="sub-sub-tabs">
        <button onClick={() => setSection('summary')} className={section === 'summary' ? 'active' : ''}>
          Season {data.yearEnded} Summary
        </button>
        <button onClick={() => setSection('market')} className={section === 'market' ? 'active' : ''}>
          Market
        </button>
        <button onClick={() => setSection('cars')} className={section === 'cars' ? 'active' : ''}>
          Car Evolution
        </button>
      </div>
      {section === 'summary' && <PreseasonSummary data={data} />}
      {section === 'market' && <PreseasonMarket data={data} />}
      {section === 'cars' && <PreseasonCars data={data} />}
      {isCurrentlyInPreseason && (
        <div className="actions">
          <button className="primary big" onClick={() => startNewYear()}>
            Begin Year {state.year} →
          </button>
        </div>
      )}
    </>
  );
}

function PreseasonSummary({ data }: { data: PreseasonData }) {
  const audio = useAudio();
  // Champion fanfare on first mount of the summary
  useEffect(() => { audio.play('champion'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="awards">
        <div>🏆 World Champion: <strong>{data.championDriverName}</strong></div>
        <div>🏭 Constructors': <strong>{data.finalTeamStandings[0]?.teamName ?? '—'}</strong></div>
        <div>🥇 Most wins: <strong>
          {data.finalDriverStandings.find(d => d.driverId === data.mostWinsDriverId)?.driverName ?? '—'}
        </strong></div>
        {data.rookieOfYearDriverId && (
          <div>🌟 Rookie of the Year: <strong>
            {data.finalDriverStandings.find(d => d.driverId === data.rookieOfYearDriverId)?.driverName ?? '—'}
          </strong></div>
        )}
      </div>
      <h3>Final Driver Standings</h3>
      <table className="data-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Points</th><th>Wins</th></tr></thead>
        <tbody>
          {data.finalDriverStandings.map((s, i) => (
            <tr key={s.driverId}>
              <td>{i + 1}</td><td>{s.driverName}</td><td>{s.teamName}</td><td>{s.points}</td><td>{s.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Final Constructor Standings</h3>
      <table className="data-table">
        <thead><tr><th>Pos</th><th>Team</th><th>Points</th><th>Wins</th></tr></thead>
        <tbody>
          {data.finalTeamStandings.map((s, i) => (
            <tr key={s.teamId}>
              <td>{i + 1}</td><td>{s.teamName}</td><td>{s.points}</td><td>{s.wins}</td>
            </tr>
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
            <div className="muted">
              {r.kind === 'driver' ? 'Driver' : r.kind === 'engDirector' ? 'Eng Director' : 'Race Director'}
            </div>
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
      {diff > 0 ? <span className="up">+{diff}</span>
        : diff < 0 ? <span className="down">{diff}</span>
        : <span>—</span>}
    </span>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../../GameContext';
import { PreseasonData, Driver, Team } from '../../sim/types';
import { useAudio } from '../../audio';
import { DriverDetailPopup } from '../popups/DriverDetailPopup';
import { TeamDetailPopup } from '../popups/TeamDetailPopup';
import { DriverLink } from '../common/DriverLink';
import { Flag } from '../common/Flag';
import { allDriversMap, teamByDriverMap } from '../common/helpers';

// ============================================================================
// WORLD CHAMPIONSHIP TAB
// Three sub-tabs: Calendar, Standings, Pre-season.
// Auto-switches to Pre-season when a season has just ended (phase='preseason').
// ============================================================================
type WcSubTab = 'calendar' | 'standings' | 'preseason';

export function WorldChampionshipTab() {
  const { state } = useGame();
  const [sub, setSub] = useState<WcSubTab>(state.phase === 'preseason' ? 'preseason' : 'calendar');

  useEffect(() => {
    if (state.phase === 'preseason') setSub('preseason');
  }, [state.phase]);

  return (
    <div className="screen">
      <RaceActionBar />

      <div className="sub-tabs">
        <button onClick={() => setSub('calendar')} className={sub === 'calendar' ? 'active' : ''}>
          Calendar
        </button>
        <button onClick={() => setSub('standings')} className={sub === 'standings' ? 'active' : ''}>
          Standings
        </button>
        <button
          onClick={() => setSub('preseason')}
          className={sub === 'preseason' ? 'active' : ''}
          disabled={!state.lastPreseasonData}
        >
          Pre-season
        </button>
      </div>

      {sub === 'calendar' && <CalendarView />}
      {sub === 'standings' && <StandingsView />}
      {sub === 'preseason' && state.lastPreseasonData && (
        <PreseasonView data={state.lastPreseasonData} />
      )}
      {sub === 'preseason' && !state.lastPreseasonData && (
        <p className="muted">
          No pre-season data yet — finish a season to see retirements, market moves, and car changes.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// RACE ACTION BAR — sticky banner at the top of the WC tab showing the next
// race (or end-of-season prompt) with the primary CTA. Always visible across
// all three sub-tabs so the player can launch a race from anywhere.
// ============================================================================
function RaceActionBar() {
  const { state, startRaceWeekend, startNewYear } = useGame();
  const isPreseason = state.phase === 'preseason';
  const seasonComplete = state.currentRound > state.calendar.length || isPreseason;
  const nextGp = !seasonComplete ? state.calendar[state.currentRound - 1] : null;

  if (isPreseason) {
    return (
      <div className="race-action-bar preseason-bar">
        <div className="race-action-info">
          <div className="race-action-label">Season {state.year - 1} complete</div>
          <div className="race-action-title">Ready for Year {state.year}</div>
        </div>
        <button className="primary big" onClick={startNewYear}>
          Begin Year {state.year} →
        </button>
      </div>
    );
  }

  if (!nextGp) return null;

  return (
    <div className="race-action-bar">
      <div className="race-action-info">
        <div className="race-action-label">Next race · Round {nextGp.round}</div>
        <div className="race-action-title">
          {nextGp.circuit.name}
          <span className="race-action-country">{nextGp.circuit.country}</span>
        </div>
        <div className="race-action-meta">
          <span>{nextGp.circuit.profile}</span>
          <span>·</span>
          <span>{nextGp.weather}</span>
          <span>·</span>
          <span>{nextGp.circuit.laps} laps</span>
        </div>
      </div>
      <button className="primary big" onClick={startRaceWeekend}>
        Run race →
      </button>
    </div>
  );
}

// ============================================================================
// CALENDAR SUB-TAB — same tabular view as before, just styled-up.
// Adds: round badge, country flag (where we can map circuit→country), pole/
// winner/FL chips, current row gets a left red bar.
// ============================================================================
function CalendarView() {
  const { state } = useGame();
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);
  const allDrivers = useMemo(
    () => state.drivers.concat(state.retiredDrivers),
    [state.drivers, state.retiredDrivers]
  );
  const seasonComplete = state.currentRound > state.calendar.length || state.phase === 'preseason';

  return (
    <>
      <table className="data-table calendar-table">
        <thead>
          <tr>
            <th className="col-round">Rd</th>
            <th>Circuit</th>
            <th className="col-country">Country</th>
            <th>Profile</th>
            <th>Weather</th>
            <th>Pole</th>
            <th>Winner</th>
            <th>Fastest lap</th>
          </tr>
        </thead>
        <tbody>
          {state.calendar.map((gp) => {
            const completed = state.completedRaces[gp.round];
            const isCurrent = gp.round === state.currentRound && !seasonComplete;
            const isPast = gp.round < state.currentRound || (gp.round === state.currentRound && completed);
            const poleId = completed?.qualifying.poleDriverId;
            const winnerId = completed?.race.finalRanking[0];
            const flId = completed?.race.fastestLapDriverId;
            const rowClass = isCurrent ? 'row-current' : (isPast ? 'row-past' : 'row-future');

            return (
              <tr key={gp.circuit.id} className={rowClass}>
                <td className="col-round">
                  <span className="round-badge">{gp.round}</span>
                </td>
                <td className="cell-circuit">
                  <span className="circuit-name">{gp.circuit.name}</span>
                  {isCurrent && <span className="next-pill">Next</span>}
                </td>
                <td className="col-country">{gp.circuit.country}</td>
                <td><ProfileChip profile={gp.circuit.profile} /></td>
                <td><WeatherChip weather={gp.weather} /></td>
                <td>
                  {poleId
                    ? <DriverLink id={poleId} onClick={setPopupDriver} drivers={allDrivers} />
                    : <span className="muted">—</span>}
                </td>
                <td>
                  {winnerId
                    ? <DriverLink id={winnerId} onClick={setPopupDriver} drivers={allDrivers} />
                    : <span className="muted">—</span>}
                </td>
                <td>
                  {flId
                    ? <DriverLink id={flId} onClick={setPopupDriver} drivers={allDrivers} />
                    : <span className="muted">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
    </>
  );
}

// Lowercase, color-tinted pills for circuit profile and weather. Kept small
// so they don't overpower the rest of the row.
function ProfileChip({ profile }: { profile: string }) {
  return <span className={`mini-chip profile-${profile}`}>{profile}</span>;
}
function WeatherChip({ weather }: { weather: string }) {
  const icon = weather === 'rain' ? '🌧' : weather === 'hot' ? '🔥' : '☀';
  return <span className={`mini-chip weather-${weather}`}>{icon} {weather}</span>;
}

// ============================================================================
// STANDINGS SUB-TAB — side-by-side drivers + constructors with numbered
// position badges and gold/silver/bronze tinting for the top 3.
// ============================================================================
function StandingsView() {
  const { state } = useGame();
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);
  const [popupTeam, setPopupTeam] = useState<Team | null>(null);

  return (
    <>
      <div className="standings-side-by-side">
        <div>
          <h3>Driver Standings</h3>
          <table className="data-table standings-table">
            <thead>
              <tr><th>Pos</th><th>Driver</th><th>Team</th><th className="num">Pts</th><th className="num">W</th></tr>
            </thead>
            <tbody>
              {state.driverStandings.map((s, i) => {
                const d = driverMap.get(s.driverId);
                const t = teamByDriver.get(s.driverId);
                if (!d) return null;
                return (
                  <tr key={s.driverId}>
                    <td><PositionBadge pos={i + 1} color={t?.color} /></td>
                    <td className="cell-driver">
                      <Flag code={d.countryCode} title={d.country} />{' '}
                      <button className="link-btn" onClick={() => setPopupDriver(d)}>{d.name}</button>
                    </td>
                    <td><span className="team-tag" style={{ color: t?.color }}>{t?.shortName ?? '—'}</span></td>
                    <td className="num"><strong>{s.points}</strong></td>
                    <td className="num">{d.seasonWins}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Constructor Standings</h3>
          <table className="data-table standings-table">
            <thead>
              <tr><th>Pos</th><th>Team</th><th className="num">Pts</th><th className="num">W</th></tr>
            </thead>
            <tbody>
              {state.teamStandings.map((s, i) => {
                const t = teamMap.get(s.teamId);
                if (!t) return null;
                return (
                  <tr key={s.teamId}>
                    <td><PositionBadge pos={i + 1} color={t.color} /></td>
                    <td>
                      <button className="link-btn" style={{ color: t.color, fontWeight: 600 }} onClick={() => setPopupTeam(t)}>
                        {t.name}
                      </button>
                    </td>
                    <td className="num"><strong>{s.points}</strong></td>
                    <td className="num">{t.seasonWins}</td>
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

// Numbered position pill. Top 3 get a special gold/silver/bronze fill that
// overrides the team-color tint. Beyond P3 we use a flat team-color circle.
function PositionBadge({ pos, color }: { pos: number; color?: string }) {
  let cls = 'pos-badge';
  if (pos === 1) cls += ' pos-1';
  else if (pos === 2) cls += ' pos-2';
  else if (pos === 3) cls += ' pos-3';
  const style: React.CSSProperties = pos > 3 && color
    ? { background: color, color: 'white' }
    : {};
  return <span className={cls} style={style}>{pos}</span>;
}

// ============================================================================
// PRE-SEASON SUB-TAB — keeps its existing 3-section structure (Summary,
// Market, Cars). Champion sound plays on the Summary section first mount.
// ============================================================================
function PreseasonView({ data }: { data: PreseasonData }) {
  const [section, setSection] = useState<'summary' | 'market' | 'cars'>('summary');

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

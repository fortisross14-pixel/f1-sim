import { useMemo, useState } from 'react';
import { GrandPrix } from '../../sim/types';
import { useGame } from '../../GameContext';
import { allDriversMap, teamByDriverMap } from '../common/helpers';
import { Flag } from '../common/Flag';
import { CircuitDetailPopup } from '../popups/CircuitDetailPopup';

// Pre-race info screen shown when a race weekend opens.
//
// Layout: hero panel → primary 4-card row (Track, Weather, Driver leader,
// Constructor leader) → "Last time here" row showing the most recent race
// at this circuit (winner + pole). Clicking the circuit name in the hero
// opens the all-time circuit detail popup.
export function PreRacePane({ gp, onRunQ }: { gp: GrandPrix; onRunQ: () => void }) {
  const { state } = useGame();
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  const [showCircuitPopup, setShowCircuitPopup] = useState(false);

  // Championship leaders (might be undefined if no rounds completed yet)
  const leaderDriverId = state.driverStandings[0]?.driverId;
  const leaderDriver = leaderDriverId ? driverMap.get(leaderDriverId) : undefined;
  const leaderDriverTeam = leaderDriverId ? teamByDriver.get(leaderDriverId) : undefined;
  const leaderDriverPoints = state.driverStandings[0]?.points ?? 0;

  const leaderTeamId = state.teamStandings[0]?.teamId;
  const leaderTeam = leaderTeamId ? teamMap.get(leaderTeamId) : undefined;
  const leaderTeamPoints = state.teamStandings[0]?.points ?? 0;

  const noResultsYet = state.currentRound === 1;

  // Past results at this circuit. The most recent one is "last year here".
  // Empty in year 1 since the circuit's first running is happening now.
  const allTimeAtCircuit = state.circuitHistory[gp.circuit.name] ?? [];
  const lastTimeHere = allTimeAtCircuit[allTimeAtCircuit.length - 1];

  return (
    <div className="prerace-screen">
      {/* Hero panel: round label + big circuit name (clickable) + country */}
      <div className="prerace-hero">
        <div className="prerace-hero-label">Round {gp.round} / {state.calendar.length}</div>
        <button
          className="prerace-hero-title prerace-hero-title-clickable"
          onClick={() => setShowCircuitPopup(true)}
          title="View circuit history"
        >
          {gp.circuit.name}
        </button>
        <div className="prerace-hero-country">{gp.circuit.country}</div>
      </div>

      {/* Primary 4-card row: track, weather, driver leader, constructor leader */}
      <div className="prerace-cards">
        <div className="prerace-card">
          <div className="prerace-card-label">Track</div>
          <div className="prerace-card-value prerace-card-value-strong">
            {gp.circuit.profile}
          </div>
          <div className="prerace-card-meta">{gp.circuit.laps} laps</div>
        </div>

        <div className="prerace-card">
          <div className="prerace-card-label">Weather</div>
          <div className="prerace-card-value prerace-card-value-strong">
            <WeatherIcon weather={gp.weather} /> {gp.weather}
          </div>
          <div className="prerace-card-meta">
            {gp.weather === 'hot' && 'High physical demands'}
            {gp.weather === 'rain' && 'Driving skill at a premium'}
            {gp.weather === 'normal' && 'Standard conditions'}
          </div>
        </div>

        <div className="prerace-card prerace-card-leader">
          <div className="prerace-card-label">Driver Championship</div>
          {noResultsYet ? (
            <div className="prerace-card-empty">Season opener</div>
          ) : leaderDriver ? (
            <>
              <div className="prerace-card-value">
                <Flag code={leaderDriver.countryCode} title={leaderDriver.country} />{' '}
                {leaderDriver.name}
              </div>
              <div className="prerace-card-meta">
                {leaderDriverTeam && (
                  <span style={{ color: leaderDriverTeam.color, fontWeight: 600 }}>
                    {leaderDriverTeam.shortName}
                  </span>
                )}
                {' · '}
                <strong>{leaderDriverPoints}</strong> pts
              </div>
            </>
          ) : (
            <div className="prerace-card-empty">—</div>
          )}
        </div>

        <div className="prerace-card prerace-card-leader">
          <div className="prerace-card-label">Constructor Championship</div>
          {noResultsYet ? (
            <div className="prerace-card-empty">Season opener</div>
          ) : leaderTeam ? (
            <>
              <div
                className="prerace-card-value"
                style={{ color: leaderTeam.color }}
              >
                {leaderTeam.name}
              </div>
              <div className="prerace-card-meta">
                <strong>{leaderTeamPoints}</strong> pts
              </div>
            </>
          ) : (
            <div className="prerace-card-empty">—</div>
          )}
        </div>
      </div>

      {/* Secondary "last time here" row — only when we have history */}
      {lastTimeHere && (
        <div className="prerace-history-row">
          <div className="prerace-history-row-label">
            Last time here · {lastTimeHere.year}
          </div>
          <div className="prerace-cards prerace-cards-history">
            <div className="prerace-card prerace-card-history">
              <div className="prerace-card-label">🏆 Winner</div>
              <div className="prerace-card-value">{lastTimeHere.winnerDriverName}</div>
              <div className="prerace-card-meta">
                <span style={{ color: lastTimeHere.winnerTeamColor, fontWeight: 600 }}>
                  {lastTimeHere.winnerTeamName}
                </span>
              </div>
            </div>
            <div className="prerace-card prerace-card-history">
              <div className="prerace-card-label">⏱ Pole</div>
              <div className="prerace-card-value">{lastTimeHere.poleDriverName}</div>
              <div className="prerace-card-meta">
                <WeatherIcon weather={lastTimeHere.weather} /> {lastTimeHere.weather}
              </div>
            </div>
            {allTimeAtCircuit.length > 1 && (
              <div className="prerace-card prerace-card-history prerace-card-history-link">
                <div className="prerace-card-label">All-time</div>
                <div className="prerace-card-value">{allTimeAtCircuit.length} races</div>
                <button className="prerace-history-link" onClick={() => setShowCircuitPopup(true)}>
                  View history →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="prerace-cta">
        <button className="primary big" onClick={onRunQ}>Run Qualifying →</button>
      </div>

      {showCircuitPopup && (
        <CircuitDetailPopup
          circuit={gp.circuit}
          history={allTimeAtCircuit}
          onClose={() => setShowCircuitPopup(false)}
        />
      )}
    </div>
  );
}

function WeatherIcon({ weather }: { weather: string }) {
  if (weather === 'rain') return <span>🌧</span>;
  if (weather === 'hot') return <span>🔥</span>;
  return <span>☀</span>;
}

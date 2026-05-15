import { useMemo } from 'react';
import { GrandPrix } from '../../sim/types';
import { useGame } from '../../GameContext';
import { allDriversMap, teamByDriverMap } from '../common/helpers';
import { Flag } from '../common/Flag';

// Pre-race info screen shown when a race weekend opens.
// Layout: hero panel (round + circuit + country) followed by a 4-card grid:
// Track, Weather, Driver leader, Constructor leader. Big red CTA at the bottom.
export function PreRacePane({ gp, onRunQ }: { gp: GrandPrix; onRunQ: () => void }) {
  const { state } = useGame();
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);

  // Championship leaders (might be undefined if no rounds completed yet)
  const leaderDriverId = state.driverStandings[0]?.driverId;
  const leaderDriver = leaderDriverId ? driverMap.get(leaderDriverId) : undefined;
  const leaderDriverTeam = leaderDriverId ? teamByDriver.get(leaderDriverId) : undefined;
  const leaderDriverPoints = state.driverStandings[0]?.points ?? 0;

  const leaderTeamId = state.teamStandings[0]?.teamId;
  const leaderTeam = leaderTeamId ? teamMap.get(leaderTeamId) : undefined;
  const leaderTeamPoints = state.teamStandings[0]?.points ?? 0;

  const noResultsYet = state.currentRound === 1;

  return (
    <div className="prerace-screen">
      {/* Hero panel: round label + big circuit name + country */}
      <div className="prerace-hero">
        <div className="prerace-hero-label">Round {gp.round} / {state.calendar.length}</div>
        <div className="prerace-hero-title">{gp.circuit.name}</div>
        <div className="prerace-hero-country">{gp.circuit.country}</div>
      </div>

      {/* 4-card info grid */}
      <div className="prerace-cards">
        {/* Track card */}
        <div className="prerace-card">
          <div className="prerace-card-label">Track</div>
          <div className="prerace-card-value prerace-card-value-strong">
            {gp.circuit.profile}
          </div>
          <div className="prerace-card-meta">{gp.circuit.laps} laps</div>
        </div>

        {/* Weather card */}
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

        {/* Driver leader card */}
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

        {/* Constructor leader card */}
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

      <div className="prerace-cta">
        <button className="primary big" onClick={onRunQ}>Run Qualifying →</button>
      </div>
    </div>
  );
}

function WeatherIcon({ weather }: { weather: string }) {
  if (weather === 'rain') return <span>🌧</span>;
  if (weather === 'hot') return <span>🔥</span>;
  return <span>☀</span>;
}

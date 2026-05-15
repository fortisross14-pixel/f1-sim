import { useMemo } from 'react';
import { Driver } from '../../sim/types';
import { useGame } from '../../GameContext';
import { effectiveDriverSkills, driverOverall } from '../../sim/generators';
import { PopupShell } from './PopupShell';
import { Flag } from '../common/Flag';
import { RarityChip } from '../common/RarityChip';

// Driver detail popup: country/flag, rarity, archetype, OVR, current skills,
// career totals, and a year-by-year results table.
export function DriverDetailPopup({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const { state } = useGame();
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  const sk = effectiveDriverSkills(driver);
  const ovr = driverOverall(driver);
  const totalPoints = driver.yearHistory.reduce((a, b) => a + b.points, 0);

  return (
    <PopupShell
      title={<><Flag code={driver.countryCode} title={driver.country} /> {driver.name}</>}
      onClose={onClose}
    >
      <div className="popup-meta">
        <div>
          <RarityChip rarity={driver.rarity} /> · {driver.archetype} · <strong>OVR {ovr}</strong>
        </div>
        <div>
          {driver.country} · Age {driver.age} · Years active: {driver.yearHistory.length || (driver.age - driver.careerStartAge + 1)}
        </div>
        {driver.retired && <div className="muted">⏹️ Retired</div>}
        {driver.retirementAnnounced && !driver.retired && (
          <div className="retiring">⏳ Final season announced</div>
        )}
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
      {driver.yearHistory.length === 0 ? (
        <p className="muted">No completed seasons yet.</p>
      ) : (
        <table className="data-table compact history-table">
          <thead>
            <tr>
              <th>Year</th><th>Team</th><th>Races</th><th>Wins</th>
              <th>Podiums</th><th>Poles</th><th>Points</th><th>Title</th>
            </tr>
          </thead>
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

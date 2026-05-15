import { Team, TeamYearRecord } from '../../sim/types';
import { PopupShell } from './PopupShell';

// Team detail popup: car stats, career totals, year-by-year standings.
export function TeamDetailPopup({ team, onClose }: { team: Team; onClose: () => void }) {
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
      {team.yearHistory.length === 0 ? (
        <p className="muted">No completed seasons yet.</p>
      ) : (
        <table className="data-table compact history-table">
          <thead>
            <tr>
              <th>Year</th><th>Pos</th><th>Points</th><th>Wins</th>
              <th>Podiums</th><th>Poles</th><th>Car Avg</th><th>Titles</th>
            </tr>
          </thead>
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

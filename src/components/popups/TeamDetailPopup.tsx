import { Team, TeamYearRecord } from '../../sim/types';
import { PopupShell } from './PopupShell';
import { TeamLogo } from '../common/TeamLogo';
import { SpecialtyChip } from '../common/SpecialtyChip';

// Team detail popup.
//
// Hero: team logo + name + tier subtitle, accented with the team color
// at the bottom border. Body: car stats as 4 big tiles (matches the team
// card style), career totals grid, year-by-year results table.
export function TeamDetailPopup({ team, onClose }: { team: Team; onClose: () => void }) {
  return (
    <PopupShell
      onClose={onClose}
      accentColor={team.color}
      hero={
        <div className="popup-team-hero">
          <TeamLogo team={team} size={64} />
          <div className="popup-team-identity">
            <div className="popup-team-meta-top">
              <span className="popup-team-shortname">{team.shortName}</span>
              <span className="popup-team-tier">{team.tier} tier</span>
            </div>
            <h2 className="popup-team-name" style={{ color: team.color }}>{team.name}</h2>
            <div className="popup-team-meta-bottom">
              Legacy base {team.legacyBaseValue} · Cap {team.marketPoints}
            </div>
          </div>
        </div>
      }
    >
      <h3>
        Current car
        <SpecialtyChip specialty={team.car.circuitSpecialty} />
      </h3>
      <div className="car-stat-grid">
        <CarStatTile label="Max Speed"    value={team.car.maxSpeed} />
        <CarStatTile label="Acceleration" value={team.car.acceleration} />
        <CarStatTile label="Turning"      value={team.car.turning} />
        <CarStatTile label="Reliability"  value={team.car.reliability} />
      </div>

      <h3>Career totals</h3>
      <div className="stat-grid">
        <Stat label="Constructor WC" value={team.careerConstructorWC} accent="gold" />
        <Stat label="Driver WC"      value={team.careerDriverWC} accent="gold" />
        <Stat label="Race wins"      value={team.careerWins} />
        <Stat label="Podiums"        value={team.careerPodiums} />
        <Stat label="Pole positions" value={team.careerPoles} />
        <Stat label="Seasons"        value={team.yearHistory.length} />
      </div>

      <h3>Year by year</h3>
      {team.yearHistory.length === 0 ? (
        <p className="muted">No completed seasons yet.</p>
      ) : (
        <table className="data-table compact history-table">
          <thead>
            <tr>
              <th>Year</th>
              <th className="num">Pos</th>
              <th className="num">Pts</th>
              <th className="num">W</th>
              <th className="num">Pod</th>
              <th className="num">Pol</th>
              <th className="num">Car</th>
              <th>Titles</th>
            </tr>
          </thead>
          <tbody>
            {team.yearHistory.map((y: TeamYearRecord, i) => (
              <tr key={i} className={(y.driverWC || y.constructorWC) ? 'history-row-champ' : ''}>
                <td><strong>{y.year}</strong></td>
                <td className="num">{y.finalPosition}</td>
                <td className="num"><strong>{y.points}</strong></td>
                <td className="num">{y.wins}</td>
                <td className="num">{y.podiums}</td>
                <td className="num">{y.poles}</td>
                <td className="num">{y.carAvg.toFixed(1)}</td>
                <td>
                  {y.driverWC && <span className="trophy" title="Driver title">🏆</span>}
                  {y.constructorWC && <span className="trophy" title="Constructor title">🏭</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PopupShell>
  );
}

function CarStatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="car-stat car-stat-large">
      <div className="car-stat-label">{label}</div>
      <div className="car-stat-value">{value}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: 'gold' }) {
  return (
    <div className={`stat-tile${accent ? ` stat-tile-${accent}` : ''}`}>
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

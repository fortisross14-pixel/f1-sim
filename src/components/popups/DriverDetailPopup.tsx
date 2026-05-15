import { useMemo } from 'react';
import { Driver } from '../../sim/types';
import { useGame } from '../../GameContext';
import { effectiveDriverSkills, driverOverall } from '../../sim/generators';
import { PopupShell } from './PopupShell';
import { Flag } from '../common/Flag';
import { RarityChip } from '../common/RarityChip';
import { teamByDriverMap } from '../common/helpers';

// Driver detail popup.
//
// Hero band shows flag + name + rarity chip + archetype + OVR + current team.
// Below: skill bars (4 colored progress bars), career totals as a stat grid,
// then a tight year-by-year results table. Hero band's bottom border uses
// the driver's current team color so the player visually associates them.
export function DriverDetailPopup({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const { state } = useGame();
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const currentTeam = teamByDriver.get(driver.id);
  const sk = effectiveDriverSkills(driver);
  const ovr = driverOverall(driver);
  const totalPoints = driver.yearHistory.reduce((a, b) => a + b.points, 0);
  const yearsActive = driver.yearHistory.length || (driver.age - driver.careerStartAge + 1);

  return (
    <PopupShell
      onClose={onClose}
      accentColor={currentTeam?.color}
      hero={
        <div className="popup-driver-hero">
          <div className="popup-driver-flag">
            <Flag code={driver.countryCode} title={driver.country} />
          </div>
          <div className="popup-driver-identity">
            <div className="popup-driver-meta-top">
              <RarityChip rarity={driver.rarity} />
              <span className="popup-driver-archetype">{driver.archetype}</span>
              {driver.retired && <span className="popup-status-pill popup-status-retired">Retired</span>}
              {driver.retirementAnnounced && !driver.retired && (
                <span className="popup-status-pill popup-status-retiring">Final season</span>
              )}
            </div>
            <h2 className="popup-driver-name">{driver.name}</h2>
            <div className="popup-driver-meta-bottom">
              <span>{driver.country}</span>
              <span>·</span>
              <span>Age {driver.age}</span>
              <span>·</span>
              <span>{yearsActive} year{yearsActive === 1 ? '' : 's'} active</span>
              {currentTeam && (
                <>
                  <span>·</span>
                  <span style={{ color: currentTeam.color, fontWeight: 700 }}>{currentTeam.name}</span>
                </>
              )}
            </div>
          </div>
          <div className="popup-driver-ovr">
            <div className="popup-driver-ovr-label">Overall</div>
            <div className="popup-driver-ovr-value">{ovr}</div>
          </div>
        </div>
      }
    >
      <h3>Current skills</h3>
      <div className="skill-bars">
        <SkillBar label="Driving"   value={sk.driving} />
        <SkillBar label="Physical"  value={sk.physical} />
        <SkillBar label="Car Setup" value={sk.carSetup} />
        <SkillBar label="Speed"     value={sk.speed} />
      </div>

      <h3>Career totals</h3>
      <div className="stat-grid">
        <Stat label="WC titles"      value={driver.careerChampionships} accent="gold" />
        <Stat label="Race wins"      value={driver.careerWins} />
        <Stat label="Podiums"        value={driver.careerPodiums} />
        <Stat label="Pole positions" value={driver.careerPoles} />
        <Stat label="Race starts"    value={driver.careerStarts} />
        <Stat label="Total points"   value={totalPoints} />
      </div>

      <h3>Year by year</h3>
      {driver.yearHistory.length === 0 ? (
        <p className="muted">No completed seasons yet.</p>
      ) : (
        <table className="data-table compact history-table">
          <thead>
            <tr>
              <th>Year</th><th>Team</th>
              <th className="num">Races</th>
              <th className="num">Wins</th>
              <th className="num">Pod</th>
              <th className="num">Pol</th>
              <th className="num">Pts</th>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            {driver.yearHistory.map((y, i) => (
              <tr key={i} className={y.isWorldChampion ? 'history-row-champ' : ''}>
                <td><strong>{y.year}</strong></td>
                <td style={{ color: teamMap.get(y.teamId ?? '')?.color, fontWeight: 600 }}>
                  {y.teamName}
                </td>
                <td className="num">{y.races}</td>
                <td className="num">{y.wins}</td>
                <td className="num">{y.podiums}</td>
                <td className="num">{y.poles}</td>
                <td className="num"><strong>{y.points}</strong></td>
                <td>{y.isWorldChampion && <span className="trophy">🏆</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PopupShell>
  );
}

// One horizontal skill bar with label, value, and a colored fill.
// Same visual language as the OVR bar in the Pilots table.
function SkillBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(8, Math.min(100, ((value - 40) / 55) * 100));
  return (
    <div className="skill-bar">
      <div className="skill-bar-label">{label}</div>
      <div className="skill-bar-row">
        <span className="skill-bar-number">{value}</span>
        <div className="skill-bar-track">
          <div className="skill-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// One stat tile in the career-totals grid.
function Stat({ label, value, accent }: { label: string; value: number; accent?: 'gold' }) {
  return (
    <div className={`stat-tile${accent ? ` stat-tile-${accent}` : ''}`}>
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

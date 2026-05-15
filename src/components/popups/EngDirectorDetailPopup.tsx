import { useMemo } from 'react';
import { EngineeringDirector, Rarity } from '../../sim/types';
import { useGame } from '../../GameContext';
import { PopupShell } from './PopupShell';
import { Flag } from '../common/Flag';
import { RarityChip } from '../common/RarityChip';

// Engineering Director detail popup.
//
// Hero accent color is keyed to rarity so legendary directors get gold,
// epics purple, etc. — visually consistent with the rarity chips elsewhere.
// Body: target stats as 4 readable tiles, pull factor, career-at-teams table.
export function EngDirectorDetailPopup({ director, onClose }: {
  director: EngineeringDirector;
  onClose: () => void;
}) {
  const { state } = useGame();
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);

  const totalTeamWins = director.yearHistory.reduce((a, b) => a + b.teamRaceWins, 0);
  const totalDriverWC = director.yearHistory.filter(y => y.driverWC).length;
  const totalConstructorWC = director.yearHistory.filter(y => y.constructorWC).length;

  return (
    <PopupShell
      onClose={onClose}
      accentColor={rarityAccent(director.rarity)}
      hero={
        <div className="popup-director-hero">
          {director.countryCode && (
            <div className="popup-driver-flag">
              <Flag code={director.countryCode} title={director.country} />
            </div>
          )}
          <div className="popup-director-identity">
            <div className="popup-driver-meta-top">
              <RarityChip rarity={director.rarity} />
              <span className="popup-driver-archetype">Engineering Director</span>
              {director.retired && <span className="popup-status-pill popup-status-retired">Retired</span>}
            </div>
            <h2 className="popup-driver-name">{director.name}</h2>
            <div className="popup-driver-meta-bottom">
              {director.country && <><span>{director.country}</span><span>·</span></>}
              <span>Age {director.age}</span>
              <span>·</span>
              <span>{Math.max(0, director.yearsRemaining)} year{director.yearsRemaining === 1 ? '' : 's'} remaining</span>
            </div>
          </div>
        </div>
      }
    >
      <h3>Targets</h3>
      <div className="car-stat-grid">
        <CarStatTile label="Speed target"   value={director.speedTarget} />
        <CarStatTile label="Accel target"   value={director.accelTarget} />
        <CarStatTile label="Turning target" value={director.turningTarget} />
        <CarStatTile label="Reliab target"  value={director.reliabilityTarget} />
      </div>
      <div className="director-pull-row">
        <span className="director-pull-label">Pull factor</span>
        <span className="director-pull-value">{Math.round(director.pullFactor * 100)}%</span>
        <span className="muted">— how much of the gap to each target is closed per season</span>
      </div>

      <h3>Career totals</h3>
      <div className="stat-grid">
        <Stat label="Constructor WC" value={totalConstructorWC} accent="gold" />
        <Stat label="Driver WC"      value={totalDriverWC} accent="gold" />
        <Stat label="Team wins"      value={totalTeamWins} />
        <Stat label="Seasons"        value={director.yearHistory.length} />
      </div>

      <h3>Career at teams</h3>
      {director.yearHistory.length === 0 ? (
        <p className="muted">No completed seasons yet.</p>
      ) : (
        <table className="data-table compact history-table">
          <thead>
            <tr>
              <th>Year</th><th>Team</th>
              <th className="num">Wins</th>
              <th className="num">Pod</th>
              <th className="num">Pol</th>
              <th>Titles</th>
            </tr>
          </thead>
          <tbody>
            {director.yearHistory.map((y, i) => (
              <tr key={i} className={(y.driverWC || y.constructorWC) ? 'history-row-champ' : ''}>
                <td><strong>{y.year}</strong></td>
                <td style={{ color: teamMap.get(y.teamId ?? '')?.color, fontWeight: 600 }}>{y.teamName}</td>
                <td className="num">{y.teamRaceWins}</td>
                <td className="num">{y.teamPodiums}</td>
                <td className="num">{y.teamPoles}</td>
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

// Hero accent color by rarity — keeps the visual language tied to the chip.
function rarityAccent(r: Rarity): string {
  switch (r) {
    case 'legend':   return '#F59E0B';
    case 'epic':     return '#9333EA';
    case 'rare':     return '#2563EB';
    case 'uncommon': return '#16A34A';
    case 'common':   return '#9CA3AF';
  }
}

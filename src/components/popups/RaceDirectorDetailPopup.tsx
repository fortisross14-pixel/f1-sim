import { useMemo } from 'react';
import { RaceDirector } from '../../sim/types';
import { useGame } from '../../GameContext';
import { PopupShell } from './PopupShell';
import { RarityChip } from '../common/RarityChip';

// Race Director detail popup: time improvement %, reliability bonus, career at teams.
export function RaceDirectorDetailPopup({ director, onClose }: {
  director: RaceDirector;
  onClose: () => void;
}) {
  const { state } = useGame();
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);

  return (
    <PopupShell title={director.name} onClose={onClose}>
      <div className="popup-meta">
        <div><RarityChip rarity={director.rarity} /> · Race Director</div>
        <div>Age {director.age} · Years remaining: {Math.max(0, director.yearsRemaining)}</div>
        {director.retired && <div className="muted">⏹️ Retired</div>}
      </div>

      <h3>Skills</h3>
      <div className="skills-row">
        <span>Time improvement <strong>{director.timeImprovementPct}%</strong></span>
        <span>Reliability bonus <strong>+{director.reliabilityBonus}</strong></span>
      </div>

      <h3>Career at teams</h3>
      {director.yearHistory.length === 0 ? (
        <p className="muted">No completed seasons yet.</p>
      ) : (
        <table className="data-table compact history-table">
          <thead>
            <tr>
              <th>Year</th><th>Team</th><th>Team Wins</th>
              <th>Podiums</th><th>Poles</th><th>Titles</th>
            </tr>
          </thead>
          <tbody>
            {director.yearHistory.map((y, i) => (
              <tr key={i}>
                <td>{y.year}</td>
                <td style={{ color: teamMap.get(y.teamId ?? '')?.color }}>{y.teamName}</td>
                <td>{y.teamRaceWins}</td>
                <td>{y.teamPodiums}</td>
                <td>{y.teamPoles}</td>
                <td>{y.driverWC && '🏆D'}{y.constructorWC && ' 🏭C'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PopupShell>
  );
}

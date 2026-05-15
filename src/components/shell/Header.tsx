import { useGame } from '../../GameContext';
import { GearMenu } from './GearMenu';

// Shared header bar used by both the in-game menu and the race weekend overlay.
// The `extraInfo` slot lets the race overlay insert a "Back to menu" button.
export function Header({ extraInfo }: { extraInfo?: React.ReactNode }) {
  const { state, universeName } = useGame();
  return (
    <header className="header">
      <h1><span>F1 Sim</span> <span className="universe-label">— {universeName}</span></h1>
      <div className="header-info">
        <span>Year {state.year}</span>
        <span>Round {state.currentRound} / {state.calendar.length}</span>
        {extraInfo}
        <GearMenu />
      </div>
    </header>
  );
}

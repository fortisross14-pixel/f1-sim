import { useGame } from '../../GameContext';
import { Header } from '../shell/Header';
import { PreRacePane } from './PreRacePane';
import { QualifyingPane } from './QualifyingPane';
import { RaceResultsPane } from './RaceResultsPane';

// Full-screen race weekend flow. Replaces the menu while a race is in progress.
// Includes the standard header (with gear menu) plus a "Back to menu" cancel button.
export function RaceWeekendOverlay() {
  const { state, returnToMenu, runQualifying, startRace, finishCurrentRace } = useGame();
  const gp = state.calendar[state.currentRound - 1];

  return (
    <div className="app">
      <Header
        extraInfo={<button onClick={returnToMenu} className="cancel-btn">← Back to menu</button>}
      />
      <main>
        <div className="screen">
          {state.phase === 'pre_race' && <PreRacePane gp={gp} onRunQ={runQualifying} />}
          {(state.phase === 'qualifying_q1' || state.phase === 'qualifying_q2') && state.lastQualiResult && (
            <QualifyingPane onStartRace={startRace} />
          )}
          {state.phase === 'race_results' && state.lastRaceResult && (
            <RaceResultsPane onFinish={finishCurrentRace} />
          )}
        </div>
      </main>
    </div>
  );
}

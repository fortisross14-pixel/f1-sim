import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  SeasonState, QualifyingResult, RaceResult, PreseasonData,
} from './sim/types';
import {
  createNewSeason, applyRaceResult, applyQualiResult,
  decrementInjuries, advanceToNewSeason,
} from './sim/season';
import { simulateQualifying, simulateRace } from './sim/race';
import { RNG } from './sim/rng';

interface GameContextValue {
  state: SeasonState;
  // race weekend flow — split into Q1, Q2, and Race so user clicks through each
  startRaceWeekend: () => void;        // enter pre_race phase from menu
  runQualifying: () => QualifyingResult; // runs full Q (Q1+Q2), splits ticks for UI to step through
  advanceToQ2: () => void;              // transition from showing Q1 to showing Q2 ticks
  startRace: () => RaceResult;
  finishCurrentRace: () => void;       // commits race result, advances round, returns to menu (or preseason if last race)
  // season flow
  advanceSeason: () => PreseasonData;   // end-of-year transition: archive, market, new cars
  startNewYear: () => void;             // commits the new year, returns to menu
  returnToMenu: () => void;             // exit a race weekend mid-flow (cancel)
  // utility
  resetGame: (seed?: number) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SeasonState>(() => createNewSeason());

  const startRaceWeekend = useCallback(() => {
    state.phase = 'pre_race';
    state.lastQualiResult = undefined;
    state.lastRaceResult = undefined;
    setState({ ...state });
  }, [state]);

  const runQualifying = useCallback((): QualifyingResult => {
    const rng = new RNG();
    const gp = state.calendar[state.currentRound - 1];
    decrementInjuries(state);
    const result = simulateQualifying(
      gp, state.teams, state.drivers, state.engineeringDirectors, state.raceDirectors, rng
    );
    applyQualiResult(state, result.poleDriverId);
    state.lastQualiResult = result;
    // The UI's tick reveal will step through Q1 ticks first, then user clicks "Run Q2",
    // then Q2 ticks reveal. We don't split simulation — both runs in one go — but the
    // UI gates the Q2 reveal behind a button. Internally the result has all 6 ticks.
    state.phase = 'qualifying_q1';
    setState({ ...state });
    return result;
  }, [state]);

  const startRace = useCallback((): RaceResult => {
    const rng = new RNG();
    const gp = state.calendar[state.currentRound - 1];
    if (!state.lastQualiResult) throw new Error('Run qualifying first');
    const result = simulateRace(
      gp, state.lastQualiResult, state.teams, state.drivers,
      state.engineeringDirectors, state.raceDirectors, rng
    );
    state.lastRaceResult = result;
    state.phase = 'race_results';
    setState({ ...state });
    return result;
  }, [state]);

  const advanceToQ2 = useCallback(() => {
    state.phase = 'qualifying_q2';
    setState({ ...state });
  }, [state]);

  const finishCurrentRace = useCallback(() => {
    if (!state.lastRaceResult || !state.lastQualiResult) return;
    applyRaceResult(state, state.lastRaceResult);
    state.completedRaces[state.currentRound] = {
      qualifying: state.lastQualiResult,
      race: state.lastRaceResult,
    };
    if (state.currentRound < state.calendar.length) {
      state.currentRound++;
      state.phase = 'menu';
      state.lastQualiResult = undefined;
      state.lastRaceResult = undefined;
      setState({ ...state });
    } else {
      // Last race of season — auto-trigger season advance
      const rng = new RNG();
      advanceToNewSeason(state, rng);
      setState({ ...state });
    }
  }, [state]);

  const advanceSeason = useCallback((): PreseasonData => {
    const rng = new RNG();
    const result = advanceToNewSeason(state, rng);
    setState({ ...state });
    return result;
  }, [state]);

  const startNewYear = useCallback(() => {
    state.phase = 'menu';
    setState({ ...state });
  }, [state]);

  const returnToMenu = useCallback(() => {
    state.phase = 'menu';
    state.lastQualiResult = undefined;
    state.lastRaceResult = undefined;
    setState({ ...state });
  }, [state]);

  const resetGame = useCallback((seed?: number) => {
    setState(createNewSeason(seed));
  }, []);

  return (
    <GameContext.Provider value={{
      state, startRaceWeekend, runQualifying, advanceToQ2, startRace, finishCurrentRace,
      advanceSeason, startNewYear, returnToMenu, resetGame,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}

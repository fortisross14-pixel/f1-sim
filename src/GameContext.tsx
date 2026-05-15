import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  SeasonState, QualifyingResult, RaceResult, PreseasonData,
} from './sim/types';
import {
  createNewSeason, applyRaceResult, applyQualiResult,
  decrementInjuries, advanceToNewSeason, recordCircuitHistory,
} from './sim/season';
import { simulateQualifying, simulateRace } from './sim/race';
import { RNG } from './sim/rng';
import { saveUniverse } from './save';

interface GameContextValue {
  state: SeasonState;
  universeId: string;
  universeName: string;
  // race weekend flow
  startRaceWeekend: () => void;
  runQualifying: () => QualifyingResult;
  advanceToQ2: () => void;
  startRace: () => RaceResult;
  finishCurrentRace: () => void;
  // season flow
  advanceSeason: () => PreseasonData;
  startNewYear: () => void;
  returnToMenu: () => void;
  // utility
  saveNow: () => void;          // manual save (gear menu)
  exitToHome: () => void;        // signals shell to return home
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  children, initialState, universeId, universeName, onExit,
}: {
  children: ReactNode;
  initialState: SeasonState;
  universeId: string;
  universeName: string;
  onExit: () => void;
}) {
  const [state, setState] = useState<SeasonState>(initialState);

  // Helper to commit state and autosave together.
  const commit = useCallback((newState: SeasonState, autosave: boolean) => {
    setState(newState);
    if (autosave) {
      try {
        saveUniverse(universeId, universeName, newState);
      } catch (err) {
        console.warn('Autosave failed', err);
      }
    }
  }, [universeId, universeName]);

  const startRaceWeekend = useCallback(() => {
    state.phase = 'pre_race';
    state.lastQualiResult = undefined;
    state.lastRaceResult = undefined;
    commit({ ...state }, false);
  }, [state, commit]);

  const runQualifying = useCallback((): QualifyingResult => {
    const rng = new RNG();
    const gp = state.calendar[state.currentRound - 1];
    decrementInjuries(state);
    const result = simulateQualifying(
      gp, state.teams, state.drivers, state.engineeringDirectors, state.raceDirectors, rng
    );
    applyQualiResult(state, result.poleDriverId);
    state.lastQualiResult = result;
    state.phase = 'qualifying_q1';
    commit({ ...state }, false);
    return result;
  }, [state, commit]);

  const advanceToQ2 = useCallback(() => {
    state.phase = 'qualifying_q2';
    commit({ ...state }, false);
  }, [state, commit]);

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
    commit({ ...state }, false);
    return result;
  }, [state, commit]);

  const finishCurrentRace = useCallback(() => {
    if (!state.lastRaceResult || !state.lastQualiResult) return;
    applyRaceResult(state, state.lastRaceResult);
    // Record this race into the permanent per-circuit history log
    const gp = state.calendar[state.currentRound - 1];
    recordCircuitHistory(
      state,
      gp.circuit.name,
      state.currentRound,
      gp.weather,
      state.lastQualiResult.poleDriverId,
      state.lastRaceResult
    );
    state.completedRaces[state.currentRound] = {
      qualifying: state.lastQualiResult,
      race: state.lastRaceResult,
    };
    if (state.currentRound < state.calendar.length) {
      state.currentRound++;
      state.phase = 'menu';
      state.lastQualiResult = undefined;
      state.lastRaceResult = undefined;
      commit({ ...state }, true); // AUTOSAVE on race finish
    } else {
      // Last race of season — auto-trigger season advance
      const rng = new RNG();
      advanceToNewSeason(state, rng);
      commit({ ...state }, true); // AUTOSAVE on season advance
    }
  }, [state, commit]);

  const advanceSeason = useCallback((): PreseasonData => {
    const rng = new RNG();
    const result = advanceToNewSeason(state, rng);
    commit({ ...state }, true); // AUTOSAVE
    return result;
  }, [state, commit]);

  const startNewYear = useCallback(() => {
    state.phase = 'menu';
    commit({ ...state }, true); // AUTOSAVE on year commit
  }, [state, commit]);

  const returnToMenu = useCallback(() => {
    state.phase = 'menu';
    state.lastQualiResult = undefined;
    state.lastRaceResult = undefined;
    commit({ ...state }, false);
  }, [state, commit]);

  const saveNow = useCallback(() => {
    try {
      saveUniverse(universeId, universeName, state);
    } catch (err) {
      console.warn('Manual save failed', err);
    }
  }, [state, universeId, universeName]);

  const exitToHome = useCallback(() => {
    // Save first, then signal exit
    try {
      saveUniverse(universeId, universeName, state);
    } catch (err) {
      console.warn('Exit save failed', err);
    }
    onExit();
  }, [state, universeId, universeName, onExit]);

  return (
    <GameContext.Provider value={{
      state, universeId, universeName,
      startRaceWeekend, runQualifying, advanceToQ2, startRace, finishCurrentRace,
      advanceSeason, startNewYear, returnToMenu,
      saveNow, exitToHome,
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

// Helper for the bootstrap layer to create a fresh universe state.
export { createNewSeason };

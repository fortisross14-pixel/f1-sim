import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  SeasonState, QualifyingResult, RaceResult,
} from './sim/types';
import {
  createNewSeason, applyRaceResult, applyQualiResult,
  decrementInjuries, advanceToNewSeason, buildSeasonSummary, SeasonSummary,
} from './sim/season';
import { simulateQualifying, simulateRace } from './sim/race';
import { RNG } from './sim/rng';
import { MarketMove } from './sim/market';
import { Team } from './sim/types';

interface GameContextValue {
  state: SeasonState;
  // race flow
  runQualifying: () => QualifyingResult;
  runRace: () => RaceResult;
  advanceToNextGP: () => void;
  // season flow
  finishSeason: () => SeasonSummary;
  startNewSeason: () => {
    retirementMoves: MarketMove[];
    marketMoves: MarketMove[];
    newCarChanges: Array<{ teamId: string; before: Team['car']; after: Team['car'] }>;
  };
  // utility
  resetGame: (seed?: number) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SeasonState>(() => createNewSeason());

  const runQualifying = useCallback((): QualifyingResult => {
    const rng = new RNG();
    const gp = state.calendar[state.currentRound - 1];
    decrementInjuries(state);
    const result = simulateQualifying(
      gp, state.teams, state.drivers, state.engineeringDirectors, state.raceDirectors, rng
    );
    applyQualiResult(state, result.poleDriverId);
    state.lastQualiResult = result;
    state.phase = 'qualifying_results';
    setState({ ...state });
    return result;
  }, [state]);

  const runRace = useCallback((): RaceResult => {
    const rng = new RNG();
    const gp = state.calendar[state.currentRound - 1];
    if (!state.lastQualiResult) {
      throw new Error('Run qualifying first');
    }
    const result = simulateRace(
      gp, state.lastQualiResult, state.teams, state.drivers,
      state.engineeringDirectors, state.raceDirectors, rng
    );
    applyRaceResult(state, result);
    state.lastRaceResult = result;
    state.phase = 'race_results';
    setState({ ...state });
    return result;
  }, [state]);

  const advanceToNextGP = useCallback(() => {
    if (state.currentRound < state.calendar.length) {
      state.currentRound++;
      state.phase = 'pre_race';
      state.lastQualiResult = undefined;
      state.lastRaceResult = undefined;
    } else {
      state.phase = 'season_summary';
    }
    setState({ ...state });
  }, [state]);

  const finishSeason = useCallback((): SeasonSummary => {
    state.phase = 'season_summary';
    setState({ ...state });
    return buildSeasonSummary(state);
  }, [state]);

  const startNewSeason = useCallback(() => {
    const rng = new RNG();
    const result = advanceToNewSeason(state, rng);
    state.phase = 'season_start';
    setState({ ...state });
    return result;
  }, [state]);

  const resetGame = useCallback((seed?: number) => {
    setState(createNewSeason(seed));
  }, []);

  return (
    <GameContext.Provider value={{
      state, runQualifying, runRace, advanceToNextGP,
      finishSeason, startNewSeason, resetGame,
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

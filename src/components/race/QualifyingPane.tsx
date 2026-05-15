import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../../GameContext';
import { useAudio } from '../../audio';
import { allDriversMap, teamByDriverMap } from '../common/helpers';

// Qualifying reveal with two-stage gating:
//  - phase='qualifying_q1' → reveal Q1 ticks (3 steps + final view), then "Run Q2"
//  - phase='qualifying_q2' → reveal Q2 ticks, then "Start Race"
// Internally the simulator already produced all 6 ticks; we just gate which are shown.
export function QualifyingPane({ onStartRace }: { onStartRace: () => void }) {
  const { state, advanceToQ2 } = useGame();
  const audio = useAudio();
  const q = state.lastQualiResult!;
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);

  const isQ1Phase = state.phase === 'qualifying_q1';
  const maxStep = 4; // 3 ticks + 1 "final" view
  const [step, setStep] = useState<number>(0);
  const [autoplay, setAutoplay] = useState<boolean>(true);

  // Reset on phase change (Q1 → Q2)
  useEffect(() => {
    setStep(0);
    setAutoplay(true);
  }, [isQ1Phase]);

  // Autoplay tick advance
  useEffect(() => {
    if (!autoplay || step >= maxStep - 1) return;
    const t = setTimeout(() => setStep(s => s + 1), 1200);
    return () => clearTimeout(t);
  }, [step, autoplay, maxStep]);

  // Audio: subtle tick on each reveal
  useEffect(() => {
    if (step > 0 && step < maxStep - 1) audio.play('tick');
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pole sound at Q2 final
  useEffect(() => {
    if (!isQ1Phase && step === maxStep - 1) audio.play('pole');
  }, [step, isQ1Phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const isQ1Done = isQ1Phase && step === maxStep - 1;
  const isQ2Done = !isQ1Phase && step === maxStep - 1;
  const showFinal = step === maxStep - 1;
  // Tick indices: Q1 uses 0..2, Q2 uses 3..5
  const tickIndex = (isQ1Phase ? 0 : 3) + step;
  const currentTick = !showFinal && tickIndex < q.ticks.length ? q.ticks[tickIndex] : null;

  let ranking: string[];
  let times: Record<string, number>;
  let stageLabel: string;

  if (isQ1Phase) {
    if (showFinal) {
      // Q1 final = last Q1 tick (index 2) — already has all 24 drivers
      const lastQ1Tick = q.ticks[2];
      ranking = lastQ1Tick.ranking;
      times = lastQ1Tick.times;
      stageLabel = 'Q1 — Final results';
    } else {
      ranking = currentTick!.ranking;
      times = currentTick!.times;
      stageLabel = `Q1 — Tick ${step + 1}/3`;
    }
  } else {
    if (showFinal) {
      ranking = q.ranking;
      times = q.times;
      stageLabel = 'Final qualifying results';
    } else {
      ranking = currentTick!.ranking;
      times = currentTick!.times;
      stageLabel = `Q2 — Tick ${step + 1}/3`;
    }
  }

  return (
    <>
      <h2>Qualifying — {stageLabel}</h2>
      {isQ2Done && q.poleDriverId && (
        <p>🏆 Pole position: <strong>{driverMap.get(q.poleDriverId)?.name}</strong></p>
      )}
      <div className="tick-controls">
        <button onClick={() => setStep(0)} disabled={step === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.min(maxStep - 1, step + 1)); }} disabled={step >= maxStep - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setStep(maxStep - 1); }} disabled={step === maxStep - 1}>⏭ Skip</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time</th><th>Stage</th></tr></thead>
        <tbody>
          {ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const time = times[id];
            const stage = isQ1Phase ? 'Q1' : (i < 10 ? 'Q2' : 'Q1');
            return (
              <tr key={id}>
                <td>{i + 1}</td>
                <td>{d?.name}</td>
                <td style={{ color: t?.color }}>{t?.shortName ?? '—'}</td>
                <td>{time !== undefined ? time.toFixed(3) : '—'}</td>
                <td>{stage}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="actions">
        {isQ1Done && <button className="primary big" onClick={advanceToQ2}>Run Q2 →</button>}
        {isQ2Done && <button className="primary big" onClick={onStartRace}>Start Race →</button>}
      </div>
    </>
  );
}

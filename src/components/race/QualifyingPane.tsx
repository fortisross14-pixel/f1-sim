import { useState, useEffect, useMemo, Fragment } from 'react';
import { useGame } from '../../GameContext';
import { useAudio } from '../../audio';
import { allDriversMap, teamByDriverMap } from '../common/helpers';
import { Flag } from '../common/Flag';

// Qualifying reveal with two-stage gating:
//  - phase='qualifying_q1' → reveal Q1 ticks (3 steps + final view), then "Run Q2"
//  - phase='qualifying_q2' → reveal Q2 ticks, then "Start Race"
// Internally the simulator already produced all 6 ticks; we just gate which are shown.
//
// Visual: stage banner up top with 3-dot progress indicator, table with
// position badges + flags + monospaced times + gap-to-pole. Continue CTA
// sits in the top-right of the stage banner. P10/P11 cutoff line drawn
// during Q1 to show the elimination zone.
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
  const tickIndex = (isQ1Phase ? 0 : 3) + step;
  const currentTick = !showFinal && tickIndex < q.ticks.length ? q.ticks[tickIndex] : null;

  // Resolve what to display at this step. Ranking & times come from either
  // the in-progress tick or the final qualifying result.
  let ranking: string[];
  let times: Record<string, number>;
  let stageLabel: string;
  let stageProgress: number; // 1, 2, 3 (filled dots) or 4 (final)

  if (isQ1Phase) {
    if (showFinal) {
      const lastQ1Tick = q.ticks[2];
      ranking = lastQ1Tick.ranking;
      times = lastQ1Tick.times;
      stageLabel = 'Q1 Final';
      stageProgress = 4;
    } else {
      ranking = currentTick!.ranking;
      times = currentTick!.times;
      stageLabel = `Q1 — Lap ${step + 1} of 3`;
      stageProgress = step + 1;
    }
  } else {
    if (showFinal) {
      ranking = q.ranking;
      times = q.times;
      stageLabel = 'Final Grid';
      stageProgress = 4;
    } else {
      ranking = currentTick!.ranking;
      times = currentTick!.times;
      stageLabel = `Q2 — Lap ${step + 1} of 3`;
      stageProgress = step + 1;
    }
  }

  // Pole time for delta calculation
  const poleTime = ranking.length > 0 ? times[ranking[0]] : 0;

  return (
    <div className="quali-screen">
      {/* Stage banner: stage label + progress dots on the left, CTA on the right */}
      <div className="quali-stage-banner">
        <div className="quali-stage-info">
          <div className="quali-stage-name">{stageLabel}</div>
          <div className="quali-stage-progress">
            {[1, 2, 3].map(n => (
              <span
                key={n}
                className={`quali-progress-dot ${stageProgress >= n ? 'filled' : ''} ${stageProgress === 4 ? 'filled' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="quali-stage-action">
          {isQ1Done && <button className="primary big" onClick={advanceToQ2}>Run Q2 →</button>}
          {isQ2Done && <button className="primary big" onClick={onStartRace}>Start Race →</button>}
        </div>
      </div>

      {/* Pole banner — only on Q2 final */}
      {isQ2Done && q.poleDriverId && (
        <div className="quali-pole-banner">
          <span className="quali-pole-label">🏆 Pole Position</span>
          <span className="quali-pole-driver">{driverMap.get(q.poleDriverId)?.name}</span>
          <span className="quali-pole-time">{q.times[q.poleDriverId]?.toFixed(3)}</span>
        </div>
      )}

      {/* Tick playback controls */}
      <div className="tick-controls">
        <button onClick={() => setStep(0)} disabled={step === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setStep(Math.min(maxStep - 1, step + 1)); }} disabled={step >= maxStep - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setStep(maxStep - 1); }} disabled={step === maxStep - 1}>⏭ Skip</button>
      </div>

      <table className="data-table quali-table">
        <thead>
          <tr>
            <th className="col-pos">Pos</th>
            <th>Driver</th>
            <th>Team</th>
            <th className="num">Time</th>
            <th className="num">Gap</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const time = times[id];
            const gap = time !== undefined && poleTime !== undefined ? time - poleTime : undefined;
            const pos = i + 1;
            // Cutoff line between P10 and P11 during Q1 phase: drivers above
            // the line advance to Q2, drivers below are out.
            const isAtCutoff = isQ1Phase && pos === 10;

            return (
              <Fragment key={id}>
                <tr className={pos <= 3 && isQ2Done ? 'row-top3' : ''}>
                  <td className="col-pos"><QualiPosBadge pos={pos} /></td>
                  <td className="cell-quali-driver">
                    {d && <Flag code={d.countryCode} title={d.country} />}
                    <span className="quali-driver-name">{d?.name}</span>
                  </td>
                  <td>
                    <span className="team-cell">
                      <span className="team-dot" style={{ background: t?.color }} />
                      <span style={{ color: t?.color, fontWeight: 600 }}>{t?.shortName ?? '—'}</span>
                    </span>
                  </td>
                  <td className="num quali-time">
                    {time !== undefined ? time.toFixed(3) : '—'}
                  </td>
                  <td className="num quali-gap">
                    {gap !== undefined && pos > 1 ? `+${gap.toFixed(3)}` : pos === 1 ? '—' : '—'}
                  </td>
                </tr>
                {isAtCutoff && (
                  <tr className="quali-cutoff-row" aria-hidden="true">
                    <td colSpan={5}>
                      <div className="quali-cutoff-line">
                        <span className="quali-cutoff-label">Q2 cutoff</span>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Position badge for qualifying — gold/silver/bronze for top 3 on final grid,
// otherwise a neutral pill with the position number.
function QualiPosBadge({ pos }: { pos: number }) {
  let cls = 'pos-badge';
  if (pos === 1) cls += ' pos-1';
  else if (pos === 2) cls += ' pos-2';
  else if (pos === 3) cls += ' pos-3';
  return <span className={cls}>{pos}</span>;
}

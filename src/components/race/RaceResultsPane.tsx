import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../../GameContext';
import { useAudio } from '../../audio';
import { allDriversMap, teamByDriverMap } from '../common/helpers';
import { Flag } from '../common/Flag';

// Race progression revealed snapshot-by-snapshot.
//
// Visual: stage banner up top with current lap label, a non-interactive
// progress bar showing how far through the 50 laps we are, and the
// continue CTA in the top-right. Below: tick controls, lap jump bar,
// then the position table with gainer/loser tinting on movement deltas.
// On the final snapshot, the top 3 rows get gold/silver/bronze tints.
//
// Audio: lights-out at start, engine loop during reveals, overtake/crash
// cues on snapshot changes, checkered + engine stop on final.
export function RaceResultsPane({ onFinish }: { onFinish: () => void }) {
  const { state } = useGame();
  const audio = useAudio();
  const r = state.lastRaceResult!;
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const totalSnapshots = r.snapshots.length;
  const totalLaps = state.calendar[state.currentRound - 1]?.circuit.laps ?? 50;
  const [snap, setSnap] = useState<number>(0);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const cur = r.snapshots[snap];
  const isFinal = snap === totalSnapshots - 1;

  useEffect(() => {
    if (!autoplay || snap >= totalSnapshots - 1) return;
    const dramatic = snap === 0 || snap === totalSnapshots - 2;
    const t = setTimeout(() => setSnap(s => s + 1), dramatic ? 2000 : 1400);
    return () => clearTimeout(t);
  }, [snap, autoplay, totalSnapshots]);

  // Audio: race start + engine loop
  useEffect(() => {
    audio.play('lights_out');
    const startTimer = setTimeout(() => audio.startEngineLoop(), 1500);
    return () => {
      clearTimeout(startTimer);
      audio.stopEngineLoop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Audio cues per snapshot reveal
  useEffect(() => {
    if (snap === 0) return;
    const hasCrash = cur.newIncidents.some(inc =>
      inc.type === 'crash_dnf' || inc.type === 'mechanical_dnf' || inc.causesInjury
    );
    if (hasCrash) audio.play('crash');
    const bigMover = Object.values(cur.positionsGainedVsQuali).filter(v => v >= 2).length;
    if (!hasCrash && bigMover > 0) audio.play('overtake');
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checkered + engine stop at final
  useEffect(() => {
    if (isFinal) {
      audio.stopEngineLoop();
      setTimeout(() => audio.play('checkered'), 200);
    }
  }, [isFinal]); // eslint-disable-line react-hooks/exhaustive-deps

  const lapLabel = (lap: number) => {
    if (lap === 0) return 'Starting Grid';
    if (isFinal) return 'Final Result';
    return `After Lap ${lap}`;
  };

  // Lap progress percentage for the visual bar
  const lapProgress = cur.lap === 0 ? 0 : (cur.lap / totalLaps) * 100;
  const buttonLabel = isFinal
    ? (state.currentRound === state.calendar.length ? 'End Season →' : 'Continue →')
    : 'Wait...';

  return (
    <div className="race-screen">
      {/* Stage banner: lap label + progress bar on the left, continue CTA on the right */}
      <div className="race-stage-banner">
        <div className="race-stage-info">
          <div className="race-stage-name">{lapLabel(cur.lap)}</div>
          <div className="race-stage-laps">
            Lap {cur.lap} / {totalLaps}
          </div>
          <div className="race-progress-track" aria-hidden="true">
            <div className="race-progress-fill" style={{ width: `${lapProgress}%` }} />
          </div>
        </div>
        <div className="race-stage-action">
          <button className="primary big" onClick={onFinish} disabled={!isFinal}>
            {buttonLabel}
          </button>
        </div>
      </div>

      {/* Final summary chips — only on last snapshot */}
      {isFinal && (
        <div className="race-summary-chips">
          <div className="race-summary-chip race-summary-winner">
            <span className="chip-label">🏁 Winner</span>
            <strong>{driverMap.get(r.finalRanking[0])?.name}</strong>
          </div>
          <div className="race-summary-chip">
            <span className="chip-label">⚡ Fastest lap</span>
            <strong>{driverMap.get(r.fastestLapDriverId)?.name}</strong>
          </div>
          <div className="race-summary-chip">
            <span className="chip-label">DNFs</span>
            <strong>{r.dnfs.length}</strong>
          </div>
        </div>
      )}

      {/* Tick playback controls */}
      <div className="tick-controls">
        <button onClick={() => setSnap(0)} disabled={snap === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setSnap(Math.max(0, snap - 1)); }} disabled={snap === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setSnap(Math.min(totalSnapshots - 1, snap + 1)); }} disabled={snap >= totalSnapshots - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setSnap(totalSnapshots - 1); }} disabled={isFinal}>⏭ Skip</button>
      </div>

      {/* Direct lap jump buttons */}
      <div className="lap-controls">
        <span>Jump to:</span>
        {r.snapshots.map((s, i) => (
          <button
            key={i}
            className={i === snap ? 'active' : ''}
            onClick={() => { setAutoplay(false); setSnap(i); }}
          >
            {s.lap === 0 ? 'Grid' : `L${s.lap}`}
          </button>
        ))}
      </div>

      <table className="data-table race-table">
        <thead>
          <tr>
            <th className="col-pos">Pos</th>
            <th>Driver</th>
            <th>Team</th>
            <th className="col-delta">Δ Quali</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {cur.ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const delta = cur.positionsGainedVsQuali[id] ?? 0;
            const isDNF = r.dnfs.includes(id);
            const pos = i + 1;

            // Row tinting: gainers green, losers red, DNF dark gray.
            // Top 3 on the final snapshot get gold/silver/bronze accents.
            let rowClass = '';
            if (isDNF) rowClass = 'row-dnf';
            else if (isFinal && pos === 1) rowClass = 'row-podium-1';
            else if (isFinal && pos === 2) rowClass = 'row-podium-2';
            else if (isFinal && pos === 3) rowClass = 'row-podium-3';
            else if (!isFinal && delta >= 2) rowClass = 'row-gainer';
            else if (!isFinal && delta <= -2) rowClass = 'row-loser';

            return (
              <tr key={id} className={rowClass}>
                <td className="col-pos"><RacePosBadge pos={pos} isFinal={isFinal} /></td>
                <td className="cell-race-driver">
                  {d && <Flag code={d.countryCode} title={d.country} />}
                  <span className={`race-driver-name ${isDNF ? 'dnf-strike' : ''}`}>{d?.name}</span>
                </td>
                <td>
                  <span className="team-cell">
                    <span className="team-dot" style={{ background: t?.color }} />
                    <span style={{ color: t?.color, fontWeight: 600 }}>{t?.shortName ?? '—'}</span>
                  </span>
                </td>
                <td className="col-delta">
                  {delta > 0 ? <span className="delta-up">▲ {delta}</span>
                    : delta < 0 ? <span className="delta-down">▼ {-delta}</span>
                    : <span className="delta-flat">—</span>}
                </td>
                <td>
                  {isDNF && <span className="status-dnf">DNF</span>}
                  {isFinal && !isDNF && r.pointsAwarded[id] !== undefined && r.pointsAwarded[id] > 0 && (
                    <span className="status-points">+{r.pointsAwarded[id]} pts</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {cur.newIncidents.length > 0 && (
        <div className="incidents incidents-active">
          <h4>⚠ Incidents on lap {cur.lap}</h4>
          <ul>
            {cur.newIncidents.map((inc, i) => (
              <li key={i}>
                <strong>{driverMap.get(inc.driverId)?.name}</strong>: {inc.type.replace('_', ' ')}
                {inc.causesInjury && ` (injury — out for ${inc.injuryRaces} race${inc.injuryRaces > 1 ? 's' : ''})`}
                {inc.delaySeconds > 0 && ` (lost ${inc.delaySeconds}s)`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Position badge for race results. On final, top 3 get gold/silver/bronze.
// In intermediate snapshots, all positions get the neutral pill.
function RacePosBadge({ pos, isFinal }: { pos: number; isFinal: boolean }) {
  let cls = 'pos-badge';
  if (isFinal && pos === 1) cls += ' pos-1';
  else if (isFinal && pos === 2) cls += ' pos-2';
  else if (isFinal && pos === 3) cls += ' pos-3';
  return <span className={cls}>{pos}</span>;
}

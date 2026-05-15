import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../../GameContext';
import { useAudio } from '../../audio';
import { allDriversMap, teamByDriverMap } from '../common/helpers';

// Race progression revealed snapshot-by-snapshot. Audio cues:
//  - Lights out on mount (race start)
//  - Engine loop during reveals
//  - Per-snapshot: crash sound for incidents, overtake sound for big movers
//  - Checkered + engine stop on final snapshot
export function RaceResultsPane({ onFinish }: { onFinish: () => void }) {
  const { state } = useGame();
  const audio = useAudio();
  const r = state.lastRaceResult!;
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const totalSnapshots = r.snapshots.length;
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
    if (lap === 3) return 'After Lap 3 — Opening Laps';
    if (lap === 48) return 'After Lap 48 — Closing In';
    if (lap === 50) return 'Final Result (Lap 50)';
    return `After Lap ${lap}`;
  };

  return (
    <>
      <h2>Race — {lapLabel(cur.lap)}</h2>
      {isFinal && (
        <p>
          🏁 Winner: <strong>{driverMap.get(r.finalRanking[0])?.name}</strong> &nbsp;|&nbsp;
          ⚡ Fastest lap: <strong>{driverMap.get(r.fastestLapDriverId)?.name}</strong> &nbsp;|&nbsp;
          DNFs: {r.dnfs.length}
        </p>
      )}
      <div className="tick-controls">
        <button onClick={() => setSnap(0)} disabled={snap === 0}>⏮ Restart</button>
        <button onClick={() => { setAutoplay(false); setSnap(Math.max(0, snap - 1)); }} disabled={snap === 0}>◀</button>
        <button onClick={() => setAutoplay(a => !a)}>{autoplay ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setAutoplay(false); setSnap(Math.min(totalSnapshots - 1, snap + 1)); }} disabled={snap >= totalSnapshots - 1}>▶</button>
        <button onClick={() => { setAutoplay(false); setSnap(totalSnapshots - 1); }} disabled={isFinal}>⏭ Skip</button>
      </div>
      <div className="lap-controls">
        <span>Jump to:</span>
        {r.snapshots.map((s, i) => (
          <button key={i} className={i === snap ? 'active' : ''} onClick={() => { setAutoplay(false); setSnap(i); }}>
            {s.lap === 0 ? 'Grid' : `L${s.lap}`}
          </button>
        ))}
      </div>
      <table className="data-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Δ vs Quali</th><th>Status</th></tr></thead>
        <tbody>
          {cur.ranking.map((id, i) => {
            const d = driverMap.get(id);
            const t = teamByDriver.get(id);
            const delta = cur.positionsGainedVsQuali[id] ?? 0;
            const isDNF = r.dnfs.includes(id);
            return (
              <tr key={id}>
                <td>{i + 1}</td>
                <td>{d?.name}</td>
                <td style={{ color: t?.color }}>{t?.shortName ?? '—'}</td>
                <td>
                  {delta > 0 ? <span className="up">▲ {delta}</span>
                    : delta < 0 ? <span className="down">▼ {-delta}</span>
                    : '—'}
                </td>
                <td>
                  {isDNF ? <span className="down">DNF</span> : ''}
                  {isFinal && !isDNF && r.pointsAwarded[id] ? `+${r.pointsAwarded[id]} pts` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cur.newIncidents.length > 0 && (
        <div className="incidents">
          <h4>Incidents on lap {cur.lap}:</h4>
          <ul>
            {cur.newIncidents.map((inc, i) => (
              <li key={i}>
                {driverMap.get(inc.driverId)?.name}: {inc.type.replace('_', ' ')}
                {inc.causesInjury && ` (injury — out for ${inc.injuryRaces} race${inc.injuryRaces > 1 ? 's' : ''})`}
                {inc.delaySeconds > 0 && ` (lost ${inc.delaySeconds}s)`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="actions">
        <button className="primary big" onClick={onFinish} disabled={!isFinal}>
          {isFinal
            ? (state.currentRound === state.calendar.length ? 'End Season →' : 'Continue →')
            : 'Wait...'}
        </button>
      </div>
    </>
  );
}

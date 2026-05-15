import { useMemo } from 'react';
import { Circuit, CircuitHistoryEntry } from '../../sim/types';
import { PopupShell } from './PopupShell';

// Popup showing every race ever run at a given circuit. Pulled from the
// per-circuit history log (keyed by circuit name).
//
// Hero shows the circuit name + country + profile. Body has a few aggregate
// stats (most wins, most poles) and a year-by-year table of every race.
export function CircuitDetailPopup({ circuit, history, onClose }: {
  circuit: Circuit;
  history: CircuitHistoryEntry[];
  onClose: () => void;
}) {
  // Aggregate stats: most wins / poles / FLs at this circuit
  const stats = useMemo(() => computeCircuitStats(history), [history]);

  return (
    <PopupShell
      onClose={onClose}
      accentColor="var(--f1-red)"
      hero={
        <div className="popup-circuit-hero">
          <div className="popup-circuit-identity">
            <div className="popup-driver-meta-top">
              <span className={`mini-chip profile-${circuit.profile}`}>{circuit.profile}</span>
              <span className="popup-driver-archetype">Grand Prix</span>
            </div>
            <h2 className="popup-driver-name">{circuit.name}</h2>
            <div className="popup-driver-meta-bottom">
              <span>{circuit.country}</span>
              <span>·</span>
              <span>{circuit.laps} laps</span>
              <span>·</span>
              <span>{history.length} race{history.length === 1 ? '' : 's'} on record</span>
            </div>
          </div>
        </div>
      }
    >
      {history.length === 0 ? (
        <p className="muted">No races have been run at this circuit yet.</p>
      ) : (
        <>
          <h3>Top performers here</h3>
          <div className="stat-grid">
            <Stat
              label="Most wins"
              value={stats.topWins.name}
              count={stats.topWins.count}
              accent="gold"
            />
            <Stat
              label="Most poles"
              value={stats.topPoles.name}
              count={stats.topPoles.count}
            />
            <Stat
              label="Most fastest laps"
              value={stats.topFL.name}
              count={stats.topFL.count}
            />
          </div>

          <h3>Race-by-race</h3>
          <table className="data-table compact history-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Winner</th>
                <th>Team</th>
                <th>Pole</th>
                <th>Fastest lap</th>
                <th>Weather</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h, i) => (
                <tr key={i}>
                  <td><strong>{h.year}</strong></td>
                  <td>{h.winnerDriverName}</td>
                  <td style={{ color: h.winnerTeamColor, fontWeight: 600 }}>{h.winnerTeamName}</td>
                  <td className="muted">{h.poleDriverName}</td>
                  <td className="muted">{h.fastestLapDriverName}</td>
                  <td>
                    <span className={`mini-chip weather-${h.weather}`}>
                      {h.weather === 'rain' ? '🌧' : h.weather === 'hot' ? '🔥' : '☀'} {h.weather}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </PopupShell>
  );
}

// "Stat" variant that shows a name + a count beside it ("Senna · 3 wins").
function Stat({ label, value, count, accent }: {
  label: string; value: string; count: number; accent?: 'gold';
}) {
  return (
    <div className={`stat-tile${accent ? ` stat-tile-${accent}` : ''}`}>
      <div className="stat-tile-value stat-tile-value-name">{value}</div>
      <div className="stat-tile-label">{label} ({count})</div>
    </div>
  );
}

interface CircuitStats {
  topWins: { name: string; count: number };
  topPoles: { name: string; count: number };
  topFL: { name: string; count: number };
}

function computeCircuitStats(history: CircuitHistoryEntry[]): CircuitStats {
  const winCounts = new Map<string, number>();
  const poleCounts = new Map<string, number>();
  const flCounts = new Map<string, number>();
  for (const h of history) {
    winCounts.set(h.winnerDriverName, (winCounts.get(h.winnerDriverName) ?? 0) + 1);
    poleCounts.set(h.poleDriverName, (poleCounts.get(h.poleDriverName) ?? 0) + 1);
    flCounts.set(h.fastestLapDriverName, (flCounts.get(h.fastestLapDriverName) ?? 0) + 1);
  }
  const topOf = (m: Map<string, number>): { name: string; count: number } => {
    let bestName = '—'; let best = 0;
    for (const [name, count] of m) {
      if (count > best) { best = count; bestName = name; }
    }
    return { name: bestName, count: best };
  };
  return {
    topWins: topOf(winCounts),
    topPoles: topOf(poleCounts),
    topFL: topOf(flCounts),
  };
}

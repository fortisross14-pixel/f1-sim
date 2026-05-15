import { useState, useMemo } from 'react';
import { useGame } from '../../GameContext';
import { Driver, Team } from '../../sim/types';
import { effectiveDriverSkills, driverOverall } from '../../sim/generators';
import { DriverDetailPopup } from '../popups/DriverDetailPopup';
import { Flag } from '../common/Flag';
import { SortHeader } from '../common/SortHeader';
import { RarityChip } from '../common/RarityChip';
import { teamByDriverMap, rarityOrder, toggleSort } from '../common/helpers';

type DriverSortKey =
  | 'name' | 'team' | 'age' | 'rarity'
  | 'driving' | 'physical' | 'carSetup' | 'speed' | 'overall' | 'years';

// Sortable table of all active drivers. Free agents render with an empty team
// cell. The country flag sits inline next to the driver name (F1.com pattern)
// so we don't need a dedicated country column.
//
// OVR is rendered as a horizontal bar with the number on the left; individual
// skills (DRV/PHY/CAR/SPD) are plain numbers in subsequent columns.
export function PilotsTab() {
  const { state } = useGame();
  const [sortKey, setSortKey] = useState<DriverSortKey>('overall');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);

  const teamByDriver = useMemo(() => teamByDriverMap(state.teams), [state.teams]);
  const sorted = useMemo(
    () => sortDrivers(state.drivers, sortKey, sortAsc, teamByDriver),
    [state.drivers, sortKey, sortAsc, teamByDriver]
  );

  const onSort = (k: DriverSortKey) => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc);

  return (
    <div className="screen">
      <div className="pilots-header">
        <h2>Pilots</h2>
        <div className="pilots-count">{state.drivers.length} active</div>
      </div>

      <table className="data-table pilots-table">
        <thead>
          <tr>
            <SortHeader label="Driver" k="name" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Team" k="team" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Yrs" k="years" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Age" k="age" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Rarity" k="rarity" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <th>Archetype</th>
            <SortHeader label="Overall" k="overall" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="DRV" k="driving" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="PHY" k="physical" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="CAR" k="carSetup" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="SPD" k="speed" curr={sortKey} asc={sortAsc} onClick={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => {
            const t = teamByDriver.get(d.id);
            const sk = effectiveDriverSkills(d);
            const ovr = driverOverall(d);
            return (
              <tr key={d.id}>
                {/* Driver name cell: flag + name + status badges */}
                <td className="cell-driver-name">
                  <Flag code={d.countryCode} title={d.country} />
                  <button className="link-btn driver-name-btn" onClick={() => setPopupDriver(d)}>
                    {d.name}
                  </button>
                  {d.retirementAnnounced && <StatusBadge kind="retiring">⏳</StatusBadge>}
                  {d.injuredRaces > 0 && <StatusBadge kind="injury">🚑 {d.injuredRaces}</StatusBadge>}
                </td>
                {/* Team cell: colored dot + short name (or "Free Agent") */}
                <td>
                  {t ? (
                    <span className="team-cell">
                      <span className="team-dot" style={{ background: t.color }} />
                      <span style={{ color: t.color, fontWeight: 600 }}>{t.shortName}</span>
                      <span className="team-fullname">{t.name}</span>
                    </span>
                  ) : (
                    <span className="free-agent">Free Agent</span>
                  )}
                </td>
                <td className="num">{d.age - d.careerStartAge + 1}</td>
                <td className="num">{d.age}</td>
                <td><RarityChip rarity={d.rarity} /></td>
                <td className="cell-archetype">{d.archetype}</td>
                {/* OVR cell: bar + number combined */}
                <td className="cell-ovr">
                  <OvrBar value={ovr} />
                </td>
                {/* Individual skill numbers */}
                <td className="num skill-num">{sk.driving}</td>
                <td className="num skill-num">{sk.physical}</td>
                <td className="num skill-num">{sk.carSetup}</td>
                <td className="num skill-num">{sk.speed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
    </div>
  );
}

// OVR rendered as a number + a fixed-width bar showing the value out of 99.
// Number sits to the left of the bar so the eye can scan numbers cleanly when
// sorting by OVR, and the bar gives a quick visual sense of the driver's tier.
function OvrBar({ value }: { value: number }) {
  // Clamp display range: anything under 40 still gets a visible sliver;
  // anything 95+ fills out.
  const pct = Math.max(8, Math.min(100, ((value - 40) / 55) * 100));
  return (
    <div className="ovr-bar">
      <span className="ovr-bar-number">{value}</span>
      <div className="ovr-bar-track">
        <div className="ovr-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Small inline status badge for retiring/injured indicators.
function StatusBadge({ kind, children }: { kind: 'retiring' | 'injury'; children: React.ReactNode }) {
  return <span className={`status-badge status-${kind}`}>{children}</span>;
}

function sortDrivers(
  drivers: Driver[],
  k: DriverSortKey,
  asc: boolean,
  teamByDriver: Map<string, Team>
): Driver[] {
  const dir = asc ? 1 : -1;
  return [...drivers].sort((a, b) => {
    const sa = effectiveDriverSkills(a);
    const sb = effectiveDriverSkills(b);
    const teamA = teamByDriver.get(a.id)?.name ?? '~Free Agent';
    const teamB = teamByDriver.get(b.id)?.name ?? '~Free Agent';
    switch (k) {
      case 'name':     return dir * a.name.localeCompare(b.name);
      case 'team':     return dir * teamA.localeCompare(teamB);
      case 'age':      return dir * (a.age - b.age);
      case 'rarity':   return dir * (rarityOrder(a.rarity) - rarityOrder(b.rarity));
      case 'driving':  return dir * (sa.driving - sb.driving);
      case 'physical': return dir * (sa.physical - sb.physical);
      case 'carSetup': return dir * (sa.carSetup - sb.carSetup);
      case 'speed':    return dir * (sa.speed - sb.speed);
      case 'overall':  return dir * (driverOverall(a) - driverOverall(b));
      case 'years':    return dir * ((a.age - a.careerStartAge) - (b.age - b.careerStartAge));
    }
  });
}

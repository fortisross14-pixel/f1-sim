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

// Sortable table of all active drivers. Free agents show with an empty Team column.
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
      <h2>Pilots ({state.drivers.length} active)</h2>
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader label="Name" k="name" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <th>Country</th>
            <SortHeader label="Team" k="team" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Yrs" k="years" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Age" k="age" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Rarity" k="rarity" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <th>Archetype</th>
            <SortHeader label="OVR" k="overall" curr={sortKey} asc={sortAsc} onClick={onSort} />
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
                <td>
                  <button className="link-btn" onClick={() => setPopupDriver(d)}>{d.name}</button>
                  {d.retirementAnnounced && <span className="retiring"> ⏳</span>}
                  {d.injuredRaces > 0 && <span className="injury"> 🚑{d.injuredRaces}</span>}
                </td>
                <td title={d.country}><Flag code={d.countryCode} title={d.country} /></td>
                <td style={{ color: t?.color }}>
                  {t?.name ?? <em className="muted">Free Agent</em>}
                </td>
                <td>{d.age - d.careerStartAge + 1}</td>
                <td>{d.age}</td>
                <td><RarityChip rarity={d.rarity} /></td>
                <td>{d.archetype}</td>
                <td><strong>{ovr}</strong></td>
                <td>{sk.driving}</td>
                <td>{sk.physical}</td>
                <td>{sk.carSetup}</td>
                <td>{sk.speed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
    </div>
  );
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

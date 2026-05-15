import { useState } from 'react';
import { useGame } from '../../GameContext';
import { Driver, EngineeringDirector, RaceDirector, Team, DirectorYearRecord } from '../../sim/types';
import { DriverDetailPopup } from '../popups/DriverDetailPopup';
import { TeamDetailPopup } from '../popups/TeamDetailPopup';
import { EngDirectorDetailPopup } from '../popups/EngDirectorDetailPopup';
import { RaceDirectorDetailPopup } from '../popups/RaceDirectorDetailPopup';
import { SortHeader } from '../common/SortHeader';
import { RarityChip } from '../common/RarityChip';
import { Flag } from '../common/Flag';
import { TeamLogo } from '../common/TeamLogo';
import { rarityOrder, toggleSort } from '../common/helpers';

type HistorySubTab = 'drivers' | 'directors' | 'teams';
type HistoryFilter = 'active' | 'retired' | 'all';

// History tab — three sub-tabs (Drivers, Directors, Teams).
// All three offer Active/Retired/All filters and sortable columns.
export function HistoryTab() {
  const [sub, setSub] = useState<HistorySubTab>('drivers');
  return (
    <div className="screen">
      <h2>History</h2>
      <div className="sub-tabs">
        <button onClick={() => setSub('drivers')} className={sub === 'drivers' ? 'active' : ''}>Drivers</button>
        <button onClick={() => setSub('directors')} className={sub === 'directors' ? 'active' : ''}>Directors</button>
        <button onClick={() => setSub('teams')} className={sub === 'teams' ? 'active' : ''}>Teams</button>
      </div>
      {sub === 'drivers' && <DriverHistory />}
      {sub === 'directors' && <DirectorHistory />}
      {sub === 'teams' && <TeamHistory />}
    </div>
  );
}

// Common filter row used by all three sub-tabs.
function FilterRow({ filter, setFilter, extras }: {
  filter: HistoryFilter;
  setFilter: (f: HistoryFilter) => void;
  extras?: React.ReactNode;
}) {
  return (
    <div className="filter-row">
      {extras}
      <span className="filter-label">Show</span>
      <div className="filter-chip-group">
        <button onClick={() => setFilter('active')}  className={`filter-chip ${filter === 'active'  ? 'active' : ''}`}>Active</button>
        <button onClick={() => setFilter('retired')} className={`filter-chip ${filter === 'retired' ? 'active' : ''}`}>Retired</button>
        <button onClick={() => setFilter('all')}     className={`filter-chip ${filter === 'all'     ? 'active' : ''}`}>All</button>
      </div>
    </div>
  );
}

// Status pill: green for active, gray for retired.
function StatusPill({ retired }: { retired: boolean }) {
  return (
    <span className={`status-pill ${retired ? 'status-pill-retired' : 'status-pill-active'}`}>
      {retired ? 'Retired' : 'Active'}
    </span>
  );
}

// ============================================================================
// DRIVERS SUB-TAB
// ============================================================================
type DriverHistSort =
  | 'name' | 'rarity' | 'races' | 'wins' | 'podiums'
  | 'poles' | 'points' | 'championships';

function DriverHistory() {
  const { state } = useGame();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [sortKey, setSortKey] = useState<DriverHistSort>('championships');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);

  const drivers: Driver[] =
    filter === 'active' ? state.drivers :
    filter === 'retired' ? state.retiredDrivers :
    [...state.drivers, ...state.retiredDrivers];

  const totalPoints = (d: Driver) => d.yearHistory.reduce((a, b) => a + b.points, 0);
  const sorted = [...drivers].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortKey) {
      case 'name':          return dir * a.name.localeCompare(b.name);
      case 'rarity':        return dir * (rarityOrder(a.rarity) - rarityOrder(b.rarity));
      case 'races':         return dir * (a.careerStarts - b.careerStarts);
      case 'wins':          return dir * (a.careerWins - b.careerWins);
      case 'podiums':       return dir * (a.careerPodiums - b.careerPodiums);
      case 'poles':         return dir * (a.careerPoles - b.careerPoles);
      case 'points':        return dir * (totalPoints(a) - totalPoints(b));
      case 'championships': return dir * (a.careerChampionships - b.careerChampionships);
    }
  });

  const onSort = (k: DriverHistSort) => toggleSort(k, sortKey, sortAsc, setSortKey, setSortAsc);

  return (
    <>
      <FilterRow filter={filter} setFilter={setFilter} />
      <table className="data-table history-list-table">
        <thead>
          <tr>
            <SortHeader label="Driver" k="name" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Rarity" k="rarity" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <th>Status</th>
            <SortHeader label="Races"   k="races"         curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Wins"    k="wins"          curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Podiums" k="podiums"       curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Poles"   k="poles"         curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Points"  k="points"        curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="WC"      k="championships" curr={sortKey} asc={sortAsc} onClick={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => (
            <tr key={d.id}>
              <td className="cell-driver-name">
                <Flag code={d.countryCode} title={d.country} />
                <button className="link-btn driver-name-btn" onClick={() => setPopupDriver(d)}>{d.name}</button>
              </td>
              <td><RarityChip rarity={d.rarity} /></td>
              <td><StatusPill retired={d.retired} /></td>
              <td className="num">{d.careerStarts}</td>
              <td className="num"><strong>{d.careerWins}</strong></td>
              <td className="num">{d.careerPodiums}</td>
              <td className="num">{d.careerPoles}</td>
              <td className="num">{totalPoints(d)}</td>
              <td className="num">
                {d.careerChampionships > 0 ? (
                  <span className="champ-count">{d.careerChampionships}</span>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
    </>
  );
}

// ============================================================================
// DIRECTORS SUB-TAB
// ============================================================================
function DirectorHistory() {
  const { state } = useGame();
  const [kind, setKind] = useState<'eng' | 'race'>('eng');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [popupEng, setPopupEng] = useState<EngineeringDirector | null>(null);
  const [popupRD, setPopupRD] = useState<RaceDirector | null>(null);

  const engs: EngineeringDirector[] =
    filter === 'active' ? state.engineeringDirectors :
    filter === 'retired' ? state.retiredEngDirectors :
    [...state.engineeringDirectors, ...state.retiredEngDirectors];
  const rds: RaceDirector[] =
    filter === 'active' ? state.raceDirectors :
    filter === 'retired' ? state.retiredRaceDirectors :
    [...state.raceDirectors, ...state.retiredRaceDirectors];

  const yearsActive = (h: DirectorYearRecord[]) => h.filter(y => y.teamId !== null).length;
  const totalTeamWins = (h: DirectorYearRecord[]) => h.reduce((a, b) => a + b.teamRaceWins, 0);
  const totalDriverWC = (h: DirectorYearRecord[]) => h.filter(y => y.driverWC).length;
  const totalConstructorWC = (h: DirectorYearRecord[]) => h.filter(y => y.constructorWC).length;

  const list = kind === 'eng' ? engs : rds;
  const sorted = [...list].sort((a, b) => totalTeamWins(b.yearHistory) - totalTeamWins(a.yearHistory));

  return (
    <>
      <FilterRow
        filter={filter}
        setFilter={setFilter}
        extras={
          <>
            <span className="filter-label">Type</span>
            <div className="filter-chip-group">
              <button onClick={() => setKind('eng')}  className={`filter-chip ${kind === 'eng'  ? 'active' : ''}`}>Engineering</button>
              <button onClick={() => setKind('race')} className={`filter-chip ${kind === 'race' ? 'active' : ''}`}>Race</button>
            </div>
            <span className="filter-divider" />
          </>
        }
      />
      <table className="data-table history-list-table">
        <thead>
          <tr>
            <th>Director</th>
            <th>Rarity</th>
            <th>Status</th>
            <th className="num">Years</th>
            <th className="num">Team Wins</th>
            <th className="num">Driver WC</th>
            <th className="num">Constructor WC</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => (
            <tr key={d.id}>
              <td className="cell-driver-name">
                {d.countryCode && <Flag code={d.countryCode} title={d.country} />}
                <button
                  className="link-btn driver-name-btn"
                  onClick={() => kind === 'eng'
                    ? setPopupEng(d as EngineeringDirector)
                    : setPopupRD(d as RaceDirector)}
                >{d.name}</button>
              </td>
              <td><RarityChip rarity={d.rarity} /></td>
              <td><StatusPill retired={d.retired} /></td>
              <td className="num">{yearsActive(d.yearHistory)}</td>
              <td className="num"><strong>{totalTeamWins(d.yearHistory)}</strong></td>
              <td className="num">
                {totalDriverWC(d.yearHistory) > 0
                  ? <span className="champ-count">{totalDriverWC(d.yearHistory)}</span>
                  : '—'}
              </td>
              <td className="num">
                {totalConstructorWC(d.yearHistory) > 0
                  ? <span className="champ-count">{totalConstructorWC(d.yearHistory)}</span>
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {popupEng && <EngDirectorDetailPopup director={popupEng} onClose={() => setPopupEng(null)} />}
      {popupRD && <RaceDirectorDetailPopup director={popupRD} onClose={() => setPopupRD(null)} />}
    </>
  );
}

// ============================================================================
// TEAMS SUB-TAB
// ============================================================================
function TeamHistory() {
  const { state } = useGame();
  const [popupTeam, setPopupTeam] = useState<Team | null>(null);

  const sorted = [...state.teams].sort(
    (a, b) => b.careerConstructorWC - a.careerConstructorWC || b.careerWins - a.careerWins
  );

  return (
    <>
      <table className="data-table history-list-table">
        <thead>
          <tr>
            <th>Team</th>
            <th className="num">Seasons</th>
            <th className="num">Wins</th>
            <th className="num">Podiums</th>
            <th className="num">Poles</th>
            <th className="num">Driver WC</th>
            <th className="num">Constructor WC</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(t => (
            <tr key={t.id}>
              <td>
                <span className="constructor-cell">
                  <TeamLogo team={t} size={28} />
                  <button
                    className="link-btn driver-name-btn"
                    style={{ color: t.color }}
                    onClick={() => setPopupTeam(t)}
                  >
                    {t.name}
                  </button>
                </span>
              </td>
              <td className="num">{t.yearHistory.length}</td>
              <td className="num"><strong>{t.careerWins}</strong></td>
              <td className="num">{t.careerPodiums}</td>
              <td className="num">{t.careerPoles}</td>
              <td className="num">
                {t.careerDriverWC > 0 ? <span className="champ-count">{t.careerDriverWC}</span> : '—'}
              </td>
              <td className="num">
                {t.careerConstructorWC > 0 ? <span className="champ-count">{t.careerConstructorWC}</span> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {popupTeam && <TeamDetailPopup team={popupTeam} onClose={() => setPopupTeam(null)} />}
    </>
  );
}

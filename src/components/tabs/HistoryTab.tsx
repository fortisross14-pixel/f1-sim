import { useState } from 'react';
import { useGame } from '../../GameContext';
import { Driver, EngineeringDirector, RaceDirector, Team, DirectorYearRecord } from '../../sim/types';
import { DriverDetailPopup } from '../popups/DriverDetailPopup';
import { TeamDetailPopup } from '../popups/TeamDetailPopup';
import { EngDirectorDetailPopup } from '../popups/EngDirectorDetailPopup';
import { RaceDirectorDetailPopup } from '../popups/RaceDirectorDetailPopup';
import { SortHeader } from '../common/SortHeader';
import { RarityChip } from '../common/RarityChip';
import { rarityOrder, toggleSort } from '../common/helpers';

type HistorySubTab = 'drivers' | 'directors' | 'teams';
type HistoryFilter = 'active' | 'retired' | 'all';

// History tab with three sub-tabs: drivers, directors (eng/race), teams.
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
      <div className="filter-row">
        <span>Filter: </span>
        <button onClick={() => setFilter('active')} className={filter === 'active' ? 'active' : ''}>Active</button>
        <button onClick={() => setFilter('retired')} className={filter === 'retired' ? 'active' : ''}>Retired</button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>All</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader label="Name" k="name" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Rarity" k="rarity" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <th>Status</th>
            <SortHeader label="Races" k="races" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Wins" k="wins" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Podiums" k="podiums" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Poles" k="poles" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="Points" k="points" curr={sortKey} asc={sortAsc} onClick={onSort} />
            <SortHeader label="WC" k="championships" curr={sortKey} asc={sortAsc} onClick={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => (
            <tr key={d.id}>
              <td><button className="link-btn" onClick={() => setPopupDriver(d)}>{d.name}</button></td>
              <td><RarityChip rarity={d.rarity} /></td>
              <td>{d.retired ? <span className="muted">Retired</span> : 'Active'}</td>
              <td>{d.careerStarts}</td>
              <td>{d.careerWins}</td>
              <td>{d.careerPodiums}</td>
              <td>{d.careerPoles}</td>
              <td>{totalPoints(d)}</td>
              <td>{d.careerChampionships}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
    </>
  );
}

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

  return (
    <>
      <div className="filter-row">
        <span>Type: </span>
        <button onClick={() => setKind('eng')} className={kind === 'eng' ? 'active' : ''}>Engineering</button>
        <button onClick={() => setKind('race')} className={kind === 'race' ? 'active' : ''}>Race</button>
        <span style={{ marginLeft: 20 }}>Filter: </span>
        <button onClick={() => setFilter('active')} className={filter === 'active' ? 'active' : ''}>Active</button>
        <button onClick={() => setFilter('retired')} className={filter === 'retired' ? 'active' : ''}>Retired</button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>All</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th><th>Rarity</th><th>Status</th>
            <th>Years Active</th><th>Team Wins</th><th>Driver WC</th><th>Constructor WC</th>
          </tr>
        </thead>
        <tbody>
          {(kind === 'eng' ? engs : rds)
            .sort((a, b) => totalTeamWins(b.yearHistory) - totalTeamWins(a.yearHistory))
            .map(d => (
              <tr key={d.id}>
                <td>
                  <button
                    className="link-btn"
                    onClick={() => kind === 'eng'
                      ? setPopupEng(d as EngineeringDirector)
                      : setPopupRD(d as RaceDirector)}
                  >{d.name}</button>
                </td>
                <td><RarityChip rarity={d.rarity} /></td>
                <td>{d.retired ? <span className="muted">Retired</span> : 'Active'}</td>
                <td>{yearsActive(d.yearHistory)}</td>
                <td>{totalTeamWins(d.yearHistory)}</td>
                <td>{totalDriverWC(d.yearHistory)}</td>
                <td>{totalConstructorWC(d.yearHistory)}</td>
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
function TeamHistory() {
  const { state } = useGame();
  const [popupTeam, setPopupTeam] = useState<Team | null>(null);
  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            <th>Team</th><th>Years</th><th>Wins</th><th>Podiums</th>
            <th>Poles</th><th>Driver WC</th><th>Constructor WC</th>
          </tr>
        </thead>
        <tbody>
          {[...state.teams]
            .sort((a, b) => b.careerConstructorWC - a.careerConstructorWC || b.careerWins - a.careerWins)
            .map(t => (
              <tr key={t.id}>
                <td>
                  <button className="link-btn" style={{ color: t.color }} onClick={() => setPopupTeam(t)}>
                    {t.name}
                  </button>
                </td>
                <td>{t.yearHistory.length}</td>
                <td>{t.careerWins}</td>
                <td>{t.careerPodiums}</td>
                <td>{t.careerPoles}</td>
                <td>{t.careerDriverWC}</td>
                <td>{t.careerConstructorWC}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {popupTeam && <TeamDetailPopup team={popupTeam} onClose={() => setPopupTeam(null)} />}
    </>
  );
}

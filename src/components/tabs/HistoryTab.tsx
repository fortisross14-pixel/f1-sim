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

type HistorySubTab = 'wc' | 'drivers' | 'directors' | 'teams';
type HistoryFilter = 'active' | 'retired' | 'all';

// History tab — four sub-tabs: World Championships (year-by-year title roster),
// Drivers, Directors, Teams. All offer sortable columns; the latter three offer
// Active/Retired/All filters.
export function HistoryTab() {
  const [sub, setSub] = useState<HistorySubTab>('wc');
  return (
    <div className="screen">
      <h2>History</h2>
      <div className="sub-tabs">
        <button onClick={() => setSub('wc')} className={sub === 'wc' ? 'active' : ''}>World Championships</button>
        <button onClick={() => setSub('drivers')} className={sub === 'drivers' ? 'active' : ''}>Drivers</button>
        <button onClick={() => setSub('directors')} className={sub === 'directors' ? 'active' : ''}>Directors</button>
        <button onClick={() => setSub('teams')} className={sub === 'teams' ? 'active' : ''}>Teams</button>
      </div>
      {sub === 'wc' && <ChampionshipHistory />}
      {sub === 'drivers' && <DriverHistory />}
      {sub === 'directors' && <DirectorHistory />}
      {sub === 'teams' && <TeamHistory />}
    </div>
  );
}

// ============================================================================
// WORLD CHAMPIONSHIPS SUB-TAB
// ============================================================================
// Year-by-year roll-call of every WDC + WCC since universe creation.
// Walks each team's yearHistory to find which won the constructor title each
// year, and each driver's yearHistory (both active and retired) for the WDC.
function ChampionshipHistory() {
  const { state } = useGame();

  // Build a year → champion record. Walking drivers + retiredDrivers ensures
  // we catch champions who have since retired (their yearHistory persists).
  type ChampRow = {
    year: number;
    driverChampionName: string | null;
    driverChampionTeamName: string | null;
    driverChampionTeamColor: string | null;
    driverChampionPoints: number;
    driverChampionRarity: string | null;
    constructorChampionName: string | null;
    constructorChampionColor: string | null;
    constructorChampionPoints: number;
  };
  const rowByYear = new Map<number, ChampRow>();
  const ensure = (year: number): ChampRow => {
    if (!rowByYear.has(year)) {
      rowByYear.set(year, {
        year,
        driverChampionName: null,
        driverChampionTeamName: null,
        driverChampionTeamColor: null,
        driverChampionPoints: 0,
        driverChampionRarity: null,
        constructorChampionName: null,
        constructorChampionColor: null,
        constructorChampionPoints: 0,
      });
    }
    return rowByYear.get(year)!;
  };

  // Driver champions (across active + retired)
  const allDrivers = [...state.drivers, ...state.retiredDrivers];
  for (const d of allDrivers) {
    for (const y of d.yearHistory) {
      if (!y.isWorldChampion) continue;
      const row = ensure(y.year);
      row.driverChampionName = d.name;
      row.driverChampionTeamName = y.teamName;
      row.driverChampionPoints = y.points;
      row.driverChampionRarity = y.rarityAtTime;
      // Team color: look up by current team list. Teams persist across years,
      // unlike drivers, so this should usually resolve. Falls back to gray.
      const team = state.teams.find(t => t.id === y.teamId);
      row.driverChampionTeamColor = team?.color ?? '#888';
    }
  }
  // Constructor champions
  for (const t of state.teams) {
    for (const y of t.yearHistory) {
      if (!y.constructorWC) continue;
      const row = ensure(y.year);
      row.constructorChampionName = t.name;
      row.constructorChampionColor = t.color;
      row.constructorChampionPoints = y.points;
    }
  }

  // Sorted: most recent year first
  const rows = [...rowByYear.values()].sort((a, b) => b.year - a.year);

  // Aggregate driver / constructor title counts for the small leaderboard
  const driverTitleCount = new Map<string, number>();
  const constructorTitleCount = new Map<string, number>();
  for (const r of rows) {
    if (r.driverChampionName) {
      driverTitleCount.set(r.driverChampionName, (driverTitleCount.get(r.driverChampionName) ?? 0) + 1);
    }
    if (r.constructorChampionName) {
      constructorTitleCount.set(r.constructorChampionName, (constructorTitleCount.get(r.constructorChampionName) ?? 0) + 1);
    }
  }
  const topDriver = [...driverTitleCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const topConstructor = [...constructorTitleCount.entries()].sort((a, b) => b[1] - a[1])[0];

  if (rows.length === 0) {
    return (
      <p className="muted">No championships have been decided yet. Finish a season to see the first entry here.</p>
    );
  }

  return (
    <>
      <div className="wc-summary-row">
        <div className="wc-summary-card">
          <div className="wc-summary-label">Seasons played</div>
          <div className="wc-summary-value">{rows.length}</div>
        </div>
        {topDriver && (
          <div className="wc-summary-card">
            <div className="wc-summary-label">Most Drivers' titles</div>
            <div className="wc-summary-value-name">{topDriver[0]}</div>
            <div className="wc-summary-sub">{topDriver[1]} title{topDriver[1] === 1 ? '' : 's'}</div>
          </div>
        )}
        {topConstructor && (
          <div className="wc-summary-card">
            <div className="wc-summary-label">Most Constructors' titles</div>
            <div className="wc-summary-value-name">{topConstructor[0]}</div>
            <div className="wc-summary-sub">{topConstructor[1]} title{topConstructor[1] === 1 ? '' : 's'}</div>
          </div>
        )}
      </div>

      <table className="data-table history-list-table wc-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Drivers' Champion</th>
            <th>Team</th>
            <th className="num">Pts</th>
            <th>Constructors' Champion</th>
            <th className="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.year} className="wc-row">
              <td><span className="wc-year">{r.year}</span></td>
              <td>
                {r.driverChampionName ? (
                  <span className="wc-champion-cell">
                    <span className="trophy">🏆</span>
                    <span className="wc-champion-name">{r.driverChampionName}</span>
                    {r.driverChampionRarity && (
                      <span className={`rarity rarity-${r.driverChampionRarity}`}>{r.driverChampionRarity}</span>
                    )}
                  </span>
                ) : <span className="muted">—</span>}
              </td>
              <td>
                {r.driverChampionTeamName && (
                  <span style={{ color: r.driverChampionTeamColor ?? undefined, fontWeight: 600 }}>
                    {r.driverChampionTeamName}
                  </span>
                )}
              </td>
              <td className="num"><strong>{r.driverChampionPoints || '—'}</strong></td>
              <td>
                {r.constructorChampionName ? (
                  <span className="wc-champion-cell">
                    <span className="trophy">🏭</span>
                    <span style={{ color: r.constructorChampionColor ?? undefined, fontWeight: 600 }}>
                      {r.constructorChampionName}
                    </span>
                  </span>
                ) : <span className="muted">—</span>}
              </td>
              <td className="num"><strong>{r.constructorChampionPoints || '—'}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
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

import { useState, useMemo } from 'react';
import { useGame } from '../../GameContext';
import { Driver, Team, EngineeringDirector, RaceDirector } from '../../sim/types';
import { driverOverall } from '../../sim/generators';
import { remainingPoints, carPointCost } from '../../sim/market';
import { TeamDetailPopup } from '../popups/TeamDetailPopup';
import { DriverDetailPopup } from '../popups/DriverDetailPopup';
import { EngDirectorDetailPopup } from '../popups/EngDirectorDetailPopup';
import { RaceDirectorDetailPopup } from '../popups/RaceDirectorDetailPopup';
import { Flag } from '../common/Flag';
import { RarityChip } from '../common/RarityChip';
import { OvrBadge } from '../common/OvrBadge';
import { TeamLogo } from '../common/TeamLogo';
import { SpecialtyChip } from '../common/SpecialtyChip';
import { allDriversMap } from '../common/helpers';

// Grid of team cards, sorted by current constructor-standings position.
// Each card shows the team logo + name, current WC position + season points
// (top-right), car ratings, market budget summary, and the roster (drivers
// + directors) with clickable names that open the relevant detail popup.
export function TeamsTab() {
  const { state } = useGame();
  const driverMap = useMemo(() => allDriversMap(state), [state]);
  const engMap = useMemo(
    () => new Map(state.engineeringDirectors.map(e => [e.id, e])),
    [state.engineeringDirectors]
  );
  const rdMap = useMemo(
    () => new Map(state.raceDirectors.map(r => [r.id, r])),
    [state.raceDirectors]
  );
  const [popupTeam, setPopupTeam] = useState<Team | null>(null);
  const [popupDriver, setPopupDriver] = useState<Driver | null>(null);
  const [popupEng, setPopupEng] = useState<EngineeringDirector | null>(null);
  const [popupRD, setPopupRD] = useState<RaceDirector | null>(null);

  // Build a position lookup from the current constructor standings so we
  // can display "P3" or "P11" on each card.
  const positionByTeam = useMemo(() => {
    const m = new Map<string, number>();
    state.teamStandings.forEach((s, i) => m.set(s.teamId, i + 1));
    return m;
  }, [state.teamStandings]);

  // Sort by constructor-standings position. Teams that haven't scored yet
  // tie at zero, in which case fall back to car average so the cards still
  // have a stable order from race 1.
  const sorted = useMemo(() => {
    return [...state.teams].sort((a, b) => {
      const posA = positionByTeam.get(a.id) ?? 99;
      const posB = positionByTeam.get(b.id) ?? 99;
      if (posA !== posB) return posA - posB;
      const aAvg = (a.car.maxSpeed + a.car.acceleration + a.car.turning + a.car.reliability) / 4;
      const bAvg = (b.car.maxSpeed + b.car.acceleration + b.car.turning + b.car.reliability) / 4;
      return bAvg - aAvg;
    });
  }, [state.teams, positionByTeam]);

  return (
    <div className="screen">
      <h2>Teams</h2>
      <div className="teams-grid">
        {sorted.map(t => {
          const d1 = t.driver1Id ? driverMap.get(t.driver1Id) : null;
          const d2 = t.driver2Id ? driverMap.get(t.driver2Id) : null;
          const td = t.testDriverId ? driverMap.get(t.testDriverId) : null;
          const eng = t.engDirectorId ? engMap.get(t.engDirectorId) : null;
          const rd = t.raceDirectorId ? rdMap.get(t.raceDirectorId) : null;
          const rem = remainingPoints(t, state.drivers, state.engineeringDirectors, state.raceDirectors);
          const carPts = carPointCost(t);
          const pos = positionByTeam.get(t.id) ?? 0;

          return (
            <div
              key={t.id}
              className="team-card"
              style={{ borderLeft: `4px solid ${t.color}` }}
            >
              {/* Card header: logo + name on the left, position + points on the right */}
              <div className="team-card-header">
                <div className="team-card-identity">
                  <TeamLogo team={t} size={48} />
                  <div>
                    <button
                      className="link-btn team-card-name"
                      style={{ color: t.color }}
                      onClick={() => setPopupTeam(t)}
                    >
                      {t.name}
                    </button>
                    <div className="team-card-subtitle">
                      {t.shortName} · {t.tier} tier
                    </div>
                  </div>
                </div>
                <div className="team-card-standing">
                  <TeamPositionBadge pos={pos} />
                  <div className="team-card-points">
                    <strong>{t.seasonPoints}</strong>
                    <span className="team-card-points-label">pts</span>
                  </div>
                </div>
              </div>

              {/* Car stats */}
              <div className="team-card-section team-card-car">
                <div className="team-card-section-label">
                  Car
                  <SpecialtyChip specialty={t.car.circuitSpecialty} />
                </div>
                <div className="car-stats">
                  <CarStat label="SPD" value={t.car.maxSpeed} />
                  <CarStat label="ACC" value={t.car.acceleration} />
                  <CarStat label="TRN" value={t.car.turning} />
                  <CarStat label="REL" value={t.car.reliability} />
                </div>
              </div>

              {/* Market budget summary */}
              <div className="team-card-budget">
                <span className="budget-item">
                  <span className="budget-label">Cap</span>
                  <strong>{t.marketPoints}</strong>
                </span>
                <span className="budget-item">
                  <span className="budget-label">Car</span>
                  <strong>{carPts}</strong>
                </span>
                <span className="budget-item">
                  <span className="budget-label">Unused</span>
                  <strong className={rem > 0 ? 'budget-unused' : ''}>{rem}</strong>
                </span>
              </div>

              {/* Roster */}
              <div className="team-card-section">
                <div className="team-card-section-label">Lineup</div>
                <RosterLine label="D1" d={d1} onClick={() => d1 && setPopupDriver(d1)} />
                <RosterLine label="D2" d={d2} onClick={() => d2 && setPopupDriver(d2)} />
                <RosterLine label="Test" d={td} onClick={() => td && setPopupDriver(td)} />
              </div>

              {/* Directors */}
              <div className="team-card-section">
                <div className="team-card-section-label">Direction</div>
                <div className="director-line">
                  <span className="director-label">Eng</span>
                  {eng ? (
                    <>
                      <button className="link-btn" onClick={() => setPopupEng(eng)}>{eng.name}</button>{' '}
                      <RarityChip rarity={eng.rarity} />
                    </>
                  ) : <span className="muted">—</span>}
                </div>
                <div className="director-line">
                  <span className="director-label">Race</span>
                  {rd ? (
                    <>
                      <button className="link-btn" onClick={() => setPopupRD(rd)}>{rd.name}</button>{' '}
                      <RarityChip rarity={rd.rarity} />
                    </>
                  ) : <span className="muted">—</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {popupTeam && <TeamDetailPopup team={popupTeam} onClose={() => setPopupTeam(null)} />}
      {popupDriver && <DriverDetailPopup driver={popupDriver} onClose={() => setPopupDriver(null)} />}
      {popupEng && <EngDirectorDetailPopup director={popupEng} onClose={() => setPopupEng(null)} />}
      {popupRD && <RaceDirectorDetailPopup director={popupRD} onClose={() => setPopupRD(null)} />}
    </div>
  );
}

// Compact single-stat readout for car ratings (SPD/ACC/TRN/REL).
function CarStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="car-stat">
      <div className="car-stat-label">{label}</div>
      <div className="car-stat-value">{value}</div>
    </div>
  );
}

// Position badge — large display for top-right of the team card.
// Top 3 get gold/silver/bronze treatment, rest are neutral.
function TeamPositionBadge({ pos }: { pos: number }) {
  if (pos === 0) {
    return <span className="team-pos-badge team-pos-tbd">—</span>;
  }
  let cls = 'team-pos-badge';
  if (pos === 1) cls += ' team-pos-1';
  else if (pos === 2) cls += ' team-pos-2';
  else if (pos === 3) cls += ' team-pos-3';
  return (
    <span className={cls}>
      <span className="team-pos-prefix">P</span>{pos}
    </span>
  );
}

// One roster line in a team card: flag, name, rarity chip, OVR badge.
// Status badges (injury / final season) appear after the OVR badge.
function RosterLine({ label, d, onClick }: {
  label: string;
  d: Driver | null | undefined;
  onClick?: () => void;
}) {
  if (!d) return (
    <div className="driver-line driver-line-empty">
      <span className="driver-label">{label}</span>
      <span className="muted">—</span>
    </div>
  );
  const ovr = driverOverall(d);
  return (
    <div className="driver-line">
      <span className="driver-label">{label}</span>
      <Flag code={d.countryCode} title={d.country} />{' '}
      <button className="link-btn driver-line-name" onClick={onClick}>{d.name}</button>{' '}
      <RarityChip rarity={d.rarity} />{' '}
      <OvrBadge value={ovr} />
      {d.injuredRaces > 0 && <span className="status-badge status-injury">🚑 {d.injuredRaces}</span>}
      {d.retirementAnnounced && <span className="status-badge status-retiring">⏳</span>}
    </div>
  );
}

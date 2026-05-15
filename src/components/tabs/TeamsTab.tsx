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
import { allDriversMap } from '../common/helpers';

// Grid of team cards, sorted by current car average descending.
// Click any name to open the relevant detail popup.
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

  const sorted = [...state.teams].sort((a, b) => {
    const aAvg = (a.car.maxSpeed + a.car.acceleration + a.car.turning + a.car.reliability) / 4;
    const bAvg = (b.car.maxSpeed + b.car.acceleration + b.car.turning + b.car.reliability) / 4;
    return bAvg - aAvg;
  });

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

          return (
            <div key={t.id} className="team-card" style={{ borderLeft: `4px solid ${t.color}` }}>
              <h3>
                <button className="link-btn" style={{ color: t.color }} onClick={() => setPopupTeam(t)}>
                  {t.name}
                </button>
                <small>  ({t.shortName})</small>
              </h3>
              <div className="row">
                <span>Tier: {t.tier}</span>
                <span>Cap: {t.marketPoints}</span>
                <span>Car: {carPts}pts</span>
                <span>Unused: {rem}</span>
              </div>
              <div className="row">
                <span>Speed: {t.car.maxSpeed}</span>
                <span>Accel: {t.car.acceleration}</span>
                <span>Turn: {t.car.turning}</span>
                <span>Reliab: {t.car.reliability}</span>
              </div>
              <div className="roster">
                <RosterLine label="D1" d={d1} onClick={() => d1 && setPopupDriver(d1)} />
                <RosterLine label="D2" d={d2} onClick={() => d2 && setPopupDriver(d2)} />
                <RosterLine label="Test" d={td} onClick={() => td && setPopupDriver(td)} />
                <div className="director-line">
                  Eng Dir: {eng ? (
                    <>
                      <button className="link-btn" onClick={() => setPopupEng(eng)}>{eng.name}</button>{' '}
                      <RarityChip rarity={eng.rarity} />
                    </>
                  ) : '—'}
                </div>
                <div className="director-line">
                  Race Dir: {rd ? (
                    <>
                      <button className="link-btn" onClick={() => setPopupRD(rd)}>{rd.name}</button>{' '}
                      <RarityChip rarity={rd.rarity} />
                    </>
                  ) : '—'}
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

// One driver line in a team card: flag, name, rarity, OVR badge.
function RosterLine({ label, d, onClick }: {
  label: string;
  d: Driver | null | undefined;
  onClick?: () => void;
}) {
  if (!d) return <div className="driver-line">{label}: —</div>;
  const ovr = driverOverall(d);
  return (
    <div className="driver-line">
      <strong>{label}:</strong> <Flag code={d.countryCode} title={d.country} />{' '}
      <button className="link-btn" onClick={onClick}>{d.name}</button>{' '}
      <RarityChip rarity={d.rarity} />{' '}
      <OvrBadge value={ovr} />
      {d.injuredRaces > 0 && <span className="injury"> 🚑 out {d.injuredRaces}</span>}
      {d.retirementAnnounced && <span className="retiring"> ⏳ final season</span>}
    </div>
  );
}

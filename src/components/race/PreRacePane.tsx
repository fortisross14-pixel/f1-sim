import { GrandPrix } from '../../sim/types';

// Pre-race info screen: circuit, weather, "Run Qualifying" CTA.
export function PreRacePane({ gp, onRunQ }: { gp: GrandPrix; onRunQ: () => void }) {
  return (
    <>
      <h2>Round {gp.round} — {gp.circuit.name} ({gp.circuit.country})</h2>
      <div className="info-box">
        <p>Circuit profile: <strong>{gp.circuit.profile}</strong></p>
        <p>Weather: <strong>{gp.weather}</strong></p>
        <p>Laps: <strong>{gp.circuit.laps}</strong></p>
        {gp.weather === 'hot' && <p>🔥 Extreme heat — drivers with high physical/cardio favored.</p>}
        {gp.weather === 'rain' && <p>🌧️ Rain — high driving skill &amp; wet specialists favored.</p>}
      </div>
      <div className="actions">
        <button className="primary big" onClick={onRunQ}>Run Qualifying →</button>
      </div>
    </>
  );
}

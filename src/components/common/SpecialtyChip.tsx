import { CarSpecialty } from '../../sim/types';

// Small chip showing a car's circuit specialty. Used on team cards, the team
// detail popup, and the pre-race screen so the player can see at a glance
// whether the team's car is suited to the upcoming circuit.
//
// Visual: matches the .mini-chip / profile-* palette used in the calendar
// table so a "linear" specialty chip and a "linear" profile chip look the
// same.
export function SpecialtyChip({ specialty }: { specialty: CarSpecialty }) {
  if (specialty === 'all_rounder') {
    return (
      <span className="mini-chip specialty-all-rounder" title="Small bonus on every circuit">
        ★ all-rounder
      </span>
    );
  }
  return (
    <span
      className={`mini-chip profile-${specialty}`}
      title={`Bonus on ${specialty} circuits`}
    >
      ★ {specialty}
    </span>
  );
}

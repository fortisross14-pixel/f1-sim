// Made-up names so we don't accidentally use real F1 people.
// First and last name pools shuffled together at generation time.

export const FIRST_NAMES = [
  'Alex', 'Marco', 'Luca', 'Diego', 'Mateo', 'Noah', 'Liam', 'Hugo', 'Theo', 'Felix',
  'Oscar', 'Niko', 'Kai', 'Jonas', 'Pierre', 'Anton', 'Viktor', 'Mikael', 'Sven', 'Erik',
  'Dario', 'Stefano', 'Enzo', 'Rafa', 'Pablo', 'Carlos', 'Andre', 'Bruno', 'Joao', 'Leo',
  'Yuki', 'Hiro', 'Kenji', 'Ren', 'Adrian', 'Damian', 'Kris', 'Tomas', 'Petr', 'Janos',
  'Finn', 'Ronan', 'Cillian', 'Eoin', 'Magnus', 'Soren', 'Henrik', 'Tariq', 'Omar', 'Idris',
];

export const LAST_NAMES = [
  'Rossi', 'Marino', 'Conti', 'Greco', 'Ferri', 'Bruno', 'Costa', 'Silva', 'Reyes', 'Vega',
  'Moreau', 'Laurent', 'Dubois', 'Garnier', 'Roux', 'Beck', 'Vogt', 'Schneider', 'Krause', 'Hoffmann',
  'Lindgren', 'Berg', 'Holm', 'Sundberg', 'Eklund', 'Novak', 'Horak', 'Kovac', 'Kovacs', 'Nagy',
  'Petrov', 'Volkov', 'Sokolov', 'Yamamoto', 'Sato', 'Tanaka', 'Suzuki', 'Park', 'Kim', 'Cho',
  'Walsh', 'Doyle', 'Murphy', 'Byrne', 'Eriksson', 'Hansen', 'Nilsen', 'Hassan', 'Khalil', 'Aziz',
];

export const TEAM_DATA: Array<{
  name: string;
  shortName: string;
  color: string;
  tier: 'top' | 'mid' | 'bottom';
  legacyBaseValue: number;
}> = [
  // Top tier (legacy 85) — mirroring Ferrari/McLaren/Red Bull
  { name: 'Scuderia Rosso', shortName: 'ROS', color: '#DC0000', tier: 'top', legacyBaseValue: 85 },
  { name: 'Papaya Racing',  shortName: 'PAP', color: '#FF8700', tier: 'top', legacyBaseValue: 85 },
  { name: 'Velocity Bulls', shortName: 'VBR', color: '#1E3A8A', tier: 'top', legacyBaseValue: 85 },
  // Mid tier (legacy 75)
  { name: 'Silver Arrows',  shortName: 'SIL', color: '#00D2BE', tier: 'mid', legacyBaseValue: 75 },
  { name: 'Aston Verde',    shortName: 'AVD', color: '#006F62', tier: 'mid', legacyBaseValue: 75 },
  { name: 'Alpina Bleu',    shortName: 'ALB', color: '#0090FF', tier: 'mid', legacyBaseValue: 75 },
  { name: 'Atlas Motors',   shortName: 'ATL', color: '#900020', tier: 'mid', legacyBaseValue: 75 },
  { name: 'Nordic GP',      shortName: 'NOR', color: '#2B6CB0', tier: 'mid', legacyBaseValue: 75 },
  // Bottom tier (legacy 65)
  { name: 'Solaris F1',     shortName: 'SOL', color: '#F59E0B', tier: 'bottom', legacyBaseValue: 65 },
  { name: 'Iberica Racing', shortName: 'IBE', color: '#7C2D12', tier: 'bottom', legacyBaseValue: 65 },
  { name: 'Phoenix Works',  shortName: 'PHX', color: '#7C3AED', tier: 'bottom', legacyBaseValue: 65 },
  { name: 'Vanguard F1',    shortName: 'VAN', color: '#374151', tier: 'bottom', legacyBaseValue: 65 },
];

export const CALENDAR_CIRCUITS: Array<{
  name: string;
  country: string;
  profile: 'linear' | 'mixed' | 'technical' | 'balanced';
}> = [
  { name: 'Sakhir',       country: 'Bahrain',      profile: 'mixed' },
  { name: 'Jeddah',       country: 'Saudi Arabia', profile: 'linear' },
  { name: 'Albert Park',  country: 'Australia',    profile: 'balanced' },
  { name: 'Imola',        country: 'Italy',        profile: 'technical' },
  { name: 'Miami Bay',    country: 'USA',          profile: 'mixed' },
  { name: 'Monte Verde',  country: 'Monaco',       profile: 'technical' },
  { name: 'Catalunya',    country: 'Spain',        profile: 'balanced' },
  { name: 'Montreal',     country: 'Canada',       profile: 'mixed' },
  { name: 'Spielberg',    country: 'Austria',      profile: 'linear' },
  { name: 'Silverwood',   country: 'UK',           profile: 'linear' },
  { name: 'Hungaroring',  country: 'Hungary',      profile: 'technical' },
  { name: 'Spa-Francorchamps', country: 'Belgium', profile: 'linear' },
  { name: 'Zandvoort',    country: 'Netherlands',  profile: 'technical' },
  { name: 'Monza',        country: 'Italy',        profile: 'linear' },
  { name: 'Marina Bay',   country: 'Singapore',    profile: 'technical' },
  { name: 'Suzuka',       country: 'Japan',        profile: 'balanced' },
  { name: 'Lusail',       country: 'Qatar',        profile: 'mixed' },
  { name: 'Austin',       country: 'USA',          profile: 'balanced' },
  { name: 'Hermanos R.',  country: 'Mexico',       profile: 'mixed' },
  { name: 'Interlagos',   country: 'Brazil',       profile: 'mixed' },
  { name: 'Las Vegas',    country: 'USA',          profile: 'linear' },
  { name: 'Yas Marina',   country: 'Abu Dhabi',    profile: 'balanced' },
];

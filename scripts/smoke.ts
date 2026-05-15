// Smoke test: run a full season and print summary stats to verify mechanics.
// Run with: npx tsx scripts/smoke.ts
import { createNewSeason, applyRaceResult, applyQualiResult, decrementInjuries, advanceToNewSeason, recalcStandings } from '../src/sim/season';
import { simulateQualifying, simulateRace } from '../src/sim/race';
import { RNG } from '../src/sim/rng';

const SEED = 12345;
const rng = new RNG(SEED);
const state = createNewSeason(SEED);

console.log('=== INITIAL STATE ===');
console.log('Drivers:', state.drivers.length);
console.log('Teams:', state.teams.length);
console.log('Calendar rounds:', state.calendar.length);

const rarityCounts: Record<string, number> = { legend: 0, epic: 0, rare: 0, uncommon: 0, common: 0 };
state.drivers.forEach(d => rarityCounts[d.rarity]++);
console.log('Driver rarity distribution:', rarityCounts);

const driverMap = new Map(state.drivers.map(d => [d.id, d]));
const teamMap = new Map(state.teams.map(t => [t.id, t]));

console.log('\n=== TEAMS ===');
state.teams.forEach(t => {
  const c = t.car;
  const avg = ((c.maxSpeed + c.acceleration + c.turning + c.reliability) / 4).toFixed(1);
  const d1 = t.driver1Id ? driverMap.get(t.driver1Id) : null;
  const d2 = t.driver2Id ? driverMap.get(t.driver2Id) : null;
  const engDir = t.engDirectorId ? state.engineeringDirectors.find(e => e.id === t.engDirectorId) : null;
  const raceDir = t.raceDirectorId ? state.raceDirectors.find(r => r.id === t.raceDirectorId) : null;
  console.log(`  ${t.shortName} ${t.name}: car avg=${avg} | drivers: ${d1?.name}(${d1?.rarity}) + ${d2?.name}(${d2?.rarity})`);
  console.log(`    Eng Dir: ${engDir ? `${engDir.name} (${engDir.rarity}) targets S${engDir.speedTarget}/A${engDir.accelTarget}/T${engDir.turningTarget}/R${engDir.reliabilityTarget} pull=${engDir.pullFactor}` : '(none)'}`);
  console.log(`    Race Dir: ${raceDir ? `${raceDir.name} (${raceDir.rarity}) ${raceDir.timeImprovementPct}% time / +${raceDir.reliabilityBonus} rel` : '(none)'}`);
});

console.log('\n=== SIMULATING SEASON ===');
let winsByDriver = new Map<string, number>();
let dnfTotal = 0;

for (let round = 0; round < state.calendar.length; round++) {
  const gp = state.calendar[round];
  decrementInjuries(state);
  const q = simulateQualifying(gp, state.teams, state.drivers, state.engineeringDirectors, state.raceDirectors, rng);
  applyQualiResult(state, q.poleDriverId);
  const r = simulateRace(gp, q, state.teams, state.drivers, state.engineeringDirectors, state.raceDirectors, rng);
  applyRaceResult(state, r);
  const winner = driverMap.get(r.finalRanking[0])!;
  winsByDriver.set(winner.id, (winsByDriver.get(winner.id) || 0) + 1);
  dnfTotal += r.dnfs.length;
  state.currentRound++;
}

console.log(`Avg DNFs/race: ${(dnfTotal / state.calendar.length).toFixed(1)}`);

recalcStandings(state);
console.log('\n=== TOP 10 DRIVERS ===');
state.driverStandings.slice(0, 10).forEach((s, i) => {
  const d = driverMap.get(s.driverId)!;
  console.log(`  ${i+1}. ${d.name} (${d.rarity}, ${d.archetype}) - ${s.points} pts, ${d.seasonWins} wins`);
});

console.log('\n=== CONSTRUCTOR STANDINGS ===');
state.teamStandings.forEach((s, i) => {
  const t = teamMap.get(s.teamId)!;
  console.log(`  ${i+1}. ${t.name} - ${s.points} pts`);
});

console.log('\n=== WINS DIVERSITY ===');
console.log(`Distinct winners: ${winsByDriver.size} / 22 races`);
const winList = [...winsByDriver.entries()].sort((a,b) => b[1]-a[1]);
winList.forEach(([id, n]) => {
  const d = driverMap.get(id)!;
  console.log(`  ${d.name} (${d.rarity}): ${n}`);
});

// Title race check: are top 3 close at end?
const top3Gap = state.driverStandings[0].points - state.driverStandings[2].points;
console.log(`\nGap between 1st and 3rd: ${top3Gap} points`);

// Advance season
console.log('\n=== ADVANCING TO YEAR 2 ===');
const result = advanceToNewSeason(state, rng);
console.log(`Retirements: ${result.retirements.length}`);
console.log(`Rookie arrivals: ${result.rookieArrivals.length}`);
console.log(`Releases (fired): ${result.releases.length}`);
console.log(`Signings: ${result.signings.length}`);
console.log(`Car evolution rows: ${result.carEvolution.length}`);

// Sample
console.log('\nSample retirements:');
result.retirements.slice(0, 5).forEach(m => {
  console.log(`  ${m.kind}: ${m.name} (${m.rarity})`);
});
console.log('\nSample signings:');
result.signings.slice(0, 5).forEach(m => {
  console.log(`  signed: ${m.name} (${m.rarity}) -> ${m.toTeam} as ${m.position}`);
});

console.log('\nYear 2 driver pool:');
const rarityY2: Record<string, number> = { legend: 0, epic: 0, rare: 0, uncommon: 0, common: 0 };
state.drivers.forEach(d => rarityY2[d.rarity]++);
console.log(rarityY2);

console.log('\n=== DONE ===');

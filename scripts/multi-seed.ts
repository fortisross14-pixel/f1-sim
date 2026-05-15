// Multi-seed smoke test: runs many seasons and aggregates statistics.
// This reveals balance issues that a single seed can hide.
import { createNewSeason, applyRaceResult, applyQualiResult, decrementInjuries, recalcStandings } from '../src/sim/season';
import { simulateQualifying, simulateRace } from '../src/sim/race';
import { RNG } from '../src/sim/rng';

const SEEDS = [42, 12345, 99, 777, 2024, 555, 8675309, 11111, 314, 271828, 161803, 999, 1234, 5678, 8888];

interface SeasonStats {
  seed: number;
  champion: string;
  champRarity: string;
  champWins: number;
  champPoints: number;
  runnerUpPoints: number;
  thirdPoints: number;
  distinctWinners: number;
  topConstructor: string;
  topConstructorTier: string;
  avgDnfsPerRace: number;
  winsByTier: Record<string, number>;
}

const allStats: SeasonStats[] = [];

for (const seed of SEEDS) {
  const rng = new RNG(seed);
  const state = createNewSeason(seed);
  const driverMap = new Map(state.drivers.map(d => [d.id, d]));
  const teamMap = new Map(state.teams.map(t => [t.id, t]));

  const winsByDriver = new Map<string, number>();
  const winsByTier: Record<string, number> = { top: 0, mid: 0, bottom: 0 };
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
    // Find winner's team
    const winningTeam = state.teams.find(t => t.driver1Id === winner.id || t.driver2Id === winner.id || t.testDriverId === winner.id);
    if (winningTeam) winsByTier[winningTeam.tier]++;
    dnfTotal += r.dnfs.length;
    state.currentRound++;
  }

  recalcStandings(state);
  const champId = state.driverStandings[0].driverId;
  const champ = driverMap.get(champId)!;
  const topConstructor = teamMap.get(state.teamStandings[0].teamId)!;

  allStats.push({
    seed,
    champion: champ.name,
    champRarity: champ.rarity,
    champWins: champ.seasonWins,
    champPoints: state.driverStandings[0].points,
    runnerUpPoints: state.driverStandings[1].points,
    thirdPoints: state.driverStandings[2].points,
    distinctWinners: winsByDriver.size,
    topConstructor: topConstructor.name,
    topConstructorTier: topConstructor.tier,
    avgDnfsPerRace: dnfTotal / state.calendar.length,
    winsByTier,
  });
}

console.log('=== MULTI-SEED RESULTS ===\n');
console.log('Seed     | Champion (rarity) wins/pts | 2nd pts | 3rd pts | distinct winners | top constr (tier) | DNFs');
console.log('---------|--------------------------|---------|---------|------------------|--------------------|------');
for (const s of allStats) {
  console.log(
    `${s.seed.toString().padEnd(8)} | ${(s.champion + ' (' + s.champRarity + ')').padEnd(28)} ${s.champWins}/${s.champPoints} | ${s.runnerUpPoints}  | ${s.thirdPoints}  | ${s.distinctWinners}/22  | ${s.topConstructor} (${s.topConstructorTier})  | ${s.avgDnfsPerRace.toFixed(1)}`
  );
}

console.log('\n=== AGGREGATE STATS ===');
const avgWins = allStats.reduce((a, b) => a + b.champWins, 0) / allStats.length;
const avgDistinct = allStats.reduce((a, b) => a + b.distinctWinners, 0) / allStats.length;
const avgGap = allStats.reduce((a, b) => a + (b.champPoints - b.thirdPoints), 0) / allStats.length;
console.log(`Avg champion wins: ${avgWins.toFixed(1)} (target: 6-9)`);
console.log(`Avg distinct winners: ${avgDistinct.toFixed(1)} (target: 5-8)`);
console.log(`Avg gap 1st-3rd: ${avgGap.toFixed(0)} pts (target: < 60)`);

const champRarities = allStats.map(s => s.champRarity);
console.log(`Champion rarities: ${champRarities.join(', ')}`);
const topConstructorTiers = allStats.map(s => s.topConstructorTier);
console.log(`Top constructor tiers: ${topConstructorTiers.join(', ')}`);

const totalTopWins = allStats.reduce((a, b) => a + b.winsByTier.top, 0);
const totalMidWins = allStats.reduce((a, b) => a + b.winsByTier.mid, 0);
const totalBotWins = allStats.reduce((a, b) => a + b.winsByTier.bottom, 0);
const totalRaces = SEEDS.length * 22;
console.log(`\nWins by team tier (across ${SEEDS.length} seasons, ${totalRaces} races):`);
console.log(`  Top tier: ${totalTopWins} (${(totalTopWins/totalRaces*100).toFixed(0)}%)`);
console.log(`  Mid tier: ${totalMidWins} (${(totalMidWins/totalRaces*100).toFixed(0)}%)`);
console.log(`  Bottom tier: ${totalBotWins} (${(totalBotWins/totalRaces*100).toFixed(0)}%)`);

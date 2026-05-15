import { createNewSeason } from '../src/sim/season';
import { rollCarStats, carStatsWithDirector } from '../src/sim/generators';
import { RNG } from '../src/sim/rng';

console.log('=== ENGINEERING DIRECTOR IMPACT EXAMPLES ===\n');

const rng = new RNG(42);

// Brawn case: bottom team (legacy 65) with legend eng director
const badCar = { maxSpeed: 65, acceleration: 64, turning: 66, reliability: 63 };
const legendEng = {
  id: 'test',
  name: 'Legend Director',
  rarity: 'legend' as const,
  speedTarget: 90,
  accelTarget: 88,
  turningTarget: 87,
  reliabilityTarget: 88,
  pullFactor: 0.55,
  age: 50,
  yearsRemaining: 10,
};
const epicEng = { ...legendEng, name: 'Epic Director', rarity: 'epic' as const,
  speedTarget: 84, accelTarget: 82, turningTarget: 82, reliabilityTarget: 82, pullFactor: 0.45 };
const commonEng = { ...legendEng, name: 'Common Director', rarity: 'common' as const,
  speedTarget: 66, accelTarget: 64, turningTarget: 64, reliabilityTarget: 64, pullFactor: 0.20 };

const goodCar = { maxSpeed: 86, acceleration: 87, turning: 84, reliability: 85 };
const midCar = { maxSpeed: 75, acceleration: 76, turning: 74, reliability: 75 };

const avg = (c: any) => ((c.maxSpeed + c.acceleration + c.turning + c.reliability) / 4).toFixed(1);

console.log('Base bad car:', badCar, '| avg:', avg(badCar));
console.log('  + Legend eng:', carStatsWithDirector(badCar, legendEng), '| avg:', avg(carStatsWithDirector(badCar, legendEng)));
console.log('  + Epic eng:  ', carStatsWithDirector(badCar, epicEng), '| avg:', avg(carStatsWithDirector(badCar, epicEng)));
console.log('  + Common eng:', carStatsWithDirector(badCar, commonEng), '| avg:', avg(carStatsWithDirector(badCar, commonEng)));

console.log('\nBase mid car:', midCar, '| avg:', avg(midCar));
console.log('  + Legend eng:', carStatsWithDirector(midCar, legendEng), '| avg:', avg(carStatsWithDirector(midCar, legendEng)));
console.log('  + Epic eng:  ', carStatsWithDirector(midCar, epicEng), '| avg:', avg(carStatsWithDirector(midCar, epicEng)));

console.log('\nBase good car:', goodCar, '| avg:', avg(goodCar));
console.log('  + Legend eng:', carStatsWithDirector(goodCar, legendEng), '| avg:', avg(carStatsWithDirector(goodCar, legendEng)));
console.log('  + Epic eng:  ', carStatsWithDirector(goodCar, epicEng), '| avg:', avg(carStatsWithDirector(goodCar, epicEng)));

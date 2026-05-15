import { Rarity } from '../../sim/types';

// Gradient-filled rarity pill: legend gold, epic purple, rare blue,
// uncommon green, common neutral.
export function RarityChip({ rarity }: { rarity: Rarity }) {
  return <span className={`rarity rarity-${rarity}`}>{rarity}</span>;
}

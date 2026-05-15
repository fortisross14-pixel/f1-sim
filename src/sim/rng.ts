// Deterministic-when-seeded RNG so we can replay/debug races later if needed.
// Mulberry32 - fast, good enough for game logic.

export class RNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] inclusive
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  // Box-Muller normal distribution
  normal(mean: number, stdDev: number): number {
    const u1 = Math.max(this.next(), 1e-9);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Weighted pick: items with weights, returns one item.
  pickWeighted<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  // Returns true with given probability (0-1)
  chance(p: number): boolean {
    return this.next() < p;
  }

  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// Clamp a number into a range
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Used everywhere — generate a short unique-ish id
let idCounter = 0;
export function makeId(prefix: string): string {
  idCounter++;
  return `${prefix}_${idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

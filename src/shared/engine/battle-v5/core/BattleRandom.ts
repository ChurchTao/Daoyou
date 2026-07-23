export interface BattleRandomSource {
  next(): number;
}

const defaultSource: BattleRandomSource = { next: () => Math.random() };
const sourceStack: BattleRandomSource[] = [];

export function battleRandom(): number {
  return (sourceStack[sourceStack.length - 1] ?? defaultSource).next();
}

export function withBattleRandomSource<T>(
  source: BattleRandomSource | undefined,
  run: () => T,
): T {
  if (!source) return run();
  sourceStack.push(source);
  try {
    return run();
  } finally {
    sourceStack.pop();
  }
}

export class SeededBattleRandomSource implements BattleRandomSource {
  private state: number;

  constructor(seed: number | string) {
    this.state =
      typeof seed === 'number' ? seed >>> 0 : SeededBattleRandomSource.hash(seed);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  private static hash(value: string): number {
    let hash = 2166136261;
    for (const character of value) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}

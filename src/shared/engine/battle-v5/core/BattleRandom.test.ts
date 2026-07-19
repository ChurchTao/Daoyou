import { describe, expect, it } from 'vitest';
import { SeededBattleRandomSource } from './BattleRandom';

describe('SeededBattleRandomSource', () => {
  it('produces a stable sequence for an attempt seed', () => {
    const left = new SeededBattleRandomSource('task-record:attempt');
    const right = new SeededBattleRandomSource('task-record:attempt');
    expect(Array.from({ length: 16 }, () => left.next())).toEqual(
      Array.from({ length: 16 }, () => right.next()),
    );
  });

  it('separates different attempt seeds', () => {
    const left = new SeededBattleRandomSource('attempt-a');
    const right = new SeededBattleRandomSource('attempt-b');
    expect(Array.from({ length: 4 }, () => left.next())).not.toEqual(
      Array.from({ length: 4 }, () => right.next()),
    );
  });
});

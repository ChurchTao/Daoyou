import type { BattleRandomSource } from '../core/BattleRandom';
import { AttributeType } from '../core/types';
import type { Unit } from '../units/Unit';

export class InitiativeSystem {
  static order(
    units: readonly Unit[],
    random: BattleRandomSource,
  ): Unit[] {
    const ordered = units
      .filter((unit) => unit.isAlive())
      .map((unit, index) => ({
        unit,
        index,
        speed: unit.attributes.getValue(AttributeType.ACTION_SPEED),
      }))
      .sort(
      (left, right) =>
        right.speed - left.speed ||
        left.index - right.index,
      );

    let start = 0;
    while (start < ordered.length) {
      let end = start + 1;
      while (end < ordered.length && ordered[end].speed === ordered[start].speed) {
        end += 1;
      }
      for (let index = end - 1; index > start; index--) {
        const swapIndex = start + Math.floor(random.next() * (index - start + 1));
        [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
      }
      start = end;
    }
    return ordered.map((entry) => entry.unit);
  }
}

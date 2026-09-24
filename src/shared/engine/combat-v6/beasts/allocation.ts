import { SeededRng } from '../core/rng';
import type { SummonedBeast } from './schema';

/** 平均分配后在每对属性间转移点数，各项不超出平均值的配置幅度。 */
export function distributeBeastPoints(
  total: number,
  seed: number,
  spread: number,
): SummonedBeast['allocatedAttributes'] {
  const average = total / 5;
  const points = Array.from(
    { length: 5 },
    (_, i) => Math.floor(average) + (i < total % 5 ? 1 : 0),
  );
  const lower = Math.floor(average * (1 - spread));
  const upper = Math.ceil(average * (1 + spread));
  const rng = new SeededRng(seed);
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const min = -Math.min(points[i] - lower, upper - points[j]);
      const max = Math.min(upper - points[i], points[j] - lower);
      const shift = min + Math.floor(rng.next() * (max - min + 1));
      points[i] += shift;
      points[j] -= shift;
    }
  }
  return {
    constitution: points[0],
    strength: points[1],
    magic: points[2],
    endurance: points[3],
    agility: points[4],
  };
}

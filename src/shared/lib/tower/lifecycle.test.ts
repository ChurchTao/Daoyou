import { expect, it } from 'vitest';
import {
  shouldExpireTowerRun,
  towerRunOccupancy,
  type TowerLifecycleState,
} from './lifecycle';

const end = Date.parse('2026-09-20T16:00:00Z');
const base: TowerLifecycleState = {
  status: 'READY',
  season: { seasonEndsAt: new Date(end).toISOString() },
};
it('周一零点立即结束旧周空闲和未终局战斗，并解除占用', () => {
  for (const phase of [undefined, 'command', 'resolve']) {
    const run = phase
      ? {
          ...base,
          status: 'WAITING_BATTLE',
          battleId: 'battle',
          battle: { settled: false, snapshot: { state: { phase } } },
        }
      : base;
    expect(shouldExpireTowerRun(run, end - 1)).toBe(false);
    expect(towerRunOccupancy(run, end - 1)).toBe(phase ? 'battle' : 'run');
    expect(shouldExpireTowerRun(run, end)).toBe(true);
    expect(towerRunOccupancy(run, end)).toBe('none');
  }
});
it('旧周终局待结算继续占用，提交成功后不阻塞新周', () => {
  const run = {
    ...base,
    battleId: 'battle',
    battle: { settled: false, snapshot: { state: { phase: 'ended' } } },
  };
  expect(shouldExpireTowerRun(run, end)).toBe(false);
  expect(towerRunOccupancy(run, end)).toBe('battle');
  run.battle.settled = true;
  expect(shouldExpireTowerRun(run, end)).toBe(true);
  expect(towerRunOccupancy(run, end)).toBe('none');
  expect(towerRunOccupancy({ ...base, status: 'FINISHED' }, end - 1)).toBe(
    'none',
  );
});

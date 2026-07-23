import { describe, expect, it } from 'vitest';
import { CombatResourceContainer } from '../../units/CombatResourceContainer';

function resource(): CombatResourceContainer {
  const container = new CombatResourceContainer();
  container.define({
    id: 'test.momentum',
    name: '剑势',
    initial: 4,
    max: 6,
    decayOnNoDirectDamage: 1,
    decayOnControlledSkip: 1,
    noDirectDamageActionsPerDecay: 2,
  });
  return container;
}

function pausedResource(): CombatResourceContainer {
  const container = new CombatResourceContainer();
  container.define({
    id: 'test.momentum',
    name: '剑势',
    initial: 4,
    max: 6,
    decayOnNoDirectDamage: 1,
    decayOnControlledSkip: 1,
    noDirectDamageActionsPerDecay: 2,
    pauseDecayWhileShielded: true,
  });
  return container;
}

describe('CombatResourceContainer连续无直接伤害衰减', () => {
  it('每连续2次无直接伤害行动衰减一次，直接伤害重置计数', () => {
    const container = resource();
    container.beginAction();
    container.finishAction();
    expect(container.getCurrent('test.momentum')).toBe(4);

    container.beginAction();
    container.markDirectDamageDealt();
    container.finishAction();
    expect(container.getCurrent('test.momentum')).toBe(4);

    container.beginAction();
    container.finishAction();
    expect(container.getCurrent('test.momentum')).toBe(4);
    container.beginAction();
    container.finishAction();
    expect(container.getCurrent('test.momentum')).toBe(3);
  });

  it('受控跳过无视连续行动阈值立即衰减', () => {
    const container = resource();
    container.beginAction();
    container.finishAction(true);
    expect(container.getCurrent('test.momentum')).toBe(3);
  });

  it('暂停衰减时保留既有连续计数，恢复后继续累计', () => {
    const container = pausedResource();
    container.beginAction();
    container.finishAction();
    container.beginAction();
    container.finishAction(false, true);
    expect(container.getCurrent('test.momentum')).toBe(4);

    container.beginAction();
    container.finishAction();
    expect(container.getCurrent('test.momentum')).toBe(3);
  });

  it('受控跳过触发衰减后清空既有连续计数', () => {
    const container = resource();
    container.beginAction();
    container.finishAction();
    container.beginAction();
    container.finishAction(true);
    expect(container.getCurrent('test.momentum')).toBe(3);

    container.beginAction();
    container.finishAction();
    expect(container.getCurrent('test.momentum')).toBe(3);
  });

  it('克隆时保留连续计数', () => {
    const container = resource();
    container.beginAction();
    container.finishAction();
    const clone = container.clone();

    clone.beginAction();
    clone.finishAction();
    expect(clone.getCurrent('test.momentum')).toBe(3);
    expect(container.getCurrent('test.momentum')).toBe(4);
  });
});

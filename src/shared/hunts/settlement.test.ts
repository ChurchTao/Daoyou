import { describe, expect, it } from 'vitest';
import { createBattle } from '../engine/combat-v6/core';
import { projectCharacterToCombatV6 } from '../engine/combat-v6/projection';
import { daoyouRulesetV6 } from '../engine/combat-v6/rules-daoyou';
import { towerReferenceBuild } from '../engine/combat-v6/tower/reference-fixtures';
import { huntParticipantSucceeded, settleHuntResources } from './settlement';

function fixture() {
  const battle = createBattle({
    seed: 1,
    ruleset: daoyouRulesetV6,
    units: [
      {
        id: 'p',
        name: '道友',
        kind: 'player',
        side: 0,
        attrs: { hp: 350, maxHp: 1000, mp: 75, maxMp: 500 },
      },
      {
        id: 'boss',
        name: '妖兽',
        kind: 'npc',
        side: 1,
        attrs: { hp: 100, maxHp: 100 },
      },
    ],
  });
  const state = battle.snapshot();
  state.result = { winner: 0, reason: 'wipe' };
  return {
    state,
    unit: state.units[0],
    entry: { hp: 350, maxHp: 1000, mp: 75, maxMp: 500 },
  };
}
describe('讨伐个人成败与持久资源', () => {
  it('角色投影保留当前气血法力，满状态策略仍只对隔离战斗生效', () => {
    const player = towerReferenceBuild('lingxiao');
    player.cultivator.condition!.resources = {
      hp: { current: 350 },
      mp: { current: 75 },
    };
    const project = (resourcePolicy: 'persistent' | 'full') => {
      const result = projectCharacterToCombatV6({
        ...player,
        side: 0,
        slot: 0,
        resourcePolicy,
      });
      if (!result.ok) throw new Error('构筑无效');
      return result.unit.attrs;
    };
    expect(project('persistent')).toMatchObject({ hp: 350, mp: 75 });
    expect(project('full').hp).toBe(project('full').maxHp);
  });
  it.each(['dead', 'downed', 'escaped', 'benched'] as const)(
    '%s 不能计为个人胜利，队友获胜也不例外',
    (flag) => {
      const { state, unit } = fixture();
      unit.flags[flag] = true;
      expect(huntParticipantSucceeded(state, 'p')).toBe(false);
    },
  );
  it('终局存活才有资格；已被救起可成功，零血、缺失、败局与平局均不成功', () => {
    const { state, unit } = fixture();
    expect(huntParticipantSucceeded(state, 'p')).toBe(true);
    unit.attrs.hp = 0;
    expect(huntParticipantSucceeded(state, 'p')).toBe(false);
    unit.attrs.hp = 1;
    expect(huntParticipantSucceeded(state, 'p')).toBe(true);
    expect(huntParticipantSucceeded(state, 'missing')).toBe(false);
    expect(huntParticipantSucceeded(state, 'boss')).toBe(false);
    for (const winner of [1, 'draw', undefined] as const) {
      state.result =
        winner === undefined ? undefined : { winner, reason: 'wipe' };
      expect(huntParticipantSucceeded(state, 'p')).toBe(false);
    }
  });
  it('正常终局保留消耗与战内恢复，以上场最大值限制临时增益', () => {
    const { entry, unit } = fixture();
    unit.attrs.hp = 210;
    unit.attrs.mp = 12;
    expect(settleHuntResources(entry, unit, false)).toEqual({
      ...entry,
      hp: 210,
      mp: 12,
    });
    unit.attrs.hp = 900;
    unit.attrs.mp = 120;
    expect(settleHuntResources(entry, unit, false)).toEqual({
      ...entry,
      hp: 900,
      mp: 120,
    });
    unit.attrs.hp = 2000;
    unit.attrs.mp = 1000;
    expect(settleHuntResources(entry, unit, false)).toEqual({
      ...entry,
      hp: 1000,
      mp: 500,
    });
  });
  it('死亡沿用战后濒死一气血规则，但不会因此被认作个人胜利', () => {
    const { state, entry, unit } = fixture();
    unit.attrs.hp = 0;
    unit.attrs.mp = 10;
    unit.flags.downed = true;
    expect(settleHuntResources(entry, unit, false)).toEqual({
      ...entry,
      hp: 1,
      mp: 10,
    });
    expect(huntParticipantSucceeded(state, 'p')).toBe(false);
  });
  it('技术中止恢复入场资源，缺少快照必须拒绝结算', () => {
    const { entry, unit } = fixture();
    unit.attrs.hp = 0;
    unit.attrs.mp = 0;
    expect(settleHuntResources(entry, unit, true)).toEqual(entry);
    expect(() => settleHuntResources(undefined, unit, false)).toThrow();
    expect(() => settleHuntResources(entry, undefined, false)).toThrow();
  });
});

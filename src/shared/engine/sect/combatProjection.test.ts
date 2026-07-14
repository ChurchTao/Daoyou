import { describe, expect, it } from 'vitest';
import type { CultivatorSectState } from './types';
import { LINGXIAO_SWORD_MOMENTUM, projectLingxiaoCombat } from './combatProjection';
import { CombatResourceContainer } from '@shared/engine/battle-v5/units/CombatResourceContainer';

function state(overrides: Partial<CultivatorSectState> = {}): CultivatorSectState {
  return {
    membershipId: 'm1', sectId: 'lingxiao', status: 'active', contribution: 0,
    tacticId: 'steady', activeMeridianSlot: 1, configVersion: 1,
    methods: { 'lingxiao-canon': 100, 'sword-guidance': 100, 'void-step': 100, 'edge-cleansing': 100, 'origin-returning': 100, 'swift-sword-canon': 100 },
    meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }, { slot: 2, nodeIds: [], version: 1 }, { slot: 3, nodeIds: [], version: 1 }],
    abilityLoadout: ['guiding-sword', 'linked-edge', 'breaking-edge', 'sword-aegis'],
    ...overrides,
  };
}

describe('凌霄剑宗战斗投影', () => {
  it('未择道剑势上限3，快剑道上限6且稳定ID不变', () => {
    const basic = projectLingxiaoCombat({ sect: state(), realm: '筑基' })!;
    const swift = projectLingxiaoCombat({ sect: state({ pathId: 'swift-sword' }), realm: '筑基' })!;
    expect(basic.resources[0]).toMatchObject({ id: LINGXIAO_SWORD_MOMENTUM, max: 3 });
    expect(swift.resources[0].max).toBe(6);
    expect(basic.abilities[0].slug).toBe(swift.abilities[0].slug);
    expect(basic.abilities[0].name).toBe('引剑式');
    expect(swift.abilities[0].name).toBe('追风式');
  });

  it('分光将流光三叠改为五段并开场疾起获得2剑势', () => {
    const projection = projectLingxiaoCombat({
      sect: state({
        pathId: 'swift-sword',
        meridianLoadouts: [{ slot: 1, nodeIds: ['swift-opening', 'swift-split-light'], version: 1 }],
      }),
      realm: '化神',
    })!;
    expect(projection.resources[0].initial).toBe(2);
    const linked = projection.abilities.find((ability) => ability.slug.endsWith('linked-edge'))!;
    expect(linked.effects?.filter((effect) => effect.type === 'damage')).toHaveLength(5);
  });

  it('一线天具有资源硬门槛，急攻与稳势评分阈值不同', () => {
    const aggressive = projectLingxiaoCombat({ sect: state({ pathId: 'swift-sword', tacticId: 'aggressive' }), realm: '金丹' })!;
    const steady = projectLingxiaoCombat({ sect: state({ pathId: 'swift-sword', tacticId: 'steady' }), realm: '金丹' })!;
    const getFinisher = (projection: typeof aggressive) => projection.abilities.find((ability) => ability.slug.endsWith('breaking-edge'))!;
    expect(getFinisher(aggressive).castConditions?.[0].params.value).toBe(3);
    expect(getFinisher(aggressive).selectionProfile?.rules?.[0].conditions[0].params.value).toBe(3);
    expect(getFinisher(steady).selectionProfile?.rules?.[0].conditions[0].params.value).toBe(6);
  });

  it('展示元数据复用后保持一线天既有伤害结算', () => {
    const projection = projectLingxiaoCombat({
      sect: state({
        pathId: 'swift-sword',
        meridianLoadouts: [{
          slot: 1,
          nodeIds: ['swift-sheathing', 'swift-still-tide', 'swift-life-chasing', 'swift-mountain-breaking'],
          version: 1,
        }],
      }),
      realm: '化神',
    })!;
    const finisher = projection.abilities.find((ability) => ability.slug.endsWith('breaking-edge'))!;
    const coefficients = finisher.effects
      ?.filter((effect) => effect.type === 'damage')
      .map((effect) => Number(effect.params.value.coefficient));
    expect(coefficients?.[0]).toBeCloseTo(0.8 * 1.2 * 1.08);
    expect(coefficients?.slice(1, 7)).toEqual(Array(6).fill(0.2 * 1.08));
    expect(coefficients?.[7]).toBeCloseTo(0.3 * 1.08);
  });

  it('过滤固定空槽并保持非空神通的槽位顺序', () => {
    const projection = projectLingxiaoCombat({
      sect: state({
        pathId: 'swift-sword',
        abilityLoadout: ['breaking-edge', null, 'guiding-sword', null],
      }),
      realm: '化神',
    })!;

    expect(projection.abilities.map((ability) => ability.slug)).toEqual([
      'sect.lingxiao.breaking-edge',
      'sect.lingxiao.guiding-sword',
    ]);
  });

  it('剑势封顶、无伤衰减且剑罡护盾期间暂停衰减', () => {
    const resources = new CombatResourceContainer();
    resources.define({ id: LINGXIAO_SWORD_MOMENTUM, name: '剑势', initial: 0, max: 6, decayOnNoDirectDamage: 1, pauseDecayWhileShielded: true });
    resources.modify(LINGXIAO_SWORD_MOMENTUM, 8);
    expect(resources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(6);
    resources.beginAction(); resources.finishAction(false, true);
    expect(resources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(6);
    resources.beginAction(); resources.finishAction(false, false);
    expect(resources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(5);
  });
});

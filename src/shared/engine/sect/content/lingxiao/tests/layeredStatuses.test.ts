import type { BuffConfig } from '@shared/engine/battle-v5/core/configs';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type { DamageRequestEvent } from '@shared/engine/battle-v5/core/events';
import { DamageSource, DamageType, AttributeType } from '@shared/engine/battle-v5/core/types';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';
import {
  LINGXIAO_ARMOR_REND_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
} from '../shared/LingxiaoMechanics';

function state(pathId: 'swift-sword' | 'heavy-sword'): CultivatorSectState {
  return {
    membershipId: 'layered-status-test',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
    activePathId: pathId,
    methods: {
      'lingxiao-canon': 180,
      'sword-guidance': 180,
      'void-step': 180,
      'edge-cleansing': 180,
      'origin-returning': 180,
      'sword-nurturing': 180,
    },
    paths: [{
      pathId,
      unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'swift-sword' ? 'steady' : 'heavy-full',
      activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: [], version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['linked-edge', null, null, null],
  };
}

function statusConfig(
  pathId: 'swift-sword' | 'heavy-sword',
  statusId: string,
): BuffConfig {
  const config = resolveSectAbility({
    sect: state(pathId),
    realm: '渡劫',
    abilityId: 'linked-edge',
  }).config;
  const applied = config.effects?.find(
    (effect) =>
      effect.type === 'apply_buff' && effect.params.buffConfig.id === statusId,
  );
  if (!applied || applied.type !== 'apply_buff') {
    throw new Error(`未找到状态 ${statusId}`);
  }
  return applied.params.buffConfig;
}

describe('凌霄分层状态', () => {
  beforeEach(() => EventBus.instance.reset());

  it.each([1, 2, 3])('剑痕%i层提高对应伤害2.8%%/层并排除反伤与DOT', (layers) => {
    const target = new Unit('target', '目标', {});
    const caster = new Unit('caster', '施法者', {});
    const config = statusConfig('swift-sword', LINGXIAO_SWORD_MARK_BUFF);
    for (let index = 0; index < layers; index += 1) {
      target.buffs.addBuff(BuffFactory.create(config), caster);
    }
    const request = (damageSource: DamageSource, damageType: DamageType) => {
      const event: DamageRequestEvent = {
        type: 'DamageRequestEvent',
        timestamp: Date.now(),
        caster,
        target,
        damageSource,
        damageType,
        baseDamage: 100,
        finalDamage: 100,
      };
      EventBus.instance.publish(event);
      return event.damageIncreasePctBucket ?? 0;
    };
    expect(request(DamageSource.DIRECT, DamageType.PHYSICAL)).toBeCloseTo(
      0.028 * layers,
    );
    expect(request(DamageSource.COUNTER, DamageType.PHYSICAL)).toBeCloseTo(
      0.028 * layers,
    );
    expect(request(DamageSource.FOLLOW_UP, DamageType.PHYSICAL)).toBeCloseTo(
      0.028 * layers,
    );
    expect(request(DamageSource.REFLECT, DamageType.PHYSICAL)).toBe(0);
    expect(request(DamageSource.DIRECT, DamageType.DOT)).toBe(0);
  });

  it.each([1, 2, 3])('裂甲%i层降低4.2%%物防/层，移除后完整恢复', (layers) => {
    const target = new Unit('target', '目标', {});
    const caster = new Unit('caster', '施法者', {});
    const config = statusConfig('heavy-sword', LINGXIAO_ARMOR_REND_BUFF);
    const baseline = target.attributes.getValue(AttributeType.DEF);
    for (let index = 0; index < layers; index += 1) {
      target.buffs.addBuff(BuffFactory.create(config), caster);
    }
    expect(target.attributes.getValue(AttributeType.DEF)).toBeCloseTo(
      baseline * (1 - 0.042 * layers),
    );
    target.buffs.removeBuff(LINGXIAO_ARMOR_REND_BUFF);
    expect(target.attributes.getValue(AttributeType.DEF)).toBe(baseline);
  });

  it('重复施加增加层数、刷新成长后的持续时间且不超过3层', () => {
    const target = new Unit('target', '目标', {});
    const caster = new Unit('caster', '施法者', {});
    const config = statusConfig('swift-sword', LINGXIAO_SWORD_MARK_BUFF);
    const first = BuffFactory.create(config);
    target.buffs.addBuff(first, caster);
    first.tickDuration();
    expect(first.getDuration()).toBe(5);
    for (let index = 0; index < 4; index += 1) {
      target.buffs.addBuff(BuffFactory.create(config), caster);
    }
    expect(first.getLayer()).toBe(3);
    expect(first.getDuration()).toBe(6);
  });
});

import { StackRule } from '../../buffs/Buff';
import { BuffFactory } from '../../factories/BuffFactory';
import { AbilityFactory } from '../../factories/AbilityFactory';
import {
  beginRuntimeAction,
  consumeQueuedAction,
  consumeSkippedAction,
  shouldTickBuffDuration,
} from '../../core/runtimeState';
import { AbilityType, BuffType } from '../../core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { Unit } from '../../units/Unit';
import { describe, expect, it } from 'vitest';

function unit(id: string): Unit {
  return new Unit(id, id, {});
}

describe('V4行动原语', () => {
  it('castEffects在闪避时仍登记调息，命中效果不执行', () => {
    const caster = unit('caster');
    const target = unit('target');
    caster.combatResources.define({ id: 'momentum', name: '剑势', initial: 0, max: 6 });
    const ability = AbilityFactory.create({
      slug: 'resting-strike',
      name: '调息剑',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      ],
      effects: [{
        type: 'combat_resource_modify',
        params: { resourceId: 'momentum', operation: 'add', amount: 1 },
      }],
      castEffects: [{ type: 'skip_action', params: { reason: '调息' } }],
    });

    ability.execute({ caster, target, shouldApplyEffects: false });

    expect(consumeSkippedAction(caster)).toMatchObject({
      reason: '调息',
      name: '调息',
      sourceAbility: { id: 'resting-strike', name: '调息剑' },
    });
    expect(caster.combatResources.getCurrent('momentum')).toBe(0);
  });

  it('queue_action登记零消耗、不可打断且必然命中的后发神通', () => {
    const caster = unit('caster');
    const target = unit('target');
    const effect = AbilityFactory.createEffect({
      type: 'queue_action',
      params: {
        id: 'queued',
        name: '后发',
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ],
        effects: [{ type: 'damage', params: { value: { base: 10 } } }],
        interruptPolicy: 'uninterruptible',
        hitPolicy: 'guaranteed',
      },
    });
    effect?.execute({ caster, target });
    const queued = consumeQueuedAction(caster);
    expect(queued?.ability).toMatchObject({ name: '后发', mpCost: 0, cooldown: 0 });
    expect(queued).toMatchObject({
      interruptPolicy: 'uninterruptible',
      hitPolicy: 'guaranteed',
      cancelEffects: [],
    });
  });

  it('新施加Buff在施放行动不扣时长，从下一次自身行动开始计数', () => {
    const caster = unit('caster');
    beginRuntimeAction(caster);
    const buff = BuffFactory.create({
      id: 'future-actions',
      name: '未来行动',
      type: BuffType.BUFF,
      duration: 2,
      stackRule: StackRule.REFRESH_DURATION,
    });
    caster.buffs.addBuff(buff, caster);
    expect(shouldTickBuffDuration(caster, buff)).toBe(false);
    expect(buff.getDuration()).toBe(2);
    beginRuntimeAction(caster);
    expect(shouldTickBuffDuration(caster, buff)).toBe(true);
  });
});

import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { DamageCapParams } from '../core/configs';
import type { DamageEvent } from '../core/events';
import { nextRuntimeSequence } from '../core/runtimeState';
import { AttributeType, DamageSource, DamageType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { DelayedRuntimeBuff } from './DelayedEffect';
import type { EffectContext } from './Effect';
import { GameplayEffect } from './Effect';

export class DamageCapEffect extends GameplayEffect {
  constructor(private readonly params: DamageCapParams) {
    super();
  }

  execute(context: EffectContext): void {
    if (context.triggerEvent?.type !== 'DamageEvent') return;
    const event = context.triggerEvent as DamageEvent;
    const cap = Math.round(event.target.getMaxHp() * this.params.maxHpRatio);
    const overflow = Math.max(0, event.finalDamage - cap);
    if (overflow <= 0) return;
    event.finalDamage = cap;
    const turns = Math.max(0, Math.trunc(this.params.deferOverflowTurns ?? 0));
    if (turns <= 0) return;
    event.target.buffs.addBuff(
      new DelayedRuntimeBuff({
        id: `damage_cap_${nextRuntimeSequence(event.target, 'damage_cap')}`,
        name: '彼岸余波',
        description: `${turns}回合后结算被延后的伤害。`,
        delayTurns: turns,
        effects: [{
          type: 'damage',
          params: {
            value: { base: overflow, attribute: AttributeType.ATK, coefficient: 0 },
            damageType: event.damageType ?? DamageType.TRUE,
            damageSource: DamageSource.DELAYED,
          },
        }],
        tags: [GameplayTags.BUFF.TYPE.DEBUFF],
      }),
      event.caster,
    );
  }
}

EffectRegistry.getInstance().register('damage_cap', (params) => new DamageCapEffect(params));

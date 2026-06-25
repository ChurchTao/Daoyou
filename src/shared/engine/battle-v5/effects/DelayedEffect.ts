import { Buff, StackRule } from '../buffs/Buff';
import { DelayedEffectParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import {
  ActionPostEvent,
  DamageTakenEvent,
  HealEvent,
  ShieldBreakEvent,
  ShieldEvent,
} from '../core/events';
import { rememberAmount, setDelayedBuffEffects } from '../core/runtimeState';
import { BuffType } from '../core/types';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { EffectContext, GameplayEffect } from './Effect';

export class DelayedRuntimeBuff extends Buff {
  private remainingTurns: number;
  private triggerCount = 0;

  constructor(private params: DelayedEffectParams) {
    super(
      params.id,
      params.name,
      BuffType.DEBUFF,
      Math.max(1, Math.round(params.delayTurns)),
      StackRule.OVERRIDE,
      params.description,
    );
    this.remainingTurns = Math.max(1, Math.round(params.delayTurns));
    this.tags.addTags(params.tags ?? [GameplayTags.BUFF.TYPE.DEBUFF]);
  }

  override onActivate(): void {
    super.onActivate();
    if (!this._owner) return;
    if (this.params.statusTags) {
      this._owner.tags.addTags(this.params.statusTags);
    }
    setDelayedBuffEffects(this, this.params.effects);
    if (this.params.record) {
      this.subscribeRecordEvent();
    }
    this._subscribeEvent<ActionPostEvent>(
      'ActionPostEvent',
      (event) => {
        if (event.caster !== this._owner) return;
        this.remainingTurns -= 1;
        if (this.remainingTurns > 0) return;
        this.trigger();
      },
      30,
    );
  }

  private trigger(): void {
    if (!this._owner) return;
    if (this.triggerCount >= (this.params.maxTriggers ?? 1)) return;
    this.triggerCount += 1;

    const owner = this._owner;
    owner.buffs.removeBuff(this.id);
    this.executeDelayedEffects(owner);
  }

  private executeDelayedEffects(owner: EffectContext['target']): void {
    executeEffectConfigs(this.params.effects, {
      caster: this._source ?? owner,
      target: owner,
      buff: this,
    });
  }

  private subscribeRecordEvent(): void {
    const record = this.params.record;
    if (!record || !this._owner) return;
    if (record.event === 'damage_taken') {
      this._subscribeEvent<DamageTakenEvent>(
        'DamageTakenEvent',
        (event) => {
          if (event.target !== this._owner || !this._owner) return;
          rememberAmount(
            this._owner,
            record.key,
            event.damageTaken,
            this.resolveRecordMaxStored(),
          );
        },
        30,
      );
      return;
    }
    if (record.event === 'heal') {
      this._subscribeEvent<HealEvent>(
        'HealEvent',
        (event) => {
          if (event.target !== this._owner || !this._owner) return;
          rememberAmount(
            this._owner,
            record.key,
            event.healAmount,
            this.resolveRecordMaxStored(),
          );
        },
        30,
      );
      return;
    }
    if (record.event === 'shield') {
      this._subscribeEvent<ShieldEvent>(
        'ShieldEvent',
        (event) => {
          if (event.target !== this._owner || !this._owner) return;
          rememberAmount(
            this._owner,
            record.key,
            event.shieldAmount,
            this.resolveRecordMaxStored(),
          );
        },
        30,
      );
      return;
    }

    this._subscribeEvent<ShieldBreakEvent>(
      'ShieldBreakEvent',
      (event) => {
        if (event.target !== this._owner || !this._owner) return;
        rememberAmount(
          this._owner,
          record.key,
          event.brokenShieldAmount,
          this.resolveRecordMaxStored(),
        );
      },
      30,
    );
  }

  private resolveRecordMaxStored(): number | undefined {
    const record = this.params.record;
    if (!record || !this._owner) return undefined;
    if (record.maxStoredValue) {
      const valueCap = ValueCalculator.calculate(
        record.maxStoredValue,
        this._source ?? this._owner,
        this._owner,
      );
      if (record.maxStored !== undefined) {
        return Math.min(record.maxStored, valueCap);
      }
      return valueCap;
    }
    return record.maxStored;
  }

  override onDeactivate(reason?: 'manual' | 'expired' | 'dispel' | 'replace'): void {
    const owner = this._owner;
    if (owner && this.params.statusTags) {
      owner.tags.removeTags(this.params.statusTags);
    }
    if (
      owner &&
      reason === 'dispel' &&
      this.params.triggerOnDispel &&
      this.triggerCount < (this.params.maxTriggers ?? 1)
    ) {
      this.triggerCount += 1;
      this.executeDelayedEffects(owner);
    }
    super.onDeactivate();
  }

  override clone(): DelayedRuntimeBuff {
    const cloned = new DelayedRuntimeBuff(this.params);
    cloned.setSource(this._source);
    return cloned;
  }
}

export class DelayedEffect extends GameplayEffect {
  constructor(private params: DelayedEffectParams) {
    super();
  }

  execute(context: EffectContext): void {
    context.target.buffs.addBuff(new DelayedRuntimeBuff(this.params), context.caster);
  }
}

EffectRegistry.getInstance().register(
  'delayed_effect',
  (params) => new DelayedEffect(params),
);

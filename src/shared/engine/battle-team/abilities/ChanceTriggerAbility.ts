import { AttributeType, DamageType, DamageSource } from '@shared/engine/battle-v5/core/types';
import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamUnit } from '../TeamUnit';
import type { TeamTargetPolicy, TeamBattleInternalEvent } from '../types';

export interface ChanceTriggerAbilityOptions {
  id: string;
  name: string;
  triggerChance: number;
  followUpCoefficient: number;
  followUpAttribute: AttributeType;
  followUpDamageType: DamageType;
  targetPolicy?: TeamTargetPolicy;
}

/**
 * 几率触发类技能。
 *
 * 订阅 AfterDealDamage：当 source === owner 时，rng() < triggerChance 则追加一次伤害。
 * followUp 伤害带 isFollowUp=true 标志，不会再触发 AfterDealDamage（反递归保护）。
 */
export class ChanceTriggerAbility extends TeamAbility {
  private _triggerChance: number;
  private _followUpCoefficient: number;
  private _followUpAttribute: AttributeType;
  private _followUpDamageType: DamageType;
  private _isTriggering = false; // 防止 followUp 递归

  constructor(opts: ChanceTriggerAbilityOptions) {
    super({
      id: opts.id,
      name: opts.name,
      kind: 'chance_trigger',
      targetPolicy: opts.targetPolicy ?? { team: 'enemy', scope: 'single', filter: 'front_first' },
      cooldown: 0,
      maxUsesPerRound: 0,
    });
    this._triggerChance = opts.triggerChance;
    this._followUpCoefficient = opts.followUpCoefficient;
    this._followUpAttribute = opts.followUpAttribute;
    this._followUpDamageType = opts.followUpDamageType;
  }

  onBattleStart(ctx: TeamAbilityContext): (() => void) | void {
    return ctx.subscribe('AfterDealDamage', (e: TeamBattleInternalEvent) => {
      if (e.type !== 'AfterDealDamage') return;
      if (e.source.id !== ctx.source.id) return;
      if (!ctx.source.isAlive()) return;
      if (this._isTriggering) return; // 反递归
      if (e.isFollowUp || e.isCounter) return; // followUp/反击不触发

      if (ctx.rng() < this._triggerChance) {
        this._isTriggering = true;
        try {
          ctx.engine.recordLog({
            round: 0,
            actorId: ctx.source.id,
            abilityId: this.id,
            kind: 'chance_trigger',
            text: `${ctx.source.name} 触发【${this.name}】！`,
          });

          // 追加攻击同一个目标（如果还活着）
          if (e.target.isAlive()) {
            ctx.engine.dealDamage(ctx.source, e.target, this, {
              attribute: this._followUpAttribute,
              coefficient: this._followUpCoefficient,
              damageType: this._followUpDamageType,
              source: DamageSource.FOLLOW_UP,
              isFollowUp: true,
            });
          }
        } finally {
          this._isTriggering = false;
        }
      }
    });
  }

  execute(ctx: TeamAbilityContext, targets: TeamUnit[]): void {
    // 也可作为主动行动：普通攻击
    if (targets.length === 0) return;
    ctx.engine.dealDamage(ctx.source, targets[0], this, {
      attribute: AttributeType.ATK,
      coefficient: 1.0,
      damageType: DamageType.PHYSICAL,
      source: DamageSource.DIRECT,
    });
  }
}

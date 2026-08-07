import { AttributeType, DamageType, DamageSource } from '@shared/engine/battle-v5/core/types';
import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamUnit } from '../TeamUnit';
import type { TeamBattleInternalEvent, TeamUnitRef } from '../types';

export interface ConditionalResponseAbilityOptions {
  id: string;
  name: string;
  trigger: 'on_damaged' | 'hp_below';
  chance?: number;
  hpThreshold?: number;
  responseCoefficient: number;
  responseAttribute?: AttributeType;
  responseDamageType?: DamageType;
}

/**
 * 条件响应类技能。
 *
 * 订阅 UnitDamaged：
 * - on_damaged：受击时 rng() < chance 反击
 * - hp_below：血量低于阈值时触发一次（整场仅 1 次）
 *
 * 反击伤害带 isCounter=true 标志，不会再触发 AfterDealDamage（反递归保护）。
 */
export class ConditionalResponseAbility extends TeamAbility {
  private _trigger: 'on_damaged' | 'hp_below';
  private _chance: number | undefined;
  private _hpThreshold: number | undefined;
  private _responseCoefficient: number;
  private _responseAttribute: AttributeType;
  private _responseDamageType: DamageType;
  private _hpBelowAlreadyTriggered = false;
  private _isResponding = false; // 防止反击递归

  constructor(opts: ConditionalResponseAbilityOptions) {
    super({
      id: opts.id,
      name: opts.name,
      kind: 'conditional_response',
      targetPolicy: { team: 'enemy', scope: 'single', filter: 'front_first' },
      cooldown: 0,
      maxUsesPerRound: 0,
    });
    this._trigger = opts.trigger;
    this._chance = opts.chance;
    this._hpThreshold = opts.hpThreshold;
    this._responseCoefficient = opts.responseCoefficient;
    this._responseAttribute = opts.responseAttribute ?? AttributeType.ATK;
    this._responseDamageType = opts.responseDamageType ?? DamageType.PHYSICAL;
  }

  onBattleStart(ctx: TeamAbilityContext): (() => void) | void {
    return ctx.subscribe('UnitDamaged', (e: TeamBattleInternalEvent) => {
      if (e.type !== 'UnitDamaged') return;
      if (e.target.id !== ctx.source.id) return;
      if (!ctx.source.isAlive()) return;
      if (this._isResponding) return; // 反递归
      if (e.isCounter) return; // 反击不再触发反击

      if (this._trigger === 'on_damaged') {
        if (this._chance !== undefined && ctx.rng() >= this._chance) return;
        this.executeCounter(ctx, e.source);
      } else if (this._trigger === 'hp_below') {
        if (this._hpBelowAlreadyTriggered) return;
        const threshold = this._hpThreshold ?? 0.5;
        if (e.afterHp / ctx.source.maxHp >= threshold) return;
        this._hpBelowAlreadyTriggered = true;
        this.executeCounter(ctx, e.source);
      }
    });
  }

  private executeCounter(ctx: TeamAbilityContext, attacker: TeamUnitRef | null): void {
    if (!attacker || !attacker.isAlive()) return;
    this._isResponding = true;
    try {
      ctx.engine.recordLog({
        round: 0,
        actorId: ctx.source.id,
        targetId: attacker.id,
        abilityId: this.id,
        kind: 'counter',
        text: `${ctx.source.name} 触发【${this.name}】反击 ${attacker.name}！`,
      });

      ctx.engine.dealDamage(ctx.source, attacker, this, {
        attribute: this._responseAttribute,
        coefficient: this._responseCoefficient,
        damageType: this._responseDamageType,
        source: DamageSource.COUNTER,
        isCounter: true,
      });
    } finally {
      this._isResponding = false;
    }
  }

  execute(_ctx: TeamAbilityContext, _targets: TeamUnit[]): void {
    void _ctx;
    void _targets;
    // 响应类不主动施放
  }

  isUsableAsAction(): boolean {
    return false;
  }
}

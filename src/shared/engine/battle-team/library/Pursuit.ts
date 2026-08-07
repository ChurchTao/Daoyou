import { AttributeType, DamageType, DamageSource } from '@shared/engine/battle-v5/core/types';
import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamBattleInternalEvent } from '../types';
import type { TeamUnit } from '../TeamUnit';

export interface PursuitOptions {
  id?: string;
  name?: string;
  triggerChance?: number;
  damageMultiplier?: number;
}

/**
 * 技能3：追击
 *
 * 类型：追击（每次基础攻击后有概率再触发）
 * 效果：该单位普攻后 60% 概率造成一次三倍普攻伤害
 *
 * 实现：订阅 AfterDealDamage，当 ability.kind === 'basic' 且来源为自身时，
 * 60% 概率对原目标追加一次 3 倍 ATK 的物理伤害。
 *
 * 反递归：_isTriggering 阻止自身在追击伤害的 AfterDealDamage 中再次触发。
 * 追击伤害带 isFollowUp=true，DamageResolver 不再为其派发 AfterDealDamage（天然截止链）。
 */
export class Pursuit extends TeamAbility {
  private _triggerChance: number;
  private _damageMultiplier: number;
  private _isTriggering = false;

  constructor(opts: PursuitOptions = {}) {
    super({
      id: opts.id ?? 'pursuit_strike',
      name: opts.name ?? '追击',
      kind: 'pursuit',
      targetPolicy: { team: 'enemy', scope: 'single', filter: 'front_first' },
      cooldown: 0,
      maxUsesPerRound: 0,
      description: '追击·该单位普攻后 60% 概率对原目标追加一次 3 倍普攻伤害。仅自身普攻触发，不主动施放。',
    });
    this._triggerChance = opts.triggerChance ?? 0.6;
    this._damageMultiplier = opts.damageMultiplier ?? 3.0;
  }

  onBattleStart(ctx: TeamAbilityContext): (() => void) | void {
    const onAfterDealDamage = (e: TeamBattleInternalEvent) => {
      if (e.type !== 'AfterDealDamage') return;
      if (this._isTriggering) return; // 反递归
      if (e.isCounter || e.isFollowUp) return; // 反击/连击不触发追击
      if (e.ability?.kind !== 'basic') return; // 仅普攻触发
      if (e.source.id !== ctx.source.id) return; // 仅自身普攻触发
      if (!ctx.source.isAlive()) return;

      if (ctx.rng() < this._triggerChance) {
        const target = e.target as TeamUnit;
        if (!target.isAlive()) return;

        this._isTriggering = true;
        try {
          ctx.engine.recordLog({
            round: 0,
            actorId: ctx.source.id,
            abilityId: this.id,
            kind: 'chance_trigger',
            text: `${ctx.source.name} 触发【${this.name}】！${this._damageMultiplier} 倍追击伤害！`,
          });

          ctx.engine.dealDamage(ctx.source, target, this, {
            attribute: AttributeType.ATK,
            coefficient: this._damageMultiplier,
            damageType: DamageType.PHYSICAL,
            source: DamageSource.FOLLOW_UP,
            isFollowUp: true,
          });
        } finally {
          this._isTriggering = false;
        }
      }
    };

    return ctx.subscribe('AfterDealDamage', onAfterDealDamage);
  }

  execute(_ctx: TeamAbilityContext): void {
    void _ctx;
    // 追击类不主动施放，仅通过 AfterDealDamage 事件触发
  }

  isUsableAsAction(): boolean {
    return false;
  }
}

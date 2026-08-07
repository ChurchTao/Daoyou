import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamBattleInternalEvent } from '../types';
import type { TeamUnit } from '../TeamUnit';
import { performBasicAttack } from './basicAttackHelpers';

/**
 * 技能2：连击光环
 *
 * 类型：光环（存活即生效，不需要行动）
 * 效果：友方每次普攻后 30% 概率再次普攻
 *
 * 实现：订阅 AfterDealDamage，当 ability.kind === 'basic' 且来源为友军时，
 * 30% 概率让该友军追加一次普攻（走 performBasicAttack 全流程，可触发追击）。
 *
 * 反递归：_isTriggering 阻止自身在追加普攻的 AfterDealDamage 中再次触发。
 * 多个连击光环所有者可链式触发（各自独立计数），但每个所有者每次基础普攻最多追加一次。
 */
export class ComboAura extends TeamAbility {
  private _triggerChance: number;
  private _isTriggering = false;

  constructor(opts: { id?: string; name?: string; triggerChance?: number } = {}) {
    super({
      id: opts.id ?? 'aura_combo',
      name: opts.name ?? '连击光环',
      kind: 'aura',
      targetPolicy: { team: 'ally', scope: 'aoe', maxTargets: 99 },
      cooldown: 0,
      maxUsesPerRound: 0,
      description: '光环·友方每次普攻后 30% 概率再次普攻。追加的普攻可触发追击，但不会自身递归。存活即生效。',
    });
    this._triggerChance = opts.triggerChance ?? 0.3;
  }

  onBattleStart(ctx: TeamAbilityContext): (() => void) | void {
    const onAfterDealDamage = (e: TeamBattleInternalEvent) => {
      if (e.type !== 'AfterDealDamage') return;
      if (!ctx.source.isAlive()) return;
      if (this._isTriggering) return; // 反递归
      if (e.isCounter) return; // 反击不触发连击
      if (e.ability?.kind !== 'basic') return; // 仅普攻触发
      if (e.source.side !== ctx.source.side) return; // 仅友军触发

      if (ctx.rng() < this._triggerChance) {
        this._isTriggering = true;
        try {
          const ally = e.source as TeamUnit;
          if (!ally.isAlive()) return;

          ctx.engine.recordLog({
            round: 0,
            actorId: ctx.source.id,
            abilityId: this.id,
            kind: 'aura_apply',
            text: `${ctx.source.name} 的【${this.name}】触发 ${ally.name} 连击！`,
          });

          // 追加一次普攻（优先攻击原目标，否则重新选目标含嘲讽判定）
          performBasicAttack(ctx, ally, e.target);
        } finally {
          this._isTriggering = false;
        }
      }
    };

    const unsubAfterDeal = ctx.subscribe('AfterDealDamage', onAfterDealDamage);

    const unsubUnitDied = ctx.subscribe('UnitDied', (e: TeamBattleInternalEvent) => {
      if (e.type === 'UnitDied' && e.unit.id === ctx.source.id) {
        unsubAfterDeal();
        ctx.engine.recordLog({
          round: 0,
          actorId: ctx.source.id,
          abilityId: this.id,
          reason: 'death',
          kind: 'aura_remove',
          text: `${ctx.source.name} 的【${this.name}】随阵亡消散`,
        });
      }
    });

    return () => {
      unsubAfterDeal();
      unsubUnitDied();
    };
  }

  execute(_ctx: TeamAbilityContext): void {
    void _ctx;
    // 光环类不主动施放
  }

  isUsableAsAction(): boolean {
    return false;
  }
}

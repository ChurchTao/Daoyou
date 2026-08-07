import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamBattleInternalEvent, TeamTargetPolicy } from '../types';

const ALLY_AOE_POLICY: TeamTargetPolicy = {
  team: 'ally',
  scope: 'aoe',
  maxTargets: 99,
};

/**
 * 技能1：恢复光环
 *
 * 类型：光环（存活即生效，不需要行动）
 * 效果：每回合结束时恢复幸存单位 100 血
 *
 * 实现：订阅 RoundEnded 事件，对所有存活友军（含自身）执行 heal(100)。
 * 光环所有者阵亡时自动停止（订阅取消）。
 */
export class RecoveryAura extends TeamAbility {
  private _healAmount: number;

  constructor(opts: { id?: string; name?: string; healAmount?: number } = {}) {
    super({
      id: opts.id ?? 'aura_recovery',
      name: opts.name ?? '恢复光环',
      kind: 'aura',
      targetPolicy: ALLY_AOE_POLICY,
      cooldown: 0,
      maxUsesPerRound: 0,
      description: '光环·每回合结束时恢复全体幸存友军（含自身）100 气血。存活即生效，不需要行动。',
    });
    this._healAmount = opts.healAmount ?? 100;
  }

  onBattleStart(ctx: TeamAbilityContext): (() => void) | void {
    const onRoundEnded = (e: TeamBattleInternalEvent) => {
      if (e.type !== 'RoundEnded') return;
      if (!ctx.source.isAlive()) return; // 光环所有者死亡则不生效

      // 治疗自身
      ctx.engine.heal(ctx.source, ctx.source, this._healAmount);

      // 治疗所有存活友军
      const allies = ctx.engine.selectTargets(ctx.source, ALLY_AOE_POLICY);
      for (const ally of allies) {
        ctx.engine.heal(ctx.source, ally, this._healAmount);
      }

      ctx.engine.recordLog({
        round: 0,
        actorId: ctx.source.id,
        abilityId: this.id,
        kind: 'aura_apply',
        text: `${ctx.source.name} 的【${this.name}】治愈全队（每位幸存者恢复 ${this._healAmount} 气血）`,
      });
    };

    const unsubRoundEnded = ctx.subscribe('RoundEnded', onRoundEnded);

    // 光环所有者阵亡 → 取消订阅
    const unsubUnitDied = ctx.subscribe('UnitDied', (e: TeamBattleInternalEvent) => {
      if (e.type === 'UnitDied' && e.unit.id === ctx.source.id) {
        unsubRoundEnded();
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
      unsubRoundEnded();
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

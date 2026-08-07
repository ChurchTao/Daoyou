import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamTargetPolicy } from '../types';
import type { TeamUnit } from '../TeamUnit';
import { performBasicAttack } from './basicAttackHelpers';

const BASIC_POLICY: TeamTargetPolicy = {
  team: 'enemy',
  scope: 'single',
  filter: 'front_first',
};

export interface TauntAbilityOptions {
  id?: string;
  name?: string;
  triggerChance?: number;
}

/**
 * 技能5：嘲讽（主动）
 *
 * 类型：主动（行动时判定是否发动）
 * 效果：回合行动时 70% 概率发动，让敌方当前回合所有普攻只能以自己为目标
 *
 * 实现：
 * - execute 时 70% 概率 → engine.setTaunt(source)
 * - 引擎在普攻目标选择时检查 getEnemyTaunt，强制以嘲讽者为目标
 * - 嘲讽仅当回合有效，回合结束时引擎自动清空（clearRoundTaunts）
 * - 30% 不发动 → fallback 普攻（含嘲讽判定）
 */
export class TauntAbility extends TeamAbility {
  private _triggerChance: number;

  constructor(opts: TauntAbilityOptions = {}) {
    super({
      id: opts.id ?? 'active_taunt',
      name: opts.name ?? '嘲讽',
      kind: 'active',
      targetPolicy: BASIC_POLICY,
      cooldown: 0,
      maxUsesPerRound: 0,
      description: '主动·回合行动时 70% 概率发动嘲讽，使敌方本回合所有普攻只能以自己为目标。30% 不发动则 fallback 普攻。回合结束自动解除。',
    });
    this._triggerChance = opts.triggerChance ?? 0.7;
  }

  execute(ctx: TeamAbilityContext, _targets: TeamUnit[]): void {
    void _targets;

    if (ctx.rng() < this._triggerChance) {
      // 发动嘲讽：本回合敌方普攻只能以自己为目标
      ctx.engine.setTaunt(ctx.source);

      ctx.engine.recordLog({
        round: 0,
        actorId: ctx.source.id,
        abilityId: this.id,
        abilityName: this.name,
        kind: 'action',
        text: `${ctx.source.name} 发动【${this.name}】，吸引敌方全部普攻！`,
      });
    } else {
      // 未发动 → fallback 普攻（含嘲讽判定）
      performBasicAttack(ctx, ctx.source);
    }
  }

  isUsableAsAction(): boolean {
    return true;
  }
}

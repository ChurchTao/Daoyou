import { AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamTargetPolicy, PendingCast } from '../types';
import type { TeamUnit } from '../TeamUnit';
import { performBasicAttack } from './basicAttackHelpers';

const ENEMY_AOE_POLICY: TeamTargetPolicy = {
  team: 'enemy',
  scope: 'aoe',
  maxTargets: 99,
};

export interface ChargeAbilityOptions {
  id?: string;
  name?: string;
  triggerChance?: number;
  damage?: number;
  chargeRounds?: number;
}

/**
 * 技能4：蓄力（主动）
 *
 * 类型：主动（行动时判定是否发动）
 * 效果：轮到该单位出手时 80% 概率发动，发动后不再普攻。
 *       准备一回合，下回合对敌方全体造成 300 固定伤害。
 *
 * 实现：
 * - execute 时 80% 概率 → setPendingCast(releaseRound = currentRound + 1)
 * - 引擎在下一回合该单位出手时优先释放蓄力（releasePendingCast）
 * - 20% 不发动 → fallback 普攻（含嘲讽判定）
 *
 * 蓄力伤害使用 DamageType.TRUE + fixedAmount，跳过属性计算与减伤。
 */
export class ChargeAbility extends TeamAbility {
  private _triggerChance: number;
  private _damage: number;
  private _chargeRounds: number;

  constructor(opts: ChargeAbilityOptions = {}) {
    super({
      id: opts.id ?? 'active_charge',
      name: opts.name ?? '蓄力',
      kind: 'active',
      targetPolicy: ENEMY_AOE_POLICY,
      cooldown: 0,
      maxUsesPerRound: 0,
      description: '主动·轮到出手时 80% 概率发动蓄力（不再普攻），准备一回合后对敌方全体造成 300 真实伤害。20% 不发动则 fallback 普攻。',
    });
    this._triggerChance = opts.triggerChance ?? 0.8;
    this._damage = opts.damage ?? 300;
    this._chargeRounds = opts.chargeRounds ?? 1;
  }

  execute(ctx: TeamAbilityContext, _targets: TeamUnit[]): void {
    void _targets;

    if (ctx.rng() < this._triggerChance) {
      // 发动蓄力：设置下回合释放
      const cast: PendingCast = {
        abilityId: this.id,
        abilityName: this.name,
        releaseRound: ctx.currentRound + this._chargeRounds,
        payload: {
          targetPolicy: ENEMY_AOE_POLICY,
          damage: this._damage,
          damageType: DamageType.TRUE,
          attribute: AttributeType.ATK, // fixedAmount 模式下不参与计算，类型必填
        },
      };
      ctx.engine.setPendingCast(ctx.source, cast);

      ctx.engine.recordLog({
        round: 0,
        actorId: ctx.source.id,
        abilityId: this.id,
        abilityName: this.name,
        phase: 'prepare',
        kind: 'charge',
        text: `${ctx.source.name} 开始蓄力【${this.name}】，下回合释放！`,
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

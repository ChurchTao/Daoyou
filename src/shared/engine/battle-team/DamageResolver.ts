import { AttributeType, DamageType } from '@shared/engine/battle-v5/core/types';
import type {
  DamagePayload,
  DamageResult,
  TeamBattleInternalEvent,
  TeamBattleLogEventInput,
} from './types';
import type { TeamUnit } from './TeamUnit';
import type { TeamAbility } from './TeamAbility';
import type { TeamBattleEventBus } from './TeamBattleEventBus';

/**
 * 伤害结算器。
 *
 * 流程：闪避判定 → 攻击基数 → 减伤 → 暴击 → 护盾抵扣 → 扣血
 * 反递归保护：isCounter/isFollowUp 标志阻止 AfterDealDamage 二次派发
 */
export class DamageResolver {
  constructor(
    private _bus: TeamBattleEventBus,
    private _rng: () => number,
    private _emitLog: (e: TeamBattleLogEventInput) => void,
  ) {}

  resolve(
    source: TeamUnit,
    target: TeamUnit,
    ability: TeamAbility | null,
    payload: DamagePayload,
  ): DamageResult {
    // 1. 闪避判定（真实伤害不可闪避）
    if (payload.damageType !== DamageType.TRUE) {
      const evasion = target.attributes.getValue(AttributeType.EVASION_RATE);
      const accuracy = source.attributes.getValue(AttributeType.ACCURACY);
      const hitChance = Math.min(0.98, Math.max(0.02, 1 - evasion + accuracy * 0.5));
      if (this._rng() > hitChance) {
        this._emitLog({
          round: 0,
          actorId: source.id,
          targetId: target.id,
          amount: 0,
          kind: 'dodge',
          text: `${target.name} 闪避了 ${source.name} 的攻击`,
        });
        return { missed: true, critical: false, amount: 0, absorbed: 0, hpLost: 0, lethal: false };
      }
    }

    // 2. 攻击基数（fixedAmount 跳过属性计算，用于蓄力固定伤害）
    const attackBase = payload.fixedAmount !== undefined
      ? payload.fixedAmount
      : source.attributes.getValue(payload.attribute) * payload.coefficient;

    // 3. 减伤计算
    let mitigation = 0;
    if (payload.damageType === DamageType.PHYSICAL) {
      const def = target.attributes.getValue(AttributeType.DEF);
      mitigation = def / (def + 100);
    } else if (payload.damageType === DamageType.MAGICAL) {
      const magicDef = target.attributes.getValue(AttributeType.MAGIC_DEF);
      mitigation = magicDef / (magicDef + 100);
    }
    // TRUE 伤害 mitigation = 0

    // 4. 暴击判定
    const critRate = Math.max(0, source.attributes.getValue(AttributeType.CRIT_RATE) - target.attributes.getValue(AttributeType.CRIT_RESIST));
    const isCritical = this._rng() < critRate;
    const critMult = isCritical ? source.attributes.getValue(AttributeType.CRIT_DAMAGE_MULT) : 1;

    // 5. 最终伤害
    const finalDamage = Math.max(1, Math.round(attackBase * (1 - mitigation) * critMult));

    // 6. emit BeforeDealDamage
    this._bus.emit({
      type: 'BeforeDealDamage',
      source,
      target,
      ability,
      damage: finalDamage,
    } as TeamBattleInternalEvent);

    // 7. 应用伤害（TeamUnit 内部先抵护盾再扣血）
    const { absorbed, hpLost } = target.takeDamage(finalDamage);
    const lethal = !target.isAlive();

    // 8. emit AfterDealDamage（反递归：反击/连击不触发）
    const isCounter = payload.isCounter ?? false;
    const isFollowUp = payload.isFollowUp ?? false;
    if (!isCounter && !isFollowUp) {
      this._bus.emit({
        type: 'AfterDealDamage',
        source,
        target,
        ability,
        damage: finalDamage,
        lethal,
        isCounter,
        isFollowUp,
      } as TeamBattleInternalEvent);
    }

    // 9. emit UnitDamaged
    this._bus.emit({
      type: 'UnitDamaged',
      target,
      source,
      damage: finalDamage,
      afterHp: target.currentHp,
      isCounter,
      isFollowUp,
    } as TeamBattleInternalEvent);

    // 10. 死亡
    if (lethal) {
      this._bus.emit({
        type: 'UnitDied',
        unit: target,
        killer: source,
      } as TeamBattleInternalEvent);
      this._emitLog({
        round: 0,
        unitId: target.id,
        kind: 'death',
        text: `${target.name} 阵亡`,
      });
    }

    // 11. 写伤害日志
    this._emitLog({
      round: 0,
      actorId: source.id,
      targetId: target.id,
      amount: hpLost,
      kind: 'damage',
      text: `${source.name} 对 ${target.name} 造成 ${hpLost} 伤害${isCritical ? '（暴击！）' : ''}`,
      critical: isCritical,
    });

    return {
      missed: false,
      critical: isCritical,
      amount: finalDamage,
      absorbed,
      hpLost,
      lethal,
    };
  }
}

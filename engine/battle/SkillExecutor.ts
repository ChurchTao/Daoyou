import type { Skill } from '@/types/cultivator';
import type { StatusEffect } from '@/types/constants';
import type {
  ApplyResult,
  StatusApplicationRequest,
  TickContext,
} from '@/engine/status/types';
import { getStatusLabel } from '@/types/dictionaries';
import { damageCalculator } from './calculators/DamageCalculator';
import { evasionCalculator } from './calculators/EvasionCalculator';
import { criticalCalculator } from './calculators/CriticalCalculator';
import type { BattleUnit } from './BattleUnit';

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  success: boolean;
  evaded: boolean;
  damage: number;
  healing: number;
  isCritical: boolean;
  statusApplied: ApplyResult[];
  logs: string[];
  mpCost: number;
  hpCost: number;
}

/**
 * 技能执行器
 * 负责执行技能逻辑，包括伤害、治疗、状态施加等
 */
export class SkillExecutor {
  /**
   * 执行技能
   */
  execute(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    currentTurn: number,
  ): SkillExecutionResult {
    const result: SkillExecutionResult = {
      success: false,
      evaded: false,
      damage: 0,
      healing: 0,
      isCritical: false,
      statusApplied: [],
      logs: [],
      mpCost: 0,
      hpCost: 0,
    };

    // 1. 闪避判定
    if (this.shouldCheckEvasion(skill.type)) {
      const evaded = this.checkEvasion(target, skill);
      if (evaded) {
        result.evaded = true;
        result.logs.push(
          `${target.getName()} 闪避了 ${caster.getName()} 的「${skill.name}」！`,
        );
        // 即使闪避也要记录冷却
        caster.setCooldown(skill.id!, skill.cooldown);
        return result;
      }
    }

    // 2. 根据技能类型执行不同逻辑
    if (skill.type === 'attack') {
      this.executeAttack(caster, target, skill, result);
    } else if (skill.type === 'heal') {
      this.executeHeal(caster, target, skill, result);
    } else if (skill.type === 'buff') {
      this.executeBuff(caster, skill, result);
    } else if (skill.type === 'debuff' || skill.type === 'control') {
      this.executeDebuffOrControl(caster, target, skill, result);
    }

    // 3. 施加技能状态效果（如果有）
    if (skill.effect) {
      this.applySkillStatus(caster, target, skill, result, currentTurn);
    }

    // 4. 消耗MP
    const mpCost = skill.cost ?? 0;
    if (mpCost > 0) {
      caster.consumeMp(mpCost);
      result.mpCost = mpCost;
    }

    // 5. 检查法宝代价（on_use_cost_hp）
    this.checkArtifactCost(caster, skill, result);

    // 6. 设置技能冷却
    caster.setCooldown(skill.id!, skill.cooldown);

    result.success = true;
    return result;
  }

  /**
   * 执行攻击技能
   */
  private executeAttack(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    const casterAttrs = caster.getFinalAttributes();
    const targetAttrs = target.getFinalAttributes();

    // 计算伤害
    const damageResult = damageCalculator.calculateSkillDamage({
      attacker: {
        attributes: casterAttrs,
        cultivatorData: caster.cultivatorData,
      },
      defender: {
        attributes: targetAttrs,
        cultivatorData: target.cultivatorData,
        isDefending: target.isDefending,
        hasArmorUp: target.hasStatus('armor_up'),
        hasArmorDown: target.hasStatus('armor_down'),
      },
      skill,
    });

    const actualDamage = target.applyDamage(damageResult.damage);
    result.damage = actualDamage;
    result.isCritical = damageResult.isCritical;

    // 生成日志
    if (actualDamage <= 0) {
      result.logs.push(
        `${caster.getName()} 对 ${target.getName()} 使用「${skill.name}」，但未能造成有效伤害。`,
      );
    } else {
      const critText = damageResult.isCritical ? '（暴击）' : '';
      result.logs.push(
        `${caster.getName()} 对 ${target.getName()} 使用「${skill.name}」${critText}，造成 ${actualDamage} 点伤害。`,
      );
    }
  }

  /**
   * 执行治疗技能
   */
  private executeHeal(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    const casterAttrs = caster.getFinalAttributes();

    // 确定目标
    const healTarget = skill.target_self === false ? target : caster;

    // 计算治疗量
    const rawHeal = skill.power * (1 + casterAttrs.spirit / 160);
    const actualHeal = healTarget.applyHealing(rawHeal);
    result.healing = actualHeal;

    // 生成日志
    const targetName = healTarget === caster ? '自己' : healTarget.getName();
    if (actualHeal <= 0) {
      result.logs.push(
        `${caster.getName()} 对 ${targetName} 使用「${skill.name}」，但未能恢复气血。`,
      );
    } else {
      result.logs.push(
        `${caster.getName()} 对 ${targetName} 使用「${skill.name}」，恢复 ${actualHeal} 点气血。`,
      );
    }
  }

  /**
   * 执行增益技能
   */
  private executeBuff(
    caster: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    result.logs.push(
      `${caster.getName()} 引导灵力，施展「${skill.name}」，强化自身。`,
    );
  }

  /**
   * 执行减益/控制技能
   */
  private executeDebuffOrControl(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    // 如果技能有伤害，先造成伤害
    if (skill.power > 0) {
      const casterAttrs = caster.getFinalAttributes();
      const targetAttrs = target.getFinalAttributes();

      const damageResult = damageCalculator.calculateSkillDamage({
        attacker: {
          attributes: casterAttrs,
          cultivatorData: caster.cultivatorData,
        },
        defender: {
          attributes: targetAttrs,
          cultivatorData: target.cultivatorData,
          isDefending: target.isDefending,
          hasArmorUp: target.hasStatus('armor_up'),
          hasArmorDown: target.hasStatus('armor_down'),
        },
        skill: {
          ...skill,
          power: skill.power * 0.7, // 减益/控制技能伤害打折
        },
      });

      const actualDamage = target.applyDamage(damageResult.damage);
      result.damage = actualDamage;
      result.isCritical = damageResult.isCritical;

      if (actualDamage > 0) {
        const critText = damageResult.isCritical ? '（暴击）' : '';
        result.logs.push(
          `${caster.getName()} 对 ${target.getName()} 使用「${skill.name}」${critText}，造成 ${actualDamage} 点伤害。`,
        );
      }
    } else {
      result.logs.push(
        `${caster.getName()} 对 ${target.getName()} 使用「${skill.name}」，试图扭转战局。`,
      );
    }
  }

  /**
   * 施加技能状态效果
   */
  private applySkillStatus(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
    currentTurn: number,
  ): void {
    if (!skill.effect) return;

    const duration = skill.duration ?? (skill.type === 'control' ? 1 : 2);
    const label = getStatusLabel(skill.effect);

    // 判断是自体还是敌方
    const appliesToSelf = skill.target_self === true || skill.type === 'buff';
    const recipient = appliesToSelf ? caster : target;

    // 创建状态应用请求
    const request: StatusApplicationRequest = {
      statusKey: skill.effect,
      source: {
        sourceType: 'skill',
        sourceId: skill.id,
        sourceName: skill.name,
        casterSnapshot: caster.createCasterSnapshot(),
      },
      potency: skill.power,
      element: skill.element,
      durationOverride: {
        remaining: duration,
        total: duration,
      },
    };

    // 施加状态
    const applyResult = recipient.statusContainer.addStatus(
      request,
      recipient.createUnitSnapshot(),
    );

    result.statusApplied.push(applyResult);

    // 生成日志
    if (applyResult.success) {
      if (appliesToSelf) {
        result.logs.push(
          `${caster.getName()} 使用「${skill.name}」，获得「${label}」状态（持续 ${duration} 回合）。`,
        );
      } else {
        result.logs.push(
          `${recipient.getName()} 被「${skill.name}」影响，陷入「${label}」状态（持续 ${duration} 回合）。`,
        );
      }
      // 标记属性脏，需要重新计算
      recipient.markAttributesDirty();
    } else if (applyResult.resistedByWillpower) {
      result.logs.push(
        `${recipient.getName()} 神识强大，抵抗了「${skill.name}」试图施加的「${label}」状态。`,
      );
    } else {
      result.logs.push(applyResult.message);
    }
  }

  /**
   * 检查法宝代价
   */
  private checkArtifactCost(
    caster: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    // 只有当技能ID与装备的武器ID一致时，才视为使用了该法宝
    if (skill.id !== caster.cultivatorData.equipped.weapon) {
      return;
    }

    const weapon = caster.cultivatorData.inventory.artifacts.find(
      (a) => a.id === skill.id,
    );

    if (!weapon) return;

    const effects = [
      ...(weapon.special_effects || []),
      ...(weapon.curses || []),
    ];

    for (const eff of effects) {
      if (eff.type === 'on_use_cost_hp') {
        const hpCost = eff.amount;
        caster.applyDamage(hpCost);
        result.hpCost = hpCost;
        result.logs.push(
          `${caster.getName()} 催动 ${weapon.name}，消耗了 ${hpCost} 点精血！`,
        );
      }
    }
  }

  /**
   * 检查闪避
   */
  private checkEvasion(defender: BattleUnit, skill: Skill): boolean {
    const defenderAttrs = defender.getFinalAttributes();

    const evasionContext = {
      attributes: defenderAttrs,
      hasSpeedUp: defender.hasStatus('speed_up'),
      isStunned: defender.hasStatus('stun'),
      isRooted: defender.hasStatus('root'),
    };

    return evasionCalculator.rollEvasion(evasionContext);
  }

  /**
   * 判断是否需要进行闪避判定
   */
  private shouldCheckEvasion(skillType: string): boolean {
    return skillType === 'attack' || skillType === 'control' || skillType === 'debuff';
  }
}

// 导出单例
export const skillExecutor = new SkillExecutor();

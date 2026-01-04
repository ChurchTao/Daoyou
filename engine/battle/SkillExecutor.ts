import { buffRegistry } from '@/engine/buff';
import type { BuffEvent } from '@/engine/buff/types';
import type { Skill } from '@/types/cultivator';
import { getStatusLabel } from '@/types/dictionaries';
import type { BattleUnit } from './BattleUnit';
import { damageCalculator } from './calculators/DamageCalculator';
import { evasionCalculator } from './calculators/EvasionCalculator';

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  success: boolean;
  evaded: boolean;
  damage: number;
  healing: number;
  isCritical: boolean;
  buffsApplied: BuffEvent[];
  logs: string[];
  mpCost: number;
  hpCost: number;
}

/**
 * 技能执行器
 */
export class SkillExecutor {
  execute(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    _currentTurn: number,
  ): SkillExecutionResult {
    const result: SkillExecutionResult = {
      success: false,
      evaded: false,
      damage: 0,
      healing: 0,
      isCritical: false,
      buffsApplied: [],
      logs: [],
      mpCost: 0,
      hpCost: 0,
    };

    // 1. 闪避判定
    if (this.shouldCheckEvasion(skill.type)) {
      const evaded = this.checkEvasion(target);
      if (evaded) {
        result.evaded = true;
        result.logs.push(
          `${target.getName()} 闪避了 ${caster.getName()} 的「${skill.name}」！`,
        );
        caster.setCooldown(skill.id!, skill.cooldown);
        return result;
      }
    }

    // 2. 根据技能类型执行
    if (skill.type === 'attack') {
      this.executeAttack(caster, target, skill, result);
    } else if (skill.type === 'heal') {
      this.executeHeal(caster, skill, result);
    } else if (skill.type === 'buff') {
      this.executeBuff(caster, skill, result);
    } else if (skill.type === 'debuff' || skill.type === 'control') {
      this.executeDebuffOrControl(caster, target, skill, result);
    }

    // 3. 施加技能 Buff
    if (skill.effect) {
      this.applySkillBuff(caster, target, skill, result);
    }

    // 4. 消耗 MP
    const mpCost = skill.cost ?? 0;
    if (mpCost > 0) {
      caster.consumeMp(mpCost);
      result.mpCost = mpCost;
    }

    // 5. 法宝代价
    this.checkArtifactCost(caster, skill, result);

    // 6. 设置冷却
    caster.setCooldown(skill.id!, skill.cooldown);

    result.success = true;
    return result;
  }

  private executeAttack(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    const casterAttrs = caster.getFinalAttributes();
    const targetAttrs = target.getFinalAttributes();

    // 使用新版 DamageCalculator API
    const damageResult = damageCalculator.calculateSkillDamage(
      {
        attacker: {
          attributes: casterAttrs,
          cultivatorData: caster.cultivatorData,
        },
        defender: {
          attributes: targetAttrs,
          cultivatorData: target.cultivatorData,
          isDefending: target.isDefending,
        },
        skill,
      },
      caster,
      target,
    );

    const actualDamage = target.applyDamage(damageResult.damage);
    result.damage = actualDamage;
    result.isCritical = damageResult.isCritical;

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

  private executeHeal(
    caster: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    const casterAttrs = caster.getFinalAttributes();
    const rawHeal = skill.power * (1 + casterAttrs.spirit / 160);
    const actualHeal = caster.applyHealing(rawHeal);
    result.healing = actualHeal;

    if (actualHeal <= 0) {
      result.logs.push(
        `${caster.getName()} 使用「${skill.name}」，但未能恢复气血。`,
      );
    } else {
      result.logs.push(
        `${caster.getName()} 使用「${skill.name}」，恢复 ${actualHeal} 点气血。`,
      );
    }
  }

  private executeBuff(
    caster: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    result.logs.push(
      `${caster.getName()} 引导灵力，施展「${skill.name}」，强化自身。`,
    );
  }

  private executeDebuffOrControl(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    if (skill.power > 0) {
      const casterAttrs = caster.getFinalAttributes();
      const targetAttrs = target.getFinalAttributes();

      const damageResult = damageCalculator.calculateSkillDamage(
        {
          attacker: {
            attributes: casterAttrs,
            cultivatorData: caster.cultivatorData,
          },
          defender: {
            attributes: targetAttrs,
            cultivatorData: target.cultivatorData,
            isDefending: target.isDefending,
          },
          skill: { ...skill, power: skill.power * 0.7 },
        },
        caster,
        target,
      );

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

  private applySkillBuff(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    if (!skill.effect) return;

    const buffId = skill.effect;
    const config = buffRegistry.get(buffId);
    const duration = skill.duration ?? (skill.type === 'control' ? 1 : 2);
    const label = getStatusLabel(skill.effect);

    const appliesToSelf = skill.target_self === true || skill.type === 'buff';
    const recipient = appliesToSelf ? caster : target;

    if (config) {
      const event = recipient.buffManager.addBuff(config, caster, {
        durationOverride: duration,
      });
      result.buffsApplied.push(event);

      if (event.type === 'applied' || event.type === 'stacked') {
        if (appliesToSelf) {
          result.logs.push(
            `${caster.getName()} 使用「${skill.name}」，获得「${config.name}」状态（持续 ${duration} 回合）。`,
          );
        } else {
          result.logs.push(
            `${recipient.getName()} 被「${skill.name}」影响，陷入「${config.name}」状态（持续 ${duration} 回合）。`,
          );
        }
        recipient.markAttributesDirty();
      } else if (event.type === 'refreshed') {
        result.logs.push(
          `${recipient.getName()} 的「${config.name}」状态持续时间已刷新。`,
        );
      }
    } else {
      result.logs.push(`警告：未找到 Buff 配置「${buffId}」。`);
    }
  }

  private checkArtifactCost(
    caster: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    if (skill.id !== caster.cultivatorData.equipped.weapon) return;

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

  private checkEvasion(defender: BattleUnit): boolean {
    const defenderAttrs = defender.getFinalAttributes();
    const cannotDodge = defender.hasBuff('stun') || defender.hasBuff('root');

    return evasionCalculator.rollEvasion({
      attributes: defenderAttrs,
      speedBonus: defender.hasBuff('speed_up') ? 20 : 0,
      cannotDodge,
    });
  }

  private shouldCheckEvasion(skillType: string): boolean {
    return (
      skillType === 'attack' ||
      skillType === 'control' ||
      skillType === 'debuff'
    );
  }
}

export const skillExecutor = new SkillExecutor();

/**
 * 技能工厂 - 将 AI 蓝图转化为实际技能
 *
 * 核心职责：
 * 1. 根据境界限制确定品阶
 * 2. 根据悟性计算威力
 * 3. 验证五行契合度（不信任 AI）
 * 4. 根据技能类型应用规则
 */

import type {
  ElementType,
  RealmType,
  SkillGrade,
  StatusEffect,
} from '@/types/constants';
import type { Skill, SpiritualRoot } from '@/types/cultivator';
import { SKILL_POWER_RANGES } from '@/utils/characterEngine';
import {
  calculateBaseCost,
  calculateCooldown,
  clampGrade,
  ELEMENT_MATCH_MODIFIER,
  GRADE_HINT_TO_GRADES,
  REALM_GRADE_LIMIT,
  SKILL_ELEMENT_CONFLICT,
  SKILL_TYPE_MODIFIERS,
  wisdomToPowerRatio,
} from './skillConfig';
import type {
  ElementMatch,
  GradeHint,
  SkillBlueprint,
  SkillContext,
} from './types';

export class SkillFactory {
  /**
   * 将技能蓝图转化为实际技能
   */
  static materialize(blueprint: SkillBlueprint, context: SkillContext): Skill {
    // 1. 计算五行契合度（后端验证，不信任 AI）
    const elementMatch = this.calculateElementMatch(
      blueprint.element,
      context.spiritualRoots,
      context.weaponElement,
    );

    // 2. 确定品阶（基于境界限制 + grade_hint + 悟性）
    const grade = this.calculateGrade(
      blueprint.grade_hint,
      context.realm,
      context.wisdom,
    );

    // 3. 计算基础威力（基于品阶 + 悟性）
    const basePower = this.calculateBasePower(grade, context.wisdom);

    // 4. 应用技能类型修正
    const typeModifier = SKILL_TYPE_MODIFIERS[blueprint.type];
    const typePowerMult = typeModifier.power_mult;

    // 5. 应用五行契合修正
    const matchModifier = ELEMENT_MATCH_MODIFIER[elementMatch];
    const power = Math.floor(basePower * typePowerMult * matchModifier.power);

    // 6. 计算消耗（基于威力 × 契合度修正）
    const baseCost = calculateBaseCost(power);
    const cost = Math.floor(baseCost * matchModifier.cost);

    // 7. 计算冷却
    const cooldown = calculateCooldown(power);

    // 8. 处理特效
    const { effect, duration, target_self } = this.processEffect(
      blueprint.type,
      blueprint.effect_hint,
      typeModifier,
    );

    return {
      name: blueprint.name,
      type: blueprint.type,
      element: blueprint.element,
      grade,
      power,
      cost,
      cooldown,
      effect,
      duration,
      target_self,
      description: blueprint.description,
    };
  }

  /**
   * 计算五行契合度（后端验证）
   */
  private static calculateElementMatch(
    skillElement: ElementType,
    spiritualRoots: SpiritualRoot[],
    weaponElement?: ElementType,
  ): ElementMatch {
    // 检查五行相克
    const hasConflict = this.checkElementConflict(skillElement, spiritualRoots);
    if (hasConflict) {
      return 'conflict';
    }

    // 检查灵根是否匹配
    const rootMatch = spiritualRoots.find((r) => r.element === skillElement);
    const rootStrength = rootMatch?.strength || 0;

    // 检查武器是否匹配
    const weaponMatch = weaponElement === skillElement;

    // 完美匹配：灵根强度 >= 70 且武器匹配
    if (rootMatch && rootStrength >= 70 && weaponMatch) {
      return 'perfect_match';
    }

    // 部分匹配：有对应灵根且强度 >= 50
    if (rootMatch && rootStrength >= 50) {
      return 'partial_match';
    }

    // 弱匹配：有对应灵根但强度较低
    if (rootMatch) {
      return 'partial_match';
    }

    return 'no_match';
  }

  /**
   * 检查技能元素是否与灵根相克
   */
  private static checkElementConflict(
    skillElement: ElementType,
    spiritualRoots: SpiritualRoot[],
  ): boolean {
    const rootElements = spiritualRoots.map((r) => r.element);
    const conflicts = SKILL_ELEMENT_CONFLICT[skillElement] || [];

    for (const rootEl of rootElements) {
      if (conflicts.includes(rootEl)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 计算最终品阶
   */
  private static calculateGrade(
    gradeHint: GradeHint,
    realm: RealmType,
    wisdom: number,
  ): SkillGrade {
    // 1. 获取品阶候选列表
    const candidates =
      GRADE_HINT_TO_GRADES[gradeHint] || GRADE_HINT_TO_GRADES['low'];

    // 2. 根据悟性选择候选品阶
    // 悟性高 -> 选择更高的品阶
    const wisdomRatio = wisdomToPowerRatio(wisdom); // 0.3 - 1.0
    const index = Math.min(
      candidates.length - 1,
      Math.floor(wisdomRatio * candidates.length),
    );
    let selectedGrade = candidates[index];

    // 3. 应用境界限制
    const realmLimit = REALM_GRADE_LIMIT[realm];
    selectedGrade = clampGrade(selectedGrade, realmLimit);

    return selectedGrade;
  }

  /**
   * 计算基础威力（在品阶范围内）
   */
  private static calculateBasePower(grade: SkillGrade, wisdom: number): number {
    const range = SKILL_POWER_RANGES[grade];
    if (!range) {
      return 30; // 默认最低威力
    }

    // 根据悟性在范围内插值
    const ratio = wisdomToPowerRatio(wisdom);
    const power = range.min + Math.floor((range.max - range.min) * ratio);

    return power;
  }

  /**
   * 处理技能特效
   */
  private static processEffect(
    skillType: string,
    effectHint: SkillBlueprint['effect_hint'],
    typeModifier: (typeof SKILL_TYPE_MODIFIERS)[keyof typeof SKILL_TYPE_MODIFIERS],
  ): {
    effect: StatusEffect | undefined;
    duration: number | undefined;
    target_self: boolean;
  } {
    // attack/heal 类型不能有特效
    if (!typeModifier.has_effect) {
      return {
        effect: undefined,
        duration: undefined,
        target_self: typeModifier.target_self || false,
      };
    }

    // 如果没有特效提示或类型为 none
    if (!effectHint || effectHint.type === 'none') {
      return {
        effect: undefined,
        duration: undefined,
        target_self: typeModifier.target_self || false,
      };
    }

    // 有特效
    const maxDuration = typeModifier.max_duration || 2;
    const duration = Math.min(
      maxDuration,
      1 + Math.floor(Math.random() * maxDuration),
    );

    return {
      effect: effectHint.status,
      duration,
      target_self: effectHint.target_self ?? typeModifier.target_self ?? false,
    };
  }
}

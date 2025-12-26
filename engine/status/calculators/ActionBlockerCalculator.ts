import type {
  ActionBlockResult,
  CalculationContext,
  EffectCalculator,
  StatusInstance,
} from '../types';

/**
 * 行动限制计算器
 * 负责判断状态是否限制角色行动
 */
export class ActionBlockerCalculator implements EffectCalculator {
  checkActionBlock(
    status: StatusInstance,
    _context: CalculationContext,
  ): Partial<ActionBlockResult> {
    const result: Partial<ActionBlockResult> = {};

    switch (status.statusKey) {
      case 'stun':
        result.canAct = false;
        result.canUseSkill = false;
        result.canDodge = false;
        result.blockReasons = ['眩晕状态下无法行动'];
        break;

      case 'silence':
        result.canUseSkill = false;
        result.blockReasons = ['沉默状态下无法使用技能'];
        break;

      case 'root':
        result.canDodge = false;
        result.blockReasons = ['定身状态下无法闪避'];
        break;

      default:
        // 其他状态不限制行动
        break;
    }

    return result;
  }

  /**
   * 检查多个状态的综合行动限制
   */
  static checkMultipleStatuses(
    statuses: StatusInstance[],
    context: CalculationContext,
  ): ActionBlockResult {
    const calculator = new ActionBlockerCalculator();
    const result: ActionBlockResult = {
      canAct: true,
      canUseSkill: true,
      canDodge: true,
      blockReasons: [],
    };

    for (const status of statuses) {
      const blockResult = calculator.checkActionBlock(status, context);
      
      if (blockResult.canAct === false) result.canAct = false;
      if (blockResult.canUseSkill === false) result.canUseSkill = false;
      if (blockResult.canDodge === false) result.canDodge = false;
      if (blockResult.blockReasons) {
        result.blockReasons.push(...blockResult.blockReasons);
      }
    }

    return result;
  }
}

export const actionBlockerCalculator = new ActionBlockerCalculator();

import type { ElementType, Quality } from '@/types/constants';
import type { Artifact, Attributes, Cultivator } from '@/types/cultivator';
import { criticalCalculator } from './CriticalCalculator';
import {
  ELEMENT_WEAKNESS,
  MAX_DAMAGE_REDUCTION,
  type DamageContext,
  type DamageResult,
} from '../types';

/**
 * 伤害计算器
 * 负责统一处理所有伤害计算，包括技能伤害、法宝伤害、元素加成等
 */
export class DamageCalculator {
  /**
   * 计算技能基础伤害
   * 
   * 流程：
   * 1. 基础伤害 = 技能威力 × (1 + 灵力/150)
   * 2. 灵根加成 = 基础伤害 × 灵根倍率
   * 3. 元素克制（暂时禁用）
   * 4. 法宝加成 = 伤害 × (1 + 法宝元素加成)
   * 5. 暴击判定与倍率
   * 6. 防御减伤
   * 
   * @param context 伤害计算上下文
   * @returns 伤害结果
   */
  calculateSkillDamage(context: DamageContext): DamageResult {
    const { attacker, defender, skill } = context;

    // 1. 基础伤害
    let damage = skill.power * (1 + attacker.attributes.spirit / 150);

    // 2. 灵根加成
    damage *= this.getRootDamageMultiplier(
      attacker.cultivatorData,
      skill.element,
    );

    // 3. 元素克制（暂时注释，根据原引擎的 todo）
    // damage *= this.getElementMultiplier(attacker.cultivatorData, defender.cultivatorData, skill.element);

    // 4. 法宝加成
    const artifactBonus = this.getArtifactDamageBonus(
      attacker.cultivatorData,
      skill.element,
    );
    if (artifactBonus > 0) {
      damage *= 1 + artifactBonus;
    }

    // 5. 暴击判定
    const critContext = {
      attributes: attacker.attributes,
      hasCritRateUp: false, // 由调用方传入
      hasCritRateDown: false, // 由调用方传入
    };
    const isCritical = criticalCalculator.rollCritical(critContext);
    if (isCritical) {
      damage *= criticalCalculator.getCriticalMultiplier();
    }

    // 6. 防御减伤
    damage *= this.getDefenseMultiplier(defender);

    return {
      damage: Math.max(0, Math.floor(damage)),
      isCritical,
    };
  }

  /**
   * 获取灵根伤害倍率
   * 
   * @param attacker 攻击者数据
   * @param element 元素
   * @returns 伤害倍率
   */
  getRootDamageMultiplier(attacker: Cultivator, element: ElementType): number {
    const root = attacker.spiritual_roots.find((r) => r.element === element);
    if (!root) return 1.0;
    return 1.0 + (root.strength / 100) * 0.5;
  }

  /**
   * 获取元素克制倍率（暂时不使用）
   * 
   * @param attacker 攻击者数据
   * @param defender 防御者数据
   * @param element 元素
   * @returns 克制倍率
   */
  getElementMultiplier(
    attacker: Cultivator,
    defender: Cultivator,
    element: ElementType,
  ): number {
    let mult = 1.0;
    const defenderMainRoot = defender.spiritual_roots[0]?.element;
    if (defenderMainRoot && ELEMENT_WEAKNESS[element]?.includes(defenderMainRoot)) {
      mult *= 1.25;
    }
    return mult;
  }

  /**
   * 获取法宝元素伤害加成
   * 
   * @param attacker 攻击者数据
   * @param element 元素
   * @returns 加成倍率
   */
  getArtifactDamageBonus(attacker: Cultivator, element: ElementType): number {
    let multiplier = 0;

    // 遍历已装备的法宝
    const artifactsById = new Map(
      attacker.inventory.artifacts.map((a) => [a.id!, a]),
    );
    const equippedIds = [
      attacker.equipped.weapon,
      attacker.equipped.armor,
      attacker.equipped.accessory,
    ].filter(Boolean) as string[];

    for (const id of equippedIds) {
      const artifact = artifactsById.get(id);
      if (!artifact) continue;

      const effects = [
        ...(artifact.special_effects || []),
        ...(artifact.curses || []),
      ];

      for (const effect of effects) {
        if (effect.type === 'damage_bonus' && effect.element === element) {
          multiplier += effect.bonus;
        }
      }
    }

    return multiplier;
  }

  /**
   * 获取防御减伤系数
   * 
   * 公式：
   * 减伤率 = 体魄 / 400
   * 状态修正：
   * - 护体状态：+ 0.15
   * - 破防状态：- 0.15
   * - 防御姿态：+ 0.5
   * 限制范围：0-0.7
   * 
   * @param defender 防御者上下文
   * @returns 伤害系数（1 - 减伤率）
   */
  getDefenseMultiplier(defender: DamageContext['defender']): number {
    let reduction = defender.attributes.vitality / 400;

    // 状态修正
    if (defender.hasArmorUp) {
      reduction += 0.15;
    }
    if (defender.hasArmorDown) {
      reduction -= 0.15;
    }
    if (defender.isDefending) {
      reduction += 0.5; // 防御状态减伤50%
    }

    // 限制减伤范围
    reduction = Math.min(Math.max(reduction, 0), MAX_DAMAGE_REDUCTION);

    return 1 - reduction;
  }

  /**
   * 计算法宝主动技能的威力和消耗
   * 
   * @param quality 法宝品质
   * @param willpower 神识值
   * @returns 威力和消耗
   */
  getArtifactPowerAndCost(
    quality: Quality | undefined,
    willpower: number,
  ): { power: number; cost: number } {
    const QUALITY_POWER_MAP: Record<Quality, number> = {
      凡品: 10,
      灵品: 25,
      玄品: 40,
      真品: 60,
      地品: 90,
      天品: 130,
      仙品: 180,
      神品: 250,
    };

    const baseQ = quality ? (QUALITY_POWER_MAP[quality] ?? 10) : 10;
    const multiplier = willpower * (250 / 6000);

    return {
      power: baseQ + multiplier,
      cost: baseQ,
    };
  }

  /**
   * 获取法宝特殊效果（击中附加状态）
   * 
   * @param artifact 法宝
   * @returns 击中附加效果，如果没有则返回 undefined
   */
  getArtifactOnHitEffect(artifact: Artifact) {
    return artifact.special_effects?.find(
      (eff) => eff.type === 'on_hit_add_effect',
    );
  }
}

// 导出单例
export const damageCalculator = new DamageCalculator();

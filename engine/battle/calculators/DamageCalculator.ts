import { EffectType } from '@/engine/effect';
import type { ElementType, Quality } from '@/types/constants';
import type { Cultivator } from '@/types/cultivator';
import type { BattleUnit } from '../BattleUnit';
import {
  MAX_DAMAGE_REDUCTION,
  type DamageContext,
  type DamageResult,
} from '../types';
import { criticalCalculator } from './CriticalCalculator';

/**
 * 伤害计算器
 * 负责统一处理所有伤害计算
 */
export class DamageCalculator {
  /**
   * 计算技能伤害
   * Buff 修正通过 BattleUnit 获取
   */
  calculateSkillDamage(
    context: DamageContext,
    attackerUnit: BattleUnit,
    defenderUnit: BattleUnit,
  ): DamageResult {
    const { attacker, defender, skill } = context;

    // 从 effects 中提取 power（Damage 效果的 multiplier * 100）
    const damageEffect = skill.effects?.find((e) => e.type === 'Damage');
    const multiplier = (damageEffect?.params?.multiplier as number) ?? 0;
    const power = multiplier * 100;

    // 1. 基础伤害
    let damage = power * (1 + attacker.attributes.spirit / 150);

    // 2. 灵根加成
    damage *= this.getRootDamageMultiplier(
      attacker.cultivatorData,
      skill.element,
    );

    // 3. 法宝加成
    const artifactBonus = this.getArtifactDamageBonus(
      attacker.cultivatorData,
      skill.element,
    );
    if (artifactBonus > 0) {
      damage *= 1 + artifactBonus;
    }

    // 4. 暴击判定（使用 Buff 加成）
    const critContext = {
      attributes: attacker.attributes,
      critRateBonus: attackerUnit.getCritRateBonus(),
    };
    const isCritical = criticalCalculator.rollCritical(critContext);
    if (isCritical) {
      damage *= criticalCalculator.getCriticalMultiplier();
    }

    // 5. 防御减伤（使用 Buff 加成）
    damage *= this.getDefenseMultiplier(
      defender.attributes.vitality,
      defenderUnit.getDamageReductionBonus(),
    );

    return {
      damage: Math.max(0, Math.floor(damage)),
      isCritical,
    };
  }

  /**
   * 灵根伤害倍率
   */
  getRootDamageMultiplier(attacker: Cultivator, element: ElementType): number {
    const root = attacker.spiritual_roots.find((r) => r.element === element);
    if (!root) return 1.0;
    return 1.0 + (root.strength / 100) * 0.5;
  }

  /**
   * 法宝伤害加成
   */
  getArtifactDamageBonus(attacker: Cultivator, element: ElementType): number {
    let multiplier = 0;

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

      // 从 effects 中提取 damage_bonus
      const effects = artifact.effects ?? [];

      for (const effect of effects) {
        const params = effect.params as
          | { element?: string; bonus?: number }
          | undefined;
        if (effect.type === EffectType.Damage && params?.element === element) {
          multiplier += params.bonus ?? 0;
        }
      }
    }

    return multiplier;
  }

  /**
   * 防御减伤系数
   * @param vitality 体魄值
   * @param buffBonus Buff 提供的减伤加成
   */
  getDefenseMultiplier(vitality: number, buffBonus: number): number {
    let reduction = vitality / 400 + buffBonus;
    reduction = Math.min(Math.max(reduction, 0), MAX_DAMAGE_REDUCTION);
    return 1 - reduction;
  }

  /**
   * 法宝技能威力和消耗
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
}

export const damageCalculator = new DamageCalculator();

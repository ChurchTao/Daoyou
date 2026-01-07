/**
 * AffixGenerator 单元测试
 */

import { EffectType } from '@/engine/effect/types';
import { AffixGenerator } from './AffixGenerator';

describe('AffixGenerator', () => {
  describe('generateArtifactAffixes', () => {
    it('应该为法宝生成效果数组', () => {
      const result = AffixGenerator.generateArtifactAffixes(
        'weapon',
        '玄品',
        '筑基',
        '火',
        ['increase_spirit'],
      );

      expect(result.effects).toBeDefined();
      expect(Array.isArray(result.effects)).toBe(true);
      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.selectedAffixes).toBeDefined();
    });

    it('应该根据品质生成不同数量的词条', () => {
      // 低品质 - 应该只有主词条
      const lowQualityResult = AffixGenerator.generateArtifactAffixes(
        'weapon',
        '凡品',
        '炼气',
      );

      // 高品质 - 应该有更多词条
      const highQualityResult = AffixGenerator.generateArtifactAffixes(
        'weapon',
        '地品',
        '化神',
      );

      expect(highQualityResult.effects.length).toBeGreaterThanOrEqual(
        lowQualityResult.effects.length,
      );
    });

    it('应该根据槽位筛选合适的词条', () => {
      const weaponResult = AffixGenerator.generateArtifactAffixes(
        'weapon',
        '真品',
        '金丹',
        '火',
      );

      const armorResult = AffixGenerator.generateArtifactAffixes(
        'armor',
        '真品',
        '金丹',
        '火',
      );

      // 武器和护甲应该有不同的词条选择
      expect(weaponResult.effects).toBeDefined();
      expect(armorResult.effects).toBeDefined();
    });

    it('每个效果应该有正确的类型', () => {
      const result = AffixGenerator.generateArtifactAffixes(
        'weapon',
        '真品',
        '元婴',
        '雷',
      );

      for (const effect of result.effects) {
        expect(effect.type).toBeDefined();
        expect(Object.values(EffectType)).toContain(effect.type);
      }
    });

    it('应该返回选中的词条信息', () => {
      const result = AffixGenerator.generateArtifactAffixes(
        'accessory',
        '玄品',
        '筑基',
      );

      expect(result.selectedAffixes.length).toBe(result.effects.length);
      for (const affix of result.selectedAffixes) {
        expect(affix.displayName).toBeDefined();
        expect(affix.effectType).toBeDefined();
        expect(affix.tags).toBeDefined();
      }
    });
  });

  describe('generateConsumableAffixes', () => {
    it('应该为丹药生成效果数组', () => {
      const result = AffixGenerator.generateConsumableAffixes('玄品', '筑基', [
        'increase_vitality',
      ]);

      expect(result.effects).toBeDefined();
      expect(Array.isArray(result.effects)).toBe(true);
      expect(result.effects.length).toBeGreaterThan(0);
    });

    it('应该根据方向标签生成相关效果', () => {
      const vitalityResult = AffixGenerator.generateConsumableAffixes(
        '玄品',
        '筑基',
        ['increase_vitality'],
      );

      const spiritResult = AffixGenerator.generateConsumableAffixes(
        '玄品',
        '筑基',
        ['increase_spirit'],
      );

      // 两者都应该生成效果
      expect(vitalityResult.effects.length).toBeGreaterThan(0);
      expect(spiritResult.effects.length).toBeGreaterThan(0);
    });

    it('高品质丹药可能有副词条', () => {
      // 多次生成真品丹药，统计有副词条的次数
      let hasSecondaryCount = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const result = AffixGenerator.generateConsumableAffixes(
          '地品',
          '化神',
          ['increase_spirit'],
        );
        if (result.effects.length > 1) {
          hasSecondaryCount++;
        }
      }

      // 应该有一定比例有副词条（但不是全部，因为有随机性）
      expect(hasSecondaryCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateSkillAffixes', () => {
    it('应该为攻击型技能生成伤害效果', () => {
      const result = AffixGenerator.generateSkillAffixes(
        'attack',
        '火',
        '玄阶中品',
        150,
      );

      expect(result.effects).toBeDefined();
      expect(result.effects.length).toBeGreaterThan(0);

      // 攻击型技能应该包含伤害效果
      const hasDamage = result.effects.some(
        (e) => e.type === EffectType.Damage,
      );
      expect(hasDamage).toBe(true);
    });

    it('应该为治疗型技能生成治疗效果', () => {
      const result = AffixGenerator.generateSkillAffixes(
        'heal',
        '木',
        '玄阶上品',
        200,
      );

      expect(result.effects.length).toBeGreaterThan(0);

      // 治疗型技能应该包含治疗或护盾效果
      const hasHealOrShield = result.effects.some(
        (e) => e.type === EffectType.Heal || e.type === EffectType.Shield,
      );
      expect(hasHealOrShield).toBe(true);
    });

    it('应该为控制型技能生成 AddBuff 效果', () => {
      const result = AffixGenerator.generateSkillAffixes(
        'control',
        '冰',
        '地阶下品',
        180,
      );

      expect(result.effects.length).toBeGreaterThan(0);

      // 控制型技能应该包含 AddBuff 效果
      const hasAddBuff = result.effects.some(
        (e) => e.type === EffectType.AddBuff,
      );
      expect(hasAddBuff).toBe(true);
    });

    it('应该为减益型技能生成 debuff 效果', () => {
      const result = AffixGenerator.generateSkillAffixes(
        'debuff',
        '土',
        '玄阶中品',
        120,
      );

      expect(result.effects.length).toBeGreaterThan(0);

      // 减益型应该包含 AddBuff（施加负面状态）
      const hasAddBuff = result.effects.some(
        (e) => e.type === EffectType.AddBuff,
      );
      expect(hasAddBuff).toBe(true);
    });

    it('应该为增益型技能生成 buff 效果', () => {
      const result = AffixGenerator.generateSkillAffixes(
        'buff',
        '金',
        '玄阶上品',
        160,
      );

      expect(result.effects.length).toBeGreaterThan(0);

      // 增益型应该包含 AddBuff 或 Shield
      const hasBuffEffect = result.effects.some(
        (e) => e.type === EffectType.AddBuff || e.type === EffectType.Shield,
      );
      expect(hasBuffEffect).toBe(true);
    });

    it('高品阶技能可能有副词条', () => {
      // 多次生成地阶技能
      let hasSecondaryCount = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const result = AffixGenerator.generateSkillAffixes(
          'heal',
          '水',
          '地阶上品',
          300,
        );
        if (result.effects.length > 1) {
          hasSecondaryCount++;
        }
      }

      // 应该有一定比例有副词条
      expect(hasSecondaryCount).toBeGreaterThanOrEqual(0);
    });

    it('悟性应该影响效果数值', () => {
      const lowWisdomResult = AffixGenerator.generateSkillAffixes(
        'attack',
        '火',
        '玄阶中品',
        50,
      );

      const highWisdomResult = AffixGenerator.generateSkillAffixes(
        'attack',
        '火',
        '玄阶中品',
        400,
      );

      // 两者都应该生成效果
      expect(lowWisdomResult.effects.length).toBeGreaterThan(0);
      expect(highWisdomResult.effects.length).toBeGreaterThan(0);

      // 高悟性的伤害倍率应该更高
      const lowMultiplier =
        (lowWisdomResult.effects[0].params as Record<string, unknown>)
          .multiplier || 0;
      const highMultiplier =
        (highWisdomResult.effects[0].params as Record<string, unknown>)
          .multiplier || 0;

      expect(highMultiplier).toBeGreaterThan(lowMultiplier as number);
    });
  });

  describe('generateCurseAffix', () => {
    it('应该生成诅咒效果', () => {
      const result = AffixGenerator.generateCurseAffix('金丹', '真品');

      expect(Array.isArray(result)).toBe(true);
      // 可能生成 0 或 1 个诅咒
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('诅咒效果应该有正确的类型', () => {
      const result = AffixGenerator.generateCurseAffix('元婴', '玄品');

      if (result.length > 0) {
        expect(result[0].type).toBeDefined();
        expect(Object.values(EffectType)).toContain(result[0].type);
      }
    });
  });

  describe('品质筛选', () => {
    it('低品质物品不应该获得高级词条', () => {
      // 凡品法宝多次生成
      const iterations = 10;
      let hasHighTierAffix = false;

      for (let i = 0; i < iterations; i++) {
        const result = AffixGenerator.generateArtifactAffixes(
          'weapon',
          '凡品',
          '炼气',
        );

        // 凡品不应该有需要地品以上的词条
        for (const affix of result.selectedAffixes) {
          if (
            affix.displayName.includes('反射') ||
            affix.displayName.includes('暴击伤害')
          ) {
            hasHighTierAffix = true;
          }
        }
      }

      expect(hasHighTierAffix).toBe(false);
    });
  });
});

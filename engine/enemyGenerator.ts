import {
  ElementType,
  GenderType,
  REALM_STAGE_CAPS,
  RealmStage,
  RealmType,
  SkillType,
  QUALITY_VALUES,
} from '@/types/constants';
import { Cultivator } from '@/types/cultivator';
import { object } from '@/utils/aiClient';
import { randomUUID } from 'crypto';
import { EffectMaterializer } from '@/engine/creation/EffectMaterializer';
import type { MaterializationContext } from '@/engine/creation/types';
import { buildAffixTable } from '@/engine/creation/AffixUtils';
import { getSkillAffixPool } from '@/engine/creation/affixes/skillAffixes';
import type { AffixWeight } from '@/engine/creation/types';
import { EnemyBlueprintSchema, type EnemyBlueprint } from './enemyGenerator/schemas';

// ============================================================
// Helper: Build Skill Affix Selection Prompt for AI
// ============================================================

/**
 * Build the skill affix selection prompt for AI
 * Includes all available affix pools for AI to choose from
 */
function buildSkillAffixPrompt(): string {
  const lines: string[] = [];

  // Get all skill types and their affix pools
  const skillTypes: SkillType[] = ['attack', 'heal', 'control', 'debuff', 'buff'];

  for (const skillType of skillTypes) {
    const pool = getSkillAffixPool(skillType);

    lines.push(`### ${skillType.toUpperCase()} Skill Affixes`);
    lines.push('');

    lines.push('**Primary Affixes (Select exactly 1 per skill):**');
    lines.push('');
    lines.push(buildAffixTable(pool.primary, { showSlots: false, showQuality: true }));
    lines.push('');

    if (pool.secondary.length > 0) {
      lines.push('**Secondary Affixes (Select 0-2 per skill):**');
      lines.push('');
      lines.push(
        buildAffixTable(pool.secondary, { showSlots: false, showQuality: true }),
      );
      lines.push('');
    }
  }

  return lines.join('\n');
}

export class EnemyGenerator {
  /**
   * Determine enemy realm stage based on difficulty
   */
  private getEnemyStageByDifficulty(difficulty: number): RealmStage {
    if (difficulty <= 2) return '初期';
    if (difficulty <= 4) return Math.random() < 0.5 ? '初期' : '中期';
    if (difficulty <= 6) return '中期';
    if (difficulty <= 8) return '后期';
    return '圆满';
  }

  /**
   * Calculate attributes based on realm requirement and difficulty
   */
  private calculateAttributes(
    realmRequirement: RealmType,
    difficulty: number,
  ): {
    vitality: number;
    spirit: number;
    wisdom: number;
    speed: number;
    willpower: number;
  } {
    const stage = this.getEnemyStageByDifficulty(difficulty);
    const baseCap = REALM_STAGE_CAPS[realmRequirement][stage];

    // Random value between 80%-100% of cap
    const minRatio = 0.8;
    const maxRatio = 1.0;

    const randomInRange = () =>
      Math.floor(baseCap * (minRatio + Math.random() * (maxRatio - minRatio)));

    return {
      vitality: randomInRange(),
      spirit: randomInRange(),
      wisdom: randomInRange(),
      speed: randomInRange(),
      willpower: randomInRange(),
    };
  }

  /**
   * Get quality based on difficulty
   */
  private getQualityByDifficulty(difficulty: number): (typeof QUALITY_VALUES)[number] {
    // Map difficulty 1-10 to quality
    if (difficulty <= 3) return '凡品';
    if (difficulty <= 5) return '灵品';
    if (difficulty <= 7) return '真品';
    if (difficulty <= 9) return '玄品';
    return '地品';
  }

  /**
   * Calculate skill cooldown based on type and difficulty
   */
  private calculateCooldown(skillType: SkillType, difficulty: number): number {
    // Attack skills have no cooldown by default
    if (skillType === 'attack') return 0;

    // Other skills: higher difficulty = shorter cooldown (stronger skills)
    const baseCooldown = { heal: 3, control: 4, debuff: 3, buff: 4 }[skillType];
    return Math.max(1, baseCooldown - Math.floor(difficulty / 3));
  }

  /**
   * Calculate skill cost (mana) based on type and difficulty
   */
  private calculateCost(skillType: SkillType, difficulty: number): number {
    // Higher difficulty = more mana cost
    const baseCost = { attack: 10, heal: 15, control: 20, debuff: 15, buff: 20 }[skillType];
    return baseCost + difficulty * 5;
  }

  /**
   * Calculate spiritual root strength based on realm and difficulty
   */
  private calculateSpiritualRootStrength(
    realmRequirement: RealmType,
    difficulty: number,
  ): number {
    // Base strength by realm
    const baseStrength: Record<RealmType, number> = {
      炼气: 30,
      筑基: 50,
      金丹: 70,
      元婴: 85,
      化神: 90,
      炼虚: 95,
      合体: 97,
      大乘: 98,
      渡劫: 99,
    };

    const base = baseStrength[realmRequirement] || 30;
    const diffBonus = difficulty * 2;

    return Math.min(100, base + diffBonus);
  }

  /**
   * Generate enemy blueprint using AI
   * AI only selects affix IDs, system calculates all values
   */
  private async generateBlueprint(
    difficulty: number,
    realmRequirement: RealmType,
    metadata: { enemy_name?: string; is_boss?: boolean },
  ): Promise<EnemyBlueprint> {
    const prompt = `
# Role: 敌人生成器 (Enemy Generator)

## 任务
根据副本信息生成敌人蓝图。**你只需要选择词条ID，不需要生成任何数值**。

## 上下文
- 境界门槛: ${realmRequirement}
- 目标敌人: ${metadata.enemy_name || '未知道友'}
- 难度系数: ${difficulty} (1-10)
- 是否BOSS: ${metadata.is_boss ? '是' : '否'}

## 生成规则
1. **名字和描述**: 生成符合《凡人修仙传》世界观的敌人
2. **灵根**: 选择1-3个元素，强度由系统计算
3. **技能设计**: 生成 2-4 个技能
   - 为每个技能从下方的词条池中选择 **1个主词条** (primary_affix_id)
   - 可选选择 0-2 个副词条 (secondary_affix_ids)
   - 只填写词条ID（如 skill_attack_base_damage），不要填写数值
4. **法宝**: BOSS可以有法宝，普通敌人可选

## 技能词条池
${buildSkillAffixPrompt()}

## 示例格式
\`\`\`json
{
  "name": "烈火老祖",
  "title": "火焰山守护者",
  "gender": "男",
  "description": "身披红色长袍，周身火焰缭绕，气息炽热逼人",
  "spiritual_roots": [{"element": "火"}],
  "skill_blueprints": [
    {
      "name": "烈焰掌",
      "type": "attack",
      "element": "火",
      "primary_affix_id": "skill_attack_base_damage",
      "secondary_affix_ids": ["skill_attack_s_element_bonus"]
    }
  ],
  "equipped_weapon_name": "赤炎剑"
}
\`\`\`
`;

    console.log('[EnemyGenerator] Generating enemy blueprint with AI');

    const result = await object(prompt, JSON.stringify({ difficulty, realmRequirement, metadata }), {
      schema: EnemyBlueprintSchema,
      schemaName: 'EnemyBlueprint',
    });

    return result.object;
  }

  /**
   * Use AI to generate enemy blueprint, calculate stats algorithmically.
   */
  async generate(
    metadata: {
      enemy_name?: string;
      is_boss?: boolean;
    },
    difficulty: number,
    realmRequirement: RealmType,
  ): Promise<Cultivator> {
    // 1. AI generates blueprint (only selects affix IDs, no numerical values)
    const blueprint = await this.generateBlueprint(difficulty, realmRequirement, metadata);

    // 2. Calculate attributes using algorithm
    const stage = this.getEnemyStageByDifficulty(difficulty);
    const attributes = this.calculateAttributes(realmRequirement, difficulty);

    // 3. Build materialization context for skill effects
    const quality = this.getQualityByDifficulty(difficulty);
    const matContext: MaterializationContext = {
      realm: realmRequirement,
      quality,
      element: blueprint.skill_blueprints[0]?.element || '无',
    };

    // 4. Materialize skills using EffectMaterializer
    const skills = blueprint.skill_blueprints.map((bp) => {
      const affixPool = getSkillAffixPool(bp.type as SkillType);

      // Validate and get primary affix
      const primaryAffix = affixPool.primary.find((a) => a.id === bp.primary_affix_id);
      if (!primaryAffix) {
        console.warn(`[EnemyGenerator] Primary affix not found: ${bp.primary_affix_id}, using default`);
        // Fallback to first primary affix
        const fallback = affixPool.primary[0];
        return {
          id: randomUUID(),
          name: bp.name,
          element: bp.element as ElementType,
          cooldown: this.calculateCooldown(bp.type as SkillType, difficulty),
          cost: this.calculateCost(bp.type as SkillType, difficulty),
          effects: EffectMaterializer.materializeAll([fallback], matContext),
        };
      }

      // Get secondary affixes
      const secondaryAffixes = (bp.secondary_affix_ids || [])
        .map((id) => affixPool.secondary.find((a) => a.id === id))
        .filter((affix): affix is NonNullable<typeof affix> => affix !== undefined);

      // Materialize all affixes into effects
      const effects = EffectMaterializer.materializeAll(
        [primaryAffix, ...secondaryAffixes],
        matContext,
      );

      return {
        id: randomUUID(),
        name: bp.name,
        element: bp.element as ElementType,
        cooldown: this.calculateCooldown(bp.type as SkillType, difficulty),
        cost: this.calculateCost(bp.type as SkillType, difficulty),
        effects,
      };
    });

    // 5. Build enemy cultivator
    const enemy: Cultivator = {
      id: `enemy-${randomUUID()}`,
      name: blueprint.name,
      title: blueprint.title,
      gender: blueprint.gender as GenderType,
      realm: realmRequirement,
      realm_stage: stage,
      age: 100 + Math.floor(Math.random() * 200),
      lifespan: 1000,
      attributes: attributes,
      spiritual_roots: blueprint.spiritual_roots.map((r) => ({
        element: r.element as ElementType,
        strength: this.calculateSpiritualRootStrength(realmRequirement, difficulty),
      })),
      pre_heaven_fates: [],
      cultivations: [],
      skills: skills,
      max_skills: 10,
      spirit_stones: Math.floor(Math.random() * 100 * difficulty),
      inventory: {
        artifacts: [],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: null,
        armor: null,
        accessory: null,
      },
      background: blueprint.description,
    };

    // 6. Handle weapon/artifact if specified
    if (blueprint.equipped_weapon_name) {
      const weaponId = randomUUID();
      enemy.inventory.artifacts.push({
        id: weaponId,
        name: blueprint.equipped_weapon_name,
        slot: 'weapon',
        element: blueprint.skill_blueprints[0]?.element || '无',
        quality: quality,
        effects: [],
      });
      enemy.equipped.weapon = weaponId;
    }

    return enemy;
  }
}

export const enemyGenerator = new EnemyGenerator();

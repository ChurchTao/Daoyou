import {
  ElementType,
  GenderType,
  REALM_STAGE_CAPS,
  RealmStage,
  RealmType,
  SkillType,
  StatusEffect,
} from '@/types/constants';
import { Cultivator } from '@/types/cultivator';
import { object } from '@/utils/aiClient';
import { randomUUID } from 'crypto';
import { z } from 'zod';

// Zod Schema for AI Generation - 只生成文本描述
const EnemyTextSchema = z.object({
  name: z.string().describe('敌人的名字'),
  title: z.string().optional().describe('称号，如"烈火老祖"'),
  gender: z.enum(['男', '女']).describe('性别'),
  spiritual_roots: z.array(
    z.object({
      element: z
        .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
        .describe('属性'),
      // 移除 strength 字段，由算法计算
    }),
  ),
  skills: z.array(
    z.object({
      name: z.string().describe('技能名称'),
      type: z.enum(['attack', 'heal', 'control', 'debuff', 'buff']),
      element: z.enum(['金', '木', '水', '火', '土', '风', '雷', '冰']),
      // 移除 power, cooldown, cost 字段，由算法计算
      effect: z
        .enum([
          'burn',
          'bleed',
          'poison',
          'stun',
          'silence',
          'root',
          'armor_up',
          'speed_up',
          'crit_rate_up',
          'armor_down',
          'crit_rate_down',
        ])
        .optional()
        .describe('附带效果'),
    }),
  ),
  equipped_weapon_name: z.string().optional().describe('装备的法宝名称'),
  description: z.string().describe('外貌或气息描述'),
});

export class EnemyGenerator {
  /**
   * 根据难度系数确定敌人境界阶段
   */
  private getEnemyStageByDifficulty(difficulty: number): RealmStage {
    if (difficulty <= 2) return '初期';
    if (difficulty <= 4) return Math.random() < 0.5 ? '初期' : '中期';
    if (difficulty <= 6) return '中期';
    if (difficulty <= 8) return '后期';
    return '圆满';
  }

  /**
   * 基于境界门槛和难度计算属性
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

    // 在上限的 80%-100% 范围内随机
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
   * 计算技能数值
   */
  private calculateSkillPower(
    difficulty: number,
    skillType: SkillType,
  ): { power: number; cooldown: number; cost: number } {
    // 基础威力（按技能类型）
    const basePower = {
      attack: 60,
      buff: 30,
      debuff: 30,
      heal: 50,
      control: 40,
    }[skillType];

    // 难度加成（1-10 → +10 到 +100）
    const diffBonus = difficulty * 10;

    const finalPower = basePower + diffBonus;

    return {
      power: finalPower,
      cooldown: skillType === 'attack' ? 0 : Math.ceil(difficulty / 3),
      cost: Math.floor(finalPower * 0.3),
    };
  }

  /**
   * 计算灵根强度
   */
  private calculateSpiritualRootStrength(
    realmRequirement: RealmType,
    difficulty: number,
  ): number {
    // 基于境界的基础强度
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

    // 难度加成
    const diffBonus = difficulty * 2;

    return Math.min(100, base + diffBonus);
  }

  /**
   * Use AI to generate enemy text descriptions, calculate stats algorithmically.
   */
  async generate(
    metadata: {
      enemy_name?: string;
      is_boss?: boolean;
    },
    difficulty: number,
    realmRequirement: RealmType, // 新增：地图境界门槛
  ): Promise<Cultivator> {
    const prompt = `
# Role: 修仙界敌人生成器

## 任务
根据副本信息生成敌人的**文本描述**（数值由系统自动计算）

## 上下文
- 境界门槛: ${realmRequirement}
- 目标敌人: ${metadata.enemy_name || '未知道友'}
- 难度系数: ${difficulty} (1-10)
- 是否BOSS: ${metadata.is_boss ? '是' : '否'}

## 生成规则
1. **名字和描述**: 生成符合《凡人修仙传》世界观的敌人
2. **技能设计**: 生成 2-4 个技能的**名称、类型、元素**
3. **不要生成任何数值**（属性、威力、强度等由系统计算）
4. **如果是BOSS**，可以有更华丽的称号和描述
    `;

    console.log('[EnemyGenerator] 生成敌人文本描述');

    try {
      const result = await object(prompt, '请按照要求生成一个敌人的文本描述', {
        schema: EnemyTextSchema,
        schemaName: 'EnemyText',
      });

      const textData = result.object;

      // 使用算法计算数值
      const stage = this.getEnemyStageByDifficulty(difficulty);
      const attributes = this.calculateAttributes(realmRequirement, difficulty);

      // Map to System Cultivator Type
      const enemy: Cultivator = {
        id: `enemy-${randomUUID()}`,
        name: textData.name,
        title: textData.title,
        gender: textData.gender as GenderType,
        realm: realmRequirement, // 使用地图境界门槛
        realm_stage: stage, // 由难度计算
        age: 100 + Math.floor(Math.random() * 200),
        lifespan: 1000,
        attributes: attributes, // 算法生成
        spiritual_roots: textData.spiritual_roots.map((r) => ({
          element: r.element as ElementType,
          strength: this.calculateSpiritualRootStrength(
            realmRequirement,
            difficulty,
          ),
        })),
        pre_heaven_fates: [],
        cultivations: [],
        skills: textData.skills.map((s) => {
          const skillPower = this.calculateSkillPower(
            difficulty,
            s.type as SkillType,
          );
          return {
            id: randomUUID(),
            name: s.name,
            type: s.type as SkillType,
            element: s.element as ElementType,
            power: skillPower.power,
            cooldown: skillPower.cooldown,
            cost: skillPower.cost,
            effect: s.effect as StatusEffect,
            duration: s.effect ? 2 : 0,
          };
        }),
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
        background: textData.description,
      };

      // Handle Weapon/Artifact if generated
      if (textData.equipped_weapon_name) {
        const weaponId = randomUUID();
        enemy.inventory.artifacts.push({
          id: weaponId,
          name: textData.equipped_weapon_name,
          slot: 'weapon',
          element: textData.skills[0]?.element || '无',
          quality: '灵品', // Default
          bonus: {},
        });
        enemy.equipped.weapon = weaponId;
      }

      return enemy;
    } catch (error) {
      console.error(
        'Failed to generate enemy with AI, falling back to basic.',
        error,
      );
      throw error;
    }
  }
}

export const enemyGenerator = new EnemyGenerator();

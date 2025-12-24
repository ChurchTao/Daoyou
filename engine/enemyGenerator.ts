import { PlayerInfo } from '@/lib/dungeon/types';
import {
  ElementType,
  GenderType,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  RealmStage,
  RealmType,
  SkillType,
  StatusEffect,
} from '@/types/constants';
import { Cultivator } from '@/types/cultivator';
import { object } from '@/utils/aiClient';
import { randomUUID } from 'crypto';
import { z } from 'zod';

// Zod Schema for AI Generation
const EnemyCSchema = z.object({
  name: z.string().describe('敌人的名字'),
  title: z.string().optional().describe('称号，如“烈火老祖”'),
  gender: z.enum(['男', '女']).describe('性别'),
  realm: z.enum(REALM_VALUES).describe('大境界'),
  realm_stage: z.enum(REALM_STAGE_VALUES).describe('小境界'),
  attributes: z.object({
    vitality: z.number().describe('体魄'),
    spirit: z.number().describe('灵力'),
    wisdom: z.number().describe('悟性'),
    speed: z.number().describe('速度'),
    willpower: z.number().describe('神识'),
  }),
  spiritual_roots: z.array(
    z.object({
      element: z
        .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
        .describe('属性'),
      strength: z.number().describe('强度 1-100'),
    }),
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['attack', 'heal', 'control', 'debuff', 'buff']),
      element: z.enum(['金', '木', '水', '火', '土', '风', '雷', '冰']),
      power: z.number().describe('威力 30-200'),
      cooldown: z.number().describe('冷却回合'),
      cost: z.number().describe('消耗'),
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
   * Use AI to generate a detailed enemy based on metadata and player info.
   */
  async generate(
    metadata: {
      enemy_name?: string;
      enemy_realm?: string;
      enemy_stage?: string;
      is_boss?: boolean;
    },
    difficulty: number,
    playerInfo: PlayerInfo,
  ): Promise<Cultivator> {
    const prompt = `
# Role: 修仙界敌人生成器

## 任务
根据玩家信息和副本描述，生成一个合理的敌人数据。

## 上下文
- 玩家境界: ${playerInfo.realm}
- 玩家属性参考: 
    体魄${playerInfo.attributes.vitality}
    灵力${playerInfo.attributes.spirit}
    速度${playerInfo.attributes.speed}
    神识${playerInfo.attributes.willpower}
    悟性${playerInfo.attributes.wisdom}
- 目标敌人描述: ${metadata.enemy_name || '未知道友'}
- 目标境界: ${metadata.enemy_realm || '同境界'} ${metadata.enemy_stage || ''}
- 难度系数: ${difficulty} (1-10)

## 生成规则
1. **属性平衡**: 如果难度>5，敌人的主要属性应略高于玩家；如果难度<5，应略低。
2. **技能设计**: 必须生成 2-4 个技能，包含攻击、增益、治疗、控制、异常技能。如果难度>5，拥有4个技能，且威力更大。
3. **法宝**: 如果是 Boss (is_boss=${
      metadata.is_boss
    })，必须有一个强力法宝作为武器。
4. **合理性**: 境界必须符合《凡人修仙传》体系。
    `;

    console.log('[生成敌人 prompt]', prompt);

    try {
      const result = await object(prompt, '请按照要求生成一个敌人', {
        schema: EnemyCSchema,
        schemaName: 'EnemyData',
      });

      const data = result.object;

      // Map to System Cultivator Type
      const enemy: Cultivator = {
        id: `enemy-${randomUUID()}`,
        name: data.name,
        title: data.title,
        gender: data.gender as GenderType,
        realm: data.realm as RealmType,
        realm_stage: data.realm_stage as RealmStage,
        age: 100 + Math.floor(Math.random() * 200),
        lifespan: 1000,
        attributes: data.attributes,
        spiritual_roots: data.spiritual_roots.map((r) => ({
          element: r.element as ElementType,
          strength: r.strength,
        })),
        pre_heaven_fates: [],
        cultivations: [],
        skills: data.skills.map((s) => ({
          id: randomUUID(),
          name: s.name,
          type: s.type as SkillType,
          element: s.element as ElementType,
          power: s.power,
          cooldown: s.cooldown,
          cost: s.cost,
          effect: s.effect as StatusEffect,
          duration: s.effect ? 2 : 0,
        })),
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
        background: data.description,
      };

      // Handle Weapon/Artifact if generated
      if (data.equipped_weapon_name) {
        const weaponId = randomUUID();
        enemy.inventory.artifacts.push({
          id: weaponId,
          name: data.equipped_weapon_name,
          slot: 'weapon',
          element: data.skills[0]?.element || '无',
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

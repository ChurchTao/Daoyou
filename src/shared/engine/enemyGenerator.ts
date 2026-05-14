/**
 * 敌人生成器（v2 迁移版）
 *
 * 为副本/练功房场景动态生成敌人 Cultivator，直接产出 v5 战斗引擎可消费的
 * AbilityConfig 技能链。暂时使用算法规则生成基础攻击/治疗/控制技能，
 * 后续可替换为调用 CreationOrchestrator 走完整的造物流程。
 */

import { AbilityType } from '@shared/engine/battle-v5/core/types';
import type { AbilityConfig } from '@shared/engine/battle-v5/core/configs';
import {
  ElementType,
  GenderType,
  REALM_STAGE_CAPS,
  RealmStage,
  RealmType,
  SkillType,
} from '@shared/types/constants';
import { Cultivator } from '@shared/types/cultivator';
import { randomUUID } from 'crypto';

interface EnemyBlueprint {
  name: string;
  title?: string;
  gender: GenderType;
  description?: string;
  skills: SkillBlueprint[];
  spiritualElement: ElementType;
}

interface SkillBlueprint {
  name: string;
  type: SkillType;
  element: ElementType;
}

const ATTACK_NAMES = [
  '烈焰掌',
  '裂空斩',
  '青木剑诀',
  '玄水指',
  '金刚拳',
  '雷霆劈',
  '冰凌刃',
];
const HEAL_NAMES = ['回春诀', '灵润术', '生生造化'];
const BUFF_NAMES = ['金刚不坏', '御风诀', '凝神术'];

const ELEMENT_POOL: ElementType[] = [
  '金',
  '木',
  '水',
  '火',
  '土',
  '风',
  '雷',
  '冰',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function realmFriendlyName(stage: RealmStage, realm: RealmType): string {
  return `${realm}${stage}散修`;
}

export class EnemyGenerator {
  private getEnemyStageByDifficulty(difficulty: number): RealmStage {
    if (difficulty <= 2) return '初期';
    if (difficulty <= 4) return Math.random() < 0.5 ? '初期' : '中期';
    if (difficulty <= 6) return '中期';
    if (difficulty <= 8) return '后期';
    return '圆满';
  }

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

  private calculateSpiritualRootStrength(
    realmRequirement: RealmType,
    difficulty: number,
  ): number {
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
    return Math.min(100, base + difficulty * 2);
  }

  /**
   * 根据技能类型构造最小可运行的 AbilityConfig。
   * 后续 Phase 2 会替换为 CreationOrchestrator 产出的完整 AbilityConfig。
   */
  private buildAbilityConfig(
    bp: SkillBlueprint,
    difficulty: number,
  ): AbilityConfig {
    const slug = `enemy-${bp.type}-${randomUUID()}`;
    const cooldown =
      bp.type === 'attack' ? 0 : Math.max(1, 4 - Math.floor(difficulty / 3));
    const mpCost =
      bp.type === 'attack'
        ? 10 + difficulty * 5
        : 15 + difficulty * 5;

    if (bp.type === 'heal') {
      return {
        slug,
        name: bp.name,
        type: AbilityType.ACTIVE_SKILL,
        tags: ['heal'],
        mpCost,
        cooldown,
        targetPolicy: { team: 'self', scope: 'single' },
        effects: [
          {
            type: 'heal',
            params: {
              value: { base: 30 + difficulty * 10 },
              target: 'hp',
            },
          },
        ],
      };
    }

    return {
      slug,
      name: bp.name,
      type: AbilityType.ACTIVE_SKILL,
      tags: [bp.type, bp.element],
      mpCost,
      cooldown,
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 15 + difficulty * 5,
              coefficient: 1 + difficulty * 0.1,
            },
          },
        },
      ],
    };
  }

  private generateBlueprint(
    difficulty: number,
    metadata: { enemy_name?: string; is_boss?: boolean },
  ): EnemyBlueprint {
    const primaryElement = pick(ELEMENT_POOL);
    const skillCount = metadata.is_boss ? 4 : 2 + (difficulty > 5 ? 1 : 0);
    const skills: SkillBlueprint[] = [];

    for (let i = 0; i < skillCount; i++) {
      if (i === 0) {
        skills.push({
          name: pick(ATTACK_NAMES),
          type: 'attack',
          element: primaryElement,
        });
      } else if (i === 1 && metadata.is_boss) {
        skills.push({
          name: pick(HEAL_NAMES),
          type: 'heal',
          element: primaryElement,
        });
      } else {
        skills.push({
          name: pick(BUFF_NAMES),
          type: 'buff',
          element: primaryElement,
        });
      }
    }

    return {
      name: metadata.enemy_name || '散修',
      gender: Math.random() < 0.5 ? '男' : '女',
      spiritualElement: primaryElement,
      skills,
    };
  }

  async generate(
    metadata: { enemy_name?: string; is_boss?: boolean },
    difficulty: number,
    realmRequirement: RealmType,
  ): Promise<Cultivator> {
    const blueprint = this.generateBlueprint(difficulty, metadata);
    const stage = this.getEnemyStageByDifficulty(difficulty);
    const attributes = this.calculateAttributes(realmRequirement, difficulty);

    const skills = blueprint.skills.map((bp) => ({
      id: randomUUID(),
      name: bp.name,
      element: bp.element,
      cost:
        bp.type === 'attack' ? 10 + difficulty * 5 : 15 + difficulty * 5,
      cooldown:
        bp.type === 'attack' ? 0 : Math.max(1, 4 - Math.floor(difficulty / 3)),
      abilityConfig: this.buildAbilityConfig(bp, difficulty),
    }));

    return {
      id: `enemy-${randomUUID()}`,
      name: blueprint.name || realmFriendlyName(stage, realmRequirement),
      title: blueprint.title,
      gender: blueprint.gender,
      realm: realmRequirement,
      realm_stage: stage,
      age: 100 + Math.floor(Math.random() * 200),
      lifespan: 1000,
      attributes,
      spiritual_roots: [
        {
          element: blueprint.spiritualElement,
          strength: this.calculateSpiritualRootStrength(
            realmRequirement,
            difficulty,
          ),
        },
      ],
      pre_heaven_fates: [],
      cultivations: [],
      skills,
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
  }
}

export const enemyGenerator = new EnemyGenerator();

import {
  SKILL_GRADE_VALUES,
  SpiritualRootGrade,
  type ElementType,
  type RealmStage,
  type RealmType,
  type SkillGrade,
} from '../types/constants';
import type {
  Attributes,
  CultivationTechnique,
  Cultivator,
  Skill,
  SpiritualRoot,
} from '../types/cultivator';
import { getRealmStageAttributeCap } from './cultivatorUtils';

export interface BalanceAdjustedCultivator {
  cultivator: Cultivator;
  balanceNotes: string[];
}

/**
 * 角色生成引擎
 * 用于系统性限制和验证角色生成
 */

// 品阶威力范围定义（技能）
export const SKILL_POWER_RANGES: Record<
  SkillGrade,
  { min: number; max: number }
> = {
  天阶上品: { min: 130, max: 150 },
  天阶中品: { min: 115, max: 135 },
  天阶下品: { min: 100, max: 120 },
  地阶上品: { min: 85, max: 105 },
  地阶中品: { min: 70, max: 90 },
  地阶下品: { min: 55, max: 75 },
  玄阶上品: { min: 50, max: 70 },
  玄阶中品: { min: 40, max: 60 },
  玄阶下品: { min: 30, max: 50 },
  黄阶上品: { min: 30, max: 45 },
  黄阶中品: { min: 30, max: 40 },
  黄阶下品: { min: 30, max: 35 },
};

// 品阶增幅范围定义（功法）
export const CULTIVATION_BONUS_RANGES: Record<
  SkillGrade,
  { min: number; max: number }
> = {
  天阶上品: { min: 20, max: 30 },
  天阶中品: { min: 15, max: 25 },
  天阶下品: { min: 10, max: 20 },
  地阶上品: { min: 8, max: 15 },
  地阶中品: { min: 5, max: 12 },
  地阶下品: { min: 3, max: 10 },
  玄阶上品: { min: 2, max: 8 },
  玄阶中品: { min: 1, max: 6 },
  玄阶下品: { min: 0, max: 5 },
  黄阶上品: { min: 0, max: 3 },
  黄阶中品: { min: 0, max: 2 },
  黄阶下品: { min: 0, max: 1 },
};

/**
 * 限制最高境界为筑基后期
 */
export function limitRealmToFoundation(
  realm: RealmType,
  realmStage: RealmStage,
): { realm: RealmType; realmStage: RealmStage } {
  if (realm === '筑基' && (realmStage === '后期' || realmStage === '圆满')) {
    return { realm: '筑基', realmStage: '后期' };
  }
  if (realm === '筑基') {
    return { realm, realmStage };
  }
  // 如果超过筑基，降级到筑基后期
  return { realm: '筑基', realmStage: '后期' };
}

/**
 * 验证属性总和不超过所有属性上限总和的80%
 */
export function validateAttributeBalance(
  attributes: Attributes,
  realm: RealmType,
  realmStage: RealmStage = '后期',
): boolean {
  const cap = getRealmStageAttributeCap(realm, realmStage);
  const totalCap = cap * 5; // 5个属性
  const totalAttributes =
    attributes.vitality +
    attributes.spirit +
    attributes.wisdom +
    attributes.speed +
    attributes.willpower;
  const maxTotal = totalCap * 0.8;
  return totalAttributes <= maxTotal;
}

/**
 * 调整属性使其符合平衡要求
 */
export function adjustAttributesToBalance(
  attributes: Attributes,
  realm: RealmType,
  realmStage: RealmStage,
  notes: string[],
): Attributes {
  const cap = getRealmStageAttributeCap(realm, realmStage);
  const totalCap = cap * 5;
  const maxTotal = totalCap * 0.8;
  const currentTotal =
    attributes.vitality +
    attributes.spirit +
    attributes.wisdom +
    attributes.speed +
    attributes.willpower;

  if (currentTotal <= maxTotal) {
    return attributes;
  }

  // 按比例缩放所有属性
  const scale = maxTotal / currentTotal;
  notes.push('天道削弱：基础属性总和过高，已整体压制至上限的80%。');
  return {
    vitality: Math.round(attributes.vitality * scale),
    spirit: Math.round(attributes.spirit * scale),
    wisdom: Math.round(attributes.wisdom * scale),
    speed: Math.round(attributes.speed * scale),
    willpower: Math.round(attributes.willpower * scale),
  };
}

/**
 * 确定灵根品阶并限制强度
 */
export function determineSpiritualRootGrade(
  roots: SpiritualRoot[],
): SpiritualRoot[] {
  const variantElements: ElementType[] = ['雷', '风', '冰'];
  const rootCount = roots.length;

  return roots.map((root) => {
    const isVariant = variantElements.includes(root.element);
    let grade: SpiritualRootGrade;
    let minStrength: number;
    let maxStrength: number;

    if (isVariant) {
      // 变异灵根都是单灵根 = 天灵根
      grade = '变异灵根';
      minStrength = 70;
      maxStrength = 95;
    } else if (rootCount === 1) {
      // 单灵根 = 天灵根
      grade = '天灵根';
      minStrength = 70;
      maxStrength = 90;
    } else if (rootCount === 2) {
      // 双灵根 = 真灵根
      grade = '真灵根';
      minStrength = 50;
      maxStrength = 80;
    } else {
      // 三/四灵根 = 伪灵根
      grade = '伪灵根';
      minStrength = 30;
      maxStrength = 60;
    }

    // 限制强度在范围内
    const strength = Math.max(
      minStrength,
      Math.min(maxStrength, root.strength),
    );

    return {
      ...root,
      grade,
      strength,
    };
  });
}

/**
 * 验证技能威力是否符合品阶范围
 */
export function validateSkillPower(skill: Skill): boolean {
  if (!skill.grade) return true; // 如果没有品阶，不验证
  const range = SKILL_POWER_RANGES[skill.grade];
  if (!range) return true;
  return skill.power >= range.min && skill.power <= range.max;
}

/**
 * 调整技能威力使其符合品阶范围
 */
export function adjustSkillPower(skill: Skill): Skill {
  if (!skill.grade) return skill;
  const range = SKILL_POWER_RANGES[skill.grade];
  if (!range) return skill;

  const adjustedPower = Math.max(range.min, Math.min(range.max, skill.power));

  return {
    ...skill,
    power: adjustedPower,
  };
}

/**
 * 验证功法增幅是否符合品阶范围
 */
export function validateCultivationBonus(
  technique: CultivationTechnique,
): boolean {
  if (!technique.grade) return true;
  const range = CULTIVATION_BONUS_RANGES[technique.grade];
  if (!range) return true;

  // 检查所有属性加成是否在范围内
  const bonuses = [
    technique.bonus.vitality,
    technique.bonus.spirit,
    technique.bonus.wisdom,
    technique.bonus.speed,
    technique.bonus.willpower,
  ].filter((b) => b !== undefined && b !== 0) as number[];

  if (bonuses.length === 0) return true;

  // 检查是否有任何加成超出范围
  for (const bonus of bonuses) {
    if (bonus < range.min || bonus > range.max) {
      return false;
    }
  }

  return true;
}

/**
 * 调整功法增幅使其符合品阶范围
 */
export function adjustCultivationBonus(
  technique: CultivationTechnique,
): CultivationTechnique {
  if (!technique.grade) return technique;
  const range = CULTIVATION_BONUS_RANGES[technique.grade];
  if (!range) return technique;

  const adjustedBonus: Partial<Attributes> = {};

  for (const [key, value] of Object.entries(technique.bonus)) {
    if (value !== undefined && value !== 0) {
      const adjustedValue = Math.max(range.min, Math.min(range.max, value));
      adjustedBonus[key as keyof Attributes] = adjustedValue;
    }
  }

  return {
    ...technique,
    bonus: adjustedBonus,
  };
}

interface BalanceParams {
  cultivator: Cultivator;
  attributes: Attributes;
  skills: Skill[];
  cultivations: CultivationTechnique[];
  cap: number;
  notes: string[];
}

function applyHeavenlyBalance({
  cultivator,
  attributes,
  skills,
  cultivations,
  cap,
  notes,
}: BalanceParams): {
  attributes: Attributes;
  skills: Skill[];
  cultivations: CultivationTechnique[];
  notes: string[];
} {
  const totalAttributes =
    attributes.vitality +
    attributes.spirit +
    attributes.wisdom +
    attributes.speed +
    attributes.willpower;
  const attrThreshold = cap * 5 * 0.7;
  const hasSupremeRoot = cultivator.spiritual_roots.some(
    (root) => root.grade === '天灵根' || root.grade === '变异灵根',
  );
  const heavenlySkills = skills.filter(
    (skill) => skill.grade && skill.grade.startsWith('天阶'),
  );
  const heavenlyCultivations = cultivations.filter(
    (cult) => cult.grade && cult.grade.startsWith('天阶'),
  );

  let imbalanceScore = 0;
  if (hasSupremeRoot) imbalanceScore += 1;
  if (heavenlySkills.length > 0) imbalanceScore += 1;
  if (heavenlyCultivations.length > 0) imbalanceScore += 1;
  if (totalAttributes > attrThreshold) imbalanceScore += 1;

  const balancedAttributes = { ...attributes };
  let balancedSkills = [...skills];
  let balancedCultivations = [...cultivations];

  if (imbalanceScore >= 2) {
    const reductionPercent = Math.min(0.1 * (imbalanceScore - 1), 0.25);
    const entries = Object.entries(balancedAttributes).sort(
      (a, b) => b[1] - a[1],
    );
    const reduceCount = Math.min(entries.length, imbalanceScore);
    for (let i = 0; i < reduceCount; i += 1) {
      const [key, value] = entries[i];
      const reduced = Math.max(10, Math.round(value * (1 - reductionPercent)));
      (balancedAttributes as Record<string, number>)[key] = reduced;
    }
    notes.push(
      `天道平衡：因顶级天赋过多，最高的 ${reduceCount} 项属性被削弱 ${(
        reductionPercent * 100
      ).toFixed(0)}%`,
    );
  }

  if (heavenlySkills.length > 0 && imbalanceScore >= 2) {
    let downgradeBudget = imbalanceScore - 1;
    balancedSkills = balancedSkills.map((skill) => {
      if (
        downgradeBudget > 0 &&
        skill.grade &&
        skill.grade.startsWith('天阶')
      ) {
        const downgraded = downgradeGrade(skill.grade);
        if (downgraded !== skill.grade) {
          downgradeBudget -= 1;
          notes.push(
            `天道平衡：神通【${skill.name}】被压制为${downgraded}，以免过度强盛。`,
          );
          return adjustSkillPower({
            ...skill,
            grade: downgraded,
          });
        }
      }
      return skill;
    });
  }

  if (heavenlyCultivations.length > 0 && imbalanceScore >= 3) {
    let downgradeBudget = imbalanceScore - 2;
    balancedCultivations = balancedCultivations.map((cult) => {
      if (downgradeBudget > 0 && cult.grade && cult.grade.startsWith('天阶')) {
        const downgraded = downgradeGrade(cult.grade);
        if (downgraded !== cult.grade) {
          downgradeBudget -= 1;
          notes.push(
            `天道平衡：功法【${cult.name}】被压制为${downgraded}，以换取稳定。`,
          );
          return adjustCultivationBonus({
            ...cult,
            grade: downgraded,
          });
        }
      }
      return cult;
    });
  }

  return {
    attributes: balancedAttributes,
    skills: balancedSkills,
    cultivations: balancedCultivations,
    notes,
  };
}

const GRADE_ORDER: SkillGrade[] = [...SKILL_GRADE_VALUES];

function downgradeGrade(grade?: SkillGrade): SkillGrade | undefined {
  if (!grade) return grade;
  const idx = GRADE_ORDER.indexOf(grade);
  if (idx === -1 || idx >= GRADE_ORDER.length - 1) return grade;
  return GRADE_ORDER[idx + 1];
}
/**
 * 验证并修正角色数据
 */
export function validateAndAdjustCultivator(
  cultivator: Cultivator,
): BalanceAdjustedCultivator {
  const balanceNotes: string[] = [];
  // 1. 限制境界
  const { realm, realmStage } = limitRealmToFoundation(
    cultivator.realm,
    cultivator.realm_stage,
  );

  // 2. 调整属性平衡
  const adjustedAttributes = adjustAttributesToBalance(
    cultivator.attributes,
    realm,
    realmStage,
    balanceNotes,
  );

  // 3. 确定灵根品阶并限制强度
  const adjustedRoots = determineSpiritualRootGrade(cultivator.spiritual_roots);

  // 4. 调整技能威力
  const adjustedSkills = cultivator.skills.map((skill) =>
    adjustSkillPower(skill),
  );

  // 5. 调整功法增幅
  const adjustedCultivations = cultivator.cultivations.map((technique) =>
    adjustCultivationBonus(technique),
  );

  const cap = getRealmStageAttributeCap(realm, realmStage);
  const { attributes, skills, cultivations, notes } = applyHeavenlyBalance({
    cultivator: { ...cultivator, spiritual_roots: adjustedRoots },
    attributes: adjustedAttributes,
    skills: adjustedSkills,
    cultivations: adjustedCultivations,
    cap,
    notes: balanceNotes,
  });

  const balancedCultivator: Cultivator = {
    ...cultivator,
    realm,
    realm_stage: realmStage as typeof cultivator.realm_stage,
    attributes,
    spiritual_roots: adjustedRoots,
    skills,
    cultivations,
  };

  return {
    cultivator: balancedCultivator,
    balanceNotes: notes,
  };
}

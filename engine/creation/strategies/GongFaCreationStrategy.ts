/**
 * 功法创建策略
 *
 * 负责生成被动功法（CultivationTechnique）
 */

import { DbTransaction } from '@/lib/drizzle/db';
import { cultivationTechniques } from '@/lib/drizzle/schema';
import type { Quality, RealmType, SkillGrade } from '@/types/constants';
import { QUALITY_VALUES } from '@/types/constants';
import type { CultivationTechnique, Material } from '@/types/cultivator';
import { getGongFaAffixPool } from '../affixes/gongfaAffixes';
import {
  buildAffixTable,
  filterAffixPool,
  materializeAffixesById,
  validateSkillAffixSelection,
} from '../AffixUtils';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  clampGrade,
  GRADE_HINT_TO_GRADES,
  REALM_GRADE_LIMIT,
  calculatePowerRatio,
} from '../skillConfig';
import {
  GongFaBlueprint,
  GongFaBlueprintSchema,
  GradeHint,
  MaterializationContext,
} from '../types';

// 品阶到品质的映射
const GRADE_TO_QUALITY: Record<string, Quality> = {
  黄阶下品: '灵品',
  黄阶中品: '灵品',
  黄阶上品: '玄品',
  玄阶下品: '玄品',
  玄阶中品: '真品',
  玄阶上品: '真品',
  地阶下品: '地品',
  地阶中品: '地品',
  地阶上品: '天品',
  天阶下品: '天品',
  天阶中品: '仙品',
  天阶上品: '神品',
};

export class GongFaCreationStrategy implements CreationStrategy<
  GongFaBlueprint,
  CultivationTechnique
> {
  readonly craftType = 'create_gongfa';

  readonly schemaName = '功法蓝图';

  readonly schemaDescription = '描述功法的名称、品阶和词条选择';

  readonly schema = GongFaBlueprintSchema;

  async validate(context: CreationContext): Promise<void> {
    // 检查是否已有同名功法（可选，暂不强限制，反正名字可以重复）
    // 检查功法数量上限？目前模型似乎没强限制功法数量，但可以限制一下
    if (context.cultivator.cultivations.length >= 10) {
      throw new Error('道友所学功法已达上限，贪多嚼不烂。');
    }

    // 必须包含 manual 类型材料
    const hasManual = context.materials.some((m) => m.type === 'manual');
    if (!hasManual) {
      throw new Error('参悟功法需消耗功法典籍或残页(type=manual)');
    }
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, userPrompt, materials } = context;

    // 构建灵根信息
    const spiritualRootsDesc = cultivator.spiritual_roots
      .map((r) => `${r.element}(强度${r.strength})`)
      .join('、');

    // 计算最高灵根强度
    const maxRootStrength = cultivator.spiritual_roots.length > 0
      ? Math.max(...cultivator.spiritual_roots.map(r => r.strength))
      : 0;

    const realm = cultivator.realm as RealmType;

    // 计算基于材料的品质基准
    const materialQuality = this.calculateMaterialQuality(materials);
    const estimatedQuality = this.estimateQuality(
      realm,
      materialQuality,
    );
    const affixPrompts = this.buildAffixPrompts(estimatedQuality);

    const systemPrompt = `
# Role: 藏经阁长老 - 功法蓝图设计

你是一位博览群书的藏经阁长老，负责根据提供的残页或典籍复原或推演功法。

## 核心指令
**必须完全基于用户提供的【核心材料】（功法残页/典籍）来设计功法。**
功法的名称、描述、特性应与材料描述紧密相关。
例如：使用了"烈火残页"，功法应当与火系、燃烧相关。

## 重要约束

> ⚠️ **你需要从词条池中选择词条ID，程序会自动计算数值！**
> 功法主要提供被动属性加成（如增加体魄、灵力、暴击率等）。
> 数值由修士境界、灵根强度及**材料品质**决定，你只需选择合适的词条。

## 输出格式（严格遵守）

只输出一个符合 JSON Schema 的纯 JSON 对象。

### 词条选择
请根据功法名称和描述，从下方词条池中选择最合适的主词条（必选）和副词条（可选）。

## 当前推演条件
- **核心材料品质**: ${materialQuality} (影响最终品阶下限)
- **修士境界**: ${realm}
- **灵根**: ${spiritualRootsDesc}
- **最高灵根强度**: ${maxRootStrength}
- **预估品质**: ${estimatedQuality}

${affixPrompts}

## 命名与描述
- 名称：2-8字，必须源自材料描述，古风，如"长春功"、"九转金身诀"。
- 描述：简述功法来历或修炼效果，必须体现材料的特性。

## 输出示例
{
  "name": "烈火诀",
  "grade_hint": "medium",
  "description": "基于烈火残页推演而出，采地火之气修炼，可大幅增强灵力。",
  "selected_affixes": {
    "primary": "gongfa_spirit",
    "secondary": "gongfa_crit_rate"
  }
}
`;

    const userPromptText = `
请为以下修士推演功法蓝图：

<cultivator>
  <realm>${cultivator.realm}</realm>
  <spiritual_roots>${spiritualRootsDesc}</spiritual_roots>
</cultivator>

<materials_used>
${context.materials
  .filter((m) => m.type === 'manual')
  .map((m) => `- ${m.name}(${m.rank}): ${m.description || '无描述'}`)
  .join('\n')}
</materials_used>

<user_intent>
${userPrompt || '无（自由发挥，但必须基于材料）'}
</user_intent>
`;

    return {
      system: systemPrompt,
      user: userPromptText,
    };
  }

  materialize(
    blueprint: GongFaBlueprint,
    context: CreationContext,
  ): CultivationTechnique {
    const realm = context.cultivator.realm as RealmType;

    // 计算最高灵根强度
    const maxRootStrength = context.cultivator.spiritual_roots.length > 0
      ? Math.max(...context.cultivator.spiritual_roots.map(r => r.strength))
      : 0;

    // 1. 确定品阶
    // 引入材料品质影响
    const materialQuality = this.calculateMaterialQuality(context.materials);
    const grade = this.calculateGrade(
      blueprint.grade_hint,
      realm,
      materialQuality,
      maxRootStrength,
    );
    const quality = GRADE_TO_QUALITY[grade] || '玄品';

    // 2. 获取词条池
    const affixPool = getGongFaAffixPool();

    // 3. 校验词条
    const validation = validateSkillAffixSelection(
      blueprint.selected_affixes.primary,
      blueprint.selected_affixes.secondary,
      affixPool.primary,
      affixPool.secondary,
      quality,
    );

    if (!validation.valid) {
      console.warn('功法词条校验警告:', validation.errors);
    }

    // 4. 数值化
    const matContext: MaterializationContext = {
      realm,
      quality,
      spiritualRootStrength: maxRootStrength,
      hasMatchingElement: true, // 功法不依赖特定元素
      skillGrade: grade,
    };

    const primaryEffects = materializeAffixesById(
      [blueprint.selected_affixes.primary],
      affixPool.primary,
      matContext,
    );

    const secondaryEffects =
      blueprint.selected_affixes.secondary && affixPool.secondary.length > 0
        ? materializeAffixesById(
            [blueprint.selected_affixes.secondary],
            affixPool.secondary,
            matContext,
          )
        : [];

    const effects = [...primaryEffects, ...secondaryEffects];

    return {
      name: blueprint.name,
      grade,
      required_realm: realm, // 默认当前境界可学
      effects,
    };
  }

  async persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: CultivationTechnique,
  ): Promise<void> {
    await tx.insert(cultivationTechniques).values({
      cultivatorId: context.cultivator.id!,
      name: resultItem.name,
      grade: resultItem.grade,
      required_realm: resultItem.required_realm,
      effects: resultItem.effects ?? [],
    });
  }

  // ============ 辅助方法 ============

  private calculateMaterialQuality(materials: Material[]): Quality {
    const manuals = materials.filter((m) => m.type === 'manual');
    if (manuals.length === 0) return '凡品';

    // 取最高品质
    let maxIndex = 0;
    for (const mat of manuals) {
      const index = QUALITY_VALUES.indexOf(mat.rank);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
    return QUALITY_VALUES[maxIndex];
  }

  private estimateQuality(
    realm: RealmType,
    materialQuality: Quality,
  ): Quality {
    const realmIndex = [
      '炼气',
      '筑基',
      '金丹',
      '元婴',
      '化神',
      '炼虚',
      '合体',
      '大乘',
      '渡劫',
    ].indexOf(realm);

    // 基础品质由境界决定
    let baseIndex = Math.min(realmIndex + 1, QUALITY_VALUES.length - 1);

    // 材料品质修正：如果材料品质高于当前境界预估，则提升预估品质
    const matIndex = QUALITY_VALUES.indexOf(materialQuality);
    if (matIndex > baseIndex) {
      baseIndex = Math.floor((baseIndex + matIndex) / 2); // 取折中
    }

    return QUALITY_VALUES[baseIndex];
  }

  private buildAffixPrompts(quality: Quality): string {
    const pool = getGongFaAffixPool();
    const filteredPrimary = filterAffixPool(pool.primary, quality);
    const filteredSecondary = filterAffixPool(pool.secondary, quality);

    const parts: string[] = [];
    parts.push('### 功法词条池\n');
    parts.push('**主词条 (必选1个):**\n');
    parts.push(buildAffixTable(filteredPrimary, { showSlots: false }));
    parts.push('');

    if (filteredSecondary.length > 0) {
      parts.push('**副词条 (可选0-1个):**\n');
      parts.push(buildAffixTable(filteredSecondary, { showSlots: false }));
    } else {
      parts.push('**副词条:** 无');
    }

    return parts.join('\n');
  }

  private calculateGrade(
    gradeHint: GradeHint,
    realm: RealmType,
    materialQuality: Quality,
    spiritualRootStrength: number,
  ): SkillGrade {
    const candidates =
      GRADE_HINT_TO_GRADES[gradeHint] || GRADE_HINT_TO_GRADES['low'];

    // 使用新的计算函数，考虑境界、材料、灵根强度
    // 功法没有元素匹配，所以 hasMatchingElement 传 true
    const ratio = calculatePowerRatio(
      realm,
      materialQuality,
      spiritualRootStrength,
      true, // 功法不依赖特定元素，视为匹配
    );

    const index = Math.min(
      candidates.length - 1,
      Math.floor(ratio * candidates.length),
    );
    let selectedGrade = candidates[index];

    // 境界限制（依然存在，但可能由于材料好而触达当前境界的上限）
    const realmLimit = REALM_GRADE_LIMIT[realm];
    selectedGrade = clampGrade(selectedGrade, realmLimit);

    return selectedGrade;
  }
}

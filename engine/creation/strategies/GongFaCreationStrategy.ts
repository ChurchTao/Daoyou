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
// 从 prompts 导入的函数已移除（不再需要）
import {
  applyGradeDiscount,
  calculateRealmDiscount,
  clampGrade,
  GRADE_TO_QUALITY,
  GRADE_TO_RANK,
  QUALITY_TO_BASE_GRADE,
  QUALITY_TO_NUMERIC_LEVEL,
  RANK_TO_GRADE,
  REALM_GRADE_LIMIT,
} from '../skillConfig';
import {
  GongFaBlueprint,
  GongFaBlueprintSchema,
  MaterializationContext,
} from '../types';

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
    const { userPrompt, materials } = context;

    // 计算基于材料的品质
    const materialQuality = this.calculateMaterialQuality(materials);
    const affixPrompts = this.buildAffixPrompts(materialQuality);

    const systemPrompt = `
# Role: 藏经阁长老 - 功法蓝图设计

你是一位博览群书的藏经阁长老，负责根据提供的残页或典籍复原或推演功法。

## 核心指令
**功法的词条选择完全由【核心材料】的特性决定。**
- 分析材料描述，选择最能体现材料特性的词条
- 不要考虑使用者的灵根、境界等因素

## 材料特性判断规则
根据材料的**名称意境**和**描述内容**推断其特性：

### 属性方向判断
| 名称/描述意境 | 属性 | 词条倾向 |
|--------------|------|---------|
| 体/身/血/骨/肉 | 体魄 | 增加体魄类词条 |
| 气/灵/元/神 | 灵力 | 增加灵力类词条 |
| 悟/觉/慧/明 | 悟性 | 增加悟性类词条 |
| 速/疾/闪/影 | 身法 | 增加速度类词条 |
| 识/神/念 | 神识 | 增加神识类词条 |
| 暴/破/烈 | 暴击 | 增加暴击类词条 |
| 御/守/甲 | 防御 | 增加防御类词条 |

### 判断逻辑
1. 从名称中提取核心关键字
2. 根据关键字判断属性倾向
3. 从词条池中选择最匹配的词条ID

## 输出格式
只输出一个符合 JSON Schema 的纯 JSON 对象。

## 核心材料
<core_materials>
${materials
  .filter((m) => m.type === 'manual')
  .map((m) => this.buildMaterialPrompt(m))
  .join('\n\n')}
</core_materials>

${affixPrompts}

## 用户意图
${userPrompt || '无（自由发挥，但必须基于材料特性）'}

## 输出示例
{
  "name": "烈火诀",
  "description": "基于烈火残页推演而出，采地火之气修炼，可大幅增强灵力。",
  "selected_affixes": {
    "primary": "gongfa_spirit",
    "secondary": "gongfa_crit_rate"
  }
}
`;

    const userPromptText = '请根据上述材料特性，推演功法蓝图。';

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
    const maxRootStrength =
      context.cultivator.spiritual_roots.length > 0
        ? Math.max(...context.cultivator.spiritual_roots.map((r) => r.strength))
        : 0;

    // 1. 确定品阶（由材料品质决定）
    const materialQuality = this.calculateMaterialQuality(context.materials);
    const grade = this.calculateGrade(realm, materialQuality, maxRootStrength);
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
      description: blueprint.description,
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
      description: resultItem.description,
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

  private estimateQuality(realm: RealmType, materialQuality: Quality): Quality {
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

  /**
   * 构建材料提示信息
   */
  private buildMaterialPrompt(material: Material): string {
    const qualityLevel = QUALITY_TO_NUMERIC_LEVEL[material.rank];
    return `
- 名称：${material.name}
- 品质等级：${material.rank}（${qualityLevel}级）
- 描述：${material.description || '无描述'}
  `.trim();
  }

  private calculateGrade(
    realm: RealmType,
    materialQuality: Quality,
    spiritualRootStrength: number,
  ): SkillGrade {
    // 步骤1: 获取材料基准品阶
    const materialGrade = QUALITY_TO_BASE_GRADE[materialQuality] || '黄阶下品';

    // 步骤2: 计算境界折扣系数
    const realmDiscount = calculateRealmDiscount(materialGrade, realm);

    // 步骤3: 应用折扣
    let finalGrade = applyGradeDiscount(materialGrade, realmDiscount);

    // 步骤4: 灵根强度微调
    if (spiritualRootStrength >= 80) {
      // 高灵根强度：提升1个小阶位
      const currentRank = GRADE_TO_RANK[finalGrade];
      if (currentRank < 12) {
        finalGrade = RANK_TO_GRADE[currentRank + 1];
      }
    }

    // 步骤5: 应用境界绝对上限
    const realmLimit = REALM_GRADE_LIMIT[realm];
    finalGrade = clampGrade(finalGrade, realmLimit);

    return finalGrade;
  }
}

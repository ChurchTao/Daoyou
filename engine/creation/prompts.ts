/**
 * 创建系统提示词工具函数
 *
 * 提供结构化的提示词构建方法，参考材料生成模块的设计
 * 使 AI 更好地理解品阶数值化、境界限制等规则
 */

import type { RealmType } from '@/types/constants';
import { GRADE_TO_RANK, REALM_GRADE_LIMIT } from './skillConfig';

// ============================================================
// 品阶等级说明
// ============================================================

/**
 * 构建品阶等级说明表格（用于提示词）
 *
 * 将品阶数值化为 1-12 级，便于 AI 理解高低关系
 */
export function buildGradeLevelTable(): string {
  return `
## 品阶等级说明

功法/神通品阶分为 1-12 级，数值越高越强大：

| 等级 | 品阶 | 特点 | 常用境界 |
|------|------|------|----------|
| 1-3 | 黄阶 | 入门功法，基础修炼 | 炼气期 |
| 4-6 | 玄阶 | 初窥门径，有所小成 | 筑基、金丹期 |
| 7-9 | 地阶 | 功力深厚，威力不俗 | 元婴、化神期 |
| 10-12 | 天阶 | 夺天地造化，无上绝学 | 化神及以上 |

**品阶选择规则：**
- 根据修士境界和材料品质综合决定
- 高品质材料可以突破境界限制，获得更高品阶
- 名称和描述的霸气程度应与品阶等级相匹配
`;
}

/**
 * 构建境界品阶限制说明
 *
 * @param realm 修士境界
 */
export function buildRealmGradeLimitTable(realm: RealmType): string {
  const limit = REALM_GRADE_LIMIT[realm];
  const limitRank = GRADE_TO_RANK[limit];

  return `
## 当前境界品阶限制

**修士境界**: ${realm}
**品阶上限**: 等级 ${limitRank} (${limit}及以下)

*注：使用高品质材料可适当放宽此限制*
`;
}

/**
 * 构建品阶选择提示（数值化）
 *
 * @param realm 修士境界
 * @param materialQuality 材料品质
 */
export function buildGradeSelectionPrompt(
  realm: RealmType,
  materialQuality: string,
): string {
  const limit = REALM_GRADE_LIMIT[realm];
  const limitRank = GRADE_TO_RANK[limit];

  // 根据材料品质限制可选的 grade_hint
  const materialRank = QUALITY_VALUES.indexOf(materialQuality as Quality);
  const maxAllowedHint = getMaterialMaxGradeHint(materialRank);

  // 将 grade_hint 转换为中文描述
  const hintDescriptions: Record<string, string> = {
    low: '1-3级 (黄阶)',
    medium: '4-6级 (玄阶)',
    high: '7-9级 (地阶)',
    extreme: '10-12级 (天阶)',
  };

  return `
### 品阶方向选择 (grade_hint)

根据当前条件选择合适的品阶方向：

| grade_hint | 品阶等级范围 | 对应品阶 | 说明 |
|------------|--------------|----------|------|
| low | 1-3 级 | 黄阶下/中/上品 | 基础功法/神通 |
| medium | 4-6 级 | 玄阶下/中/上品 | 进阶功法/神通 |
| high | 7-9 级 | 地阶下/中/上品 | 高深功法/神通 |
| extreme | 10-12 级 | 天阶下/中/上品 | 顶级绝学 |

**当前条件分析**：
- 修士境界: ${realm}
- 境界上限: 等级 ${limitRank}
- 材料品质: ${materialQuality}
- **材料品质限制**: 最高只能选择 ${hintDescriptions[maxAllowedHint]}

**⚠️ 重要约束**：
- 材料品质决定了功法/神通能够达到的最高品阶
- 使用低品质材料无法创造出高品阶的功法/神通
- 例如：使用玄品材料，最高只能选择 medium（玄阶），不能选择 high 或 extreme

**选择建议**：
- 综合考虑境界和材料品质，选择最合适的 grade_hint
- 想要获得更高品阶，需要使用更高品质的材料
`;
}

/**
 * 导入品质常量
 */
import type { Quality } from '@/types/constants';
import { QUALITY_VALUES } from '@/types/constants';

/**
 * 根据材料品质等级获取允许选择的最高 grade_hint
 */
function getMaterialMaxGradeHint(materialRank: number): string {
  // 材料品质到 grade_hint 的映射
  // 凡品(0) -> low
  // 灵品(1) -> low
  // 玄品(2) -> medium
  // 真品(3) -> medium
  // 地品(4) -> high
  // 天品(5) -> high
  // 仙品(6) -> extreme
  // 神品(7) -> extreme

  if (materialRank <= 1) return 'low'; // 凡品、灵品
  if (materialRank <= 3) return 'medium'; // 玄品、真品
  if (materialRank <= 5) return 'high'; // 地品、天品
  return 'extreme'; // 仙品、神品
}

// ============================================================
// 命名与描述规范
// ============================================================

/**
 * 构建命名规范说明
 *
 * @param type 物品类型 (skill | gongfa)
 */
export function buildNamingRules(type: 'skill' | 'gongfa'): string {
  const suffixes =
    type === 'skill'
      ? '斩、击、术、法、诀、掌、指、剑气、刀芒、箭、波'
      : '功、诀、经、典、录、心法、秘籍、真解、残篇、卷、法';

  return `
## 命名与描述规范

### 命名规范
- 长度：2-8 字
- 必须源自材料描述
- 风格：古风修仙
- 格式参考：[元素/属性][动作/形态][后缀]
- 后缀可选：${suffixes}

### 描述规范
- 长度：30-80 字
- 内容：描述效果、来历、修炼特点
- 风格：略带神秘感和修仙氛围

### 禁用词汇
严格禁止在名称中使用：
- 品阶等级词：黄阶、玄阶、地阶、天品等
- 通用描述词：神通、技能、功法、绝学等
`;
}

/**
 * 构建攻击型神通词条选择规则
 *
 * 强调攻击型神通必须选择直接伤害类主词条
 */
export function buildAttackSkillAffixRules(): string {
  return `
## 攻击型神通词条选择规则（必读）

### 主词条选择要求
攻击型神通（type=attack）的主词条**必须**从以下直接伤害类中选择：

**基础伤害类（推荐）**：
- \`skill_attack_base_damage\` - 基础伤害
- \`skill_attack_heavy_damage\` - 高倍率伤害
- \`skill_attack_crit_damage\` - 暴击加成伤害
- \`skill_attack_armor_pierce\` - 破甲攻击

**多段攻击类**：
- \`skill_attack_multi_hit\` - 连续攻击
- \`skill_attack_destructive\` - 破灭一击

**重要提示**：
- 功能性词条（如斩杀、吸血、反击等）应作为【副词条】选择，不应作为主词条
- 控制类词条（如冰冻）应作为【副词条】选择
- 如果没有合适的主词条，优先选择 \`skill_attack_base_damage\`
`;
}

/**
 * 构建五行契合度评估规则
 */
export function buildElementMatchRules(): string {
  return `
## 五行契合度评估规则

| 评估等级 | 条件 | 说明 |
|----------|------|------|
| perfect_match | 灵根强度 >= 70 且武器元素匹配 | 完美契合，威力加成 |
| partial_match | 有对应灵根且强度 >= 50 | 部分契合，正常威力 |
| no_match | 无对应灵根 | 不契合，威力降低 |
| conflict | 灵根与技能元素相克 | 相克，大幅降低威力 |

**评估方法**：
1. 检查修士灵根中是否有与技能元素相同的
2. 检查装备的武器元素是否与技能元素相同
3. 检查是否存在五行相克关系
`;
}

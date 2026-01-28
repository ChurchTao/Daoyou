# 功法/神通创建系统重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构功法和神通创建系统，使材料品质成为决定性因素（70%+权重），词条选择由材料特性决定而非角色适配

**Architecture:**
1. 移除 Blueprint 中的 `grade_hint` 字段，品阶由后端根据材料品质直接计算
2. 重构品阶计算逻辑：材料品质决定基准（70%），境界影响折扣系数，灵根微调
3. 重构提示词：移除角色信息（灵根、武器），强化材料特性和通用判断规则

**Tech Stack:** TypeScript, Node.js, Zod, Vitest

---

## Task 1: 添加材料品质→品阶映射配置

**Files:**
- Modify: `engine/creation/skillConfig.ts`

**Step 1: 添加品质数值化映射表**

在 `skillConfig.ts` 中添加以下配置（在文件顶部的常量定义区域）：

```typescript
// ============ 材料品质 → 品阶基准映射 ============

/**
 * 材料品质数值化等级（用于让AI理解品质水准）
 */
export const QUALITY_TO_NUMERIC_LEVEL: Record<Quality, number> = {
  '凡品': 10,
  '灵品': 25,
  '玄品': 40,
  '真品': 55,
  '地品': 70,
  '天品': 85,
  '仙品': 100,
  '神品': 120,
};

/**
 * 材料品质直接对应品阶基准
 * 材料决定70%的品阶权重
 */
export const QUALITY_TO_BASE_GRADE: Record<Quality, SkillGrade> = {
  '凡品': '黄阶下品',
  '灵品': '黄阶中品',
  '玄品': '玄阶下品',
  '真品': '玄阶中品',
  '地品': '地阶下品',
  '天品': '地阶中品',
  '仙品': '天阶下品',
  '神品': '天阶中品',
};
```

**Step 2: 添加境界折扣率配置**

```typescript
// ============ 境界折扣率配置 ============

/**
 * 境界等级映射（用于计算折扣）
 */
export const REALM_TO_RANK: Record<RealmType, number> = {
  '炼气': 1,
  '筑基': 2,
  '金丹': 3,
  '元婴': 4,
  '化神': 5,
  '炼虚': 6,
  '合体': 7,
  '大乘': 8,
  '渡劫': 9,
};

/**
 * 计算境界折扣系数
 * 材料品阶 > 当前境界 → 折扣（模拟"只能学皮毛"）
 *
 * @param materialGrade 材料对应的品阶
 * @param realm 修士当前境界
 * @returns 折扣系数 0.3-1.0
 */
export function calculateRealmDiscount(
  materialGrade: SkillGrade,
  realm: RealmType,
): number {
  const materialRank = GRADE_TO_RANK[materialGrade];
  const realmRank = REALM_TO_RANK[realm];

  // 计算境界允许的最高品阶等级
  const realmMaxRank = realmRank * 3 + 3; // 炼气(1)=3, 筑基(2)=6, 元婴(4)=9...

  // 如果材料品阶不超过境界允许范围，无折扣
  if (materialRank <= realmMaxRank) {
    return 1.0;
  }

  // 计算差距，每超出3级折扣10%
  const gap = materialRank - realmMaxRank;
  const discount = 1.0 - Math.floor(gap / 3) * 0.1;

  return Math.max(0.3, discount);
}

/**
 * 应用折扣系数到品阶
 *
 * @param baseGrade 基准品阶
 * @param discount 折扣系数
 * @returns 折扣后的品阶
 */
export function applyGradeDiscount(
  baseGrade: SkillGrade,
  discount: number,
): SkillGrade {
  if (discount >= 1.0) return baseGrade;

  const baseRank = GRADE_TO_RANK[baseGrade];
  const discountedRank = Math.floor(baseRank * discount);

  // 确保不低于黄阶下品
  return RANK_TO_GRADE[Math.max(1, discountedRank)] || '黄阶下品';
}
```

**Step 3: 运行类型检查确保无错误**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: 提交变更**

```bash
git add engine/creation/skillConfig.ts
git commit -m "feat(creation): 添加材料品质→品阶映射配置

- 添加 QUALITY_TO_NUMERIC_LEVEL 让AI理解品质水准
- 添加 QUALITY_TO_BASE_GRADE 材料品质直接对应品阶
- 添加 calculateRealmDiscount 计算境界折扣系数
- 添加 applyGradeDiscount 应用折扣到品阶

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 2: 重构 SkillCreationStrategy.calculateGrade 方法

**Files:**
- Modify: `engine/creation/strategies/SkillCreationStrategy.ts`

**Step 1: 重构 calculateGrade 方法**

替换 `calculateGrade` 方法的实现：

```typescript
/**
 * 计算最终品阶（重构版）
 * - 材料品质决定基准品阶（70%权重）
 * - 境界差距带来折扣
 * - 灵根契合度微调（±1个小阶位）
 */
private calculateGrade(
  gradeHint: GradeHint,
  realm: RealmType,
  element: ElementType,
  spiritualRoots: SpiritualRoot[],
  materialQuality: Quality,
): SkillGrade {
  // 步骤1: 获取材料基准品阶
  const materialGrade = QUALITY_TO_BASE_GRADE[materialQuality] || '黄阶下品';

  // 步骤2: 计算境界折扣系数
  const realmDiscount = calculateRealmDiscount(materialGrade, realm);

  // 步骤3: 应用折扣
  let finalGrade = applyGradeDiscount(materialGrade, realmDiscount);

  // 步骤4: 灵根契合度微调
  const matchingRoot = spiritualRoots.find((r) => r.element === element);
  if (matchingRoot && matchingRoot.strength >= 70) {
    // 高契合度：提升1个小阶位（如"玄阶下品"→"玄阶中品"）
    const currentRank = GRADE_TO_RANK[finalGrade];
    if (currentRank < 12) {
      finalGrade = RANK_TO_GRADE[currentRank + 1];
    }
  }

  // 步骤5: 应用境界绝对上限（不被突破）
  const realmLimit = REALM_GRADE_LIMIT[realm];
  finalGrade = clampGrade(finalGrade, realmLimit);

  return finalGrade;
}
```

**Step 2: 更新导入语句**

确保文件顶部导入新增的函数：

```typescript
import {
  calculateBaseCost,
  calculateCooldown,
  calculatePowerRatio,
  calculateRealmDiscount,  // 新增
  applyGradeDiscount,       // 新增
  clampGrade,
  ELEMENT_MATCH_MODIFIER,
  GRADE_HINT_TO_GRADES,     // 保留用于兼容
  GRADE_TO_RANK,
  QUALITY_TO_BASE_GRADE,    // 新增
  QUALITY_TO_NUMERIC_LEVEL, // 新增
  RANK_TO_GRADE,            // 新增
  REALM_GRADE_LIMIT,
  SKILL_ELEMENT_CONFLICT,
  SKILL_TYPE_MODIFIERS,
} from '../skillConfig';
```

**Step 3: 移除 limitCandidatesByMaterialQuality 方法**

由于品阶直接由材料决定，不再需要此方法。删除整个方法定义。

**Step 4: 运行测试验证**

Run: `npm test -- engine/creation/strategies/SkillCreationStrategy.test.ts`
Expected: Tests pass (可能需要更新测试用例)

**Step 5: 提交变更**

```bash
git add engine/creation/strategies/SkillCreationStrategy.ts
git commit -m "refactor(skill): 重构品阶计算逻辑

- 材料品质直接决定基准品阶（70%权重）
- 添加境界折扣机制（高阶秘籍给低境界=折扣）
- 灵根契合度仅微调±1个小阶位
- 移除 limitCandidatesByMaterialQuality 方法

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 3: 重构 GongFaCreationStrategy.calculateGrade 方法

**Files:**
- Modify: `engine/creation/strategies/GongFaCreationStrategy.ts`

**Step 1: 重构 calculateGrade 方法**

替换 `calculateGrade` 方法的实现：

```typescript
private calculateGrade(
  gradeHint: GradeHint,
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
```

**Step 2: 更新导入语句**

```typescript
import {
  calculatePowerRatio,
  calculateRealmDiscount,  // 新增
  applyGradeDiscount,       // 新增
  clampGrade,
  GRADE_HINT_TO_GRADES,     // 保留用于兼容
  GRADE_TO_RANK,
  QUALITY_TO_BASE_GRADE,    // 新增
  RANK_TO_GRADE,            // 新增
  REALM_GRADE_LIMIT,
} from '../skillConfig';
```

**Step 3: 移除 limitCandidatesByMaterialQuality 方法**

删除整个方法定义。

**Step 4: 运行测试验证**

Run: `npm test -- engine/creation/strategies/GongFaCreationStrategy.test.ts`
Expected: Tests pass

**Step 5: 提交变更**

```bash
git add engine/creation/strategies/GongFaCreationStrategy.ts
git commit -m "refactor(gongfa): 重构品阶计算逻辑

- 材料品质直接决定基准品阶
- 添加境界折扣机制
- 灵根强度影响微调
- 移除 limitCandidatesByMaterialQuality 方法

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 4: 重构 SkillCreationStrategy 提示词

**Files:**
- Modify: `engine/creation/strategies/SkillCreationStrategy.ts`

**Step 1: 添加 buildMaterialPrompt 辅助方法**

在类中添加新方法：

```typescript
/**
 * 构建材料提示信息
 * 将材料信息格式化为AI可理解的格式
 */
private buildMaterialPrompt(material: Material): string {
  const qualityLevel = QUALITY_TO_NUMERIC_LEVEL[material.rank];
  return `
- 名称：${material.name}
- 品质等级：${material.rank}（${qualityLevel}级）
- 描述：${material.description || '无描述'}
  `.trim();
}
```

**Step 2: 重构 constructPrompt 方法**

完全替换 `constructPrompt` 方法：

```typescript
constructPrompt(context: CreationContext): PromptData {
  const { userPrompt, materials } = context;

  // 计算基于材料的品质
  const materialQuality = this.calculateMaterialQuality(materials);
  const estimatedQuality = this.estimateQuality(context.cultivator.realm as RealmType, materialQuality);

  // 为每种技能类型构建词条提示
  const skillTypePrompts = this.buildSkillTypeAffixPrompts(estimatedQuality);

  const systemPrompt = `
# Role: 传功长老 - 神通蓝图设计

你是一位隐世传功长老，负责为修士推演神通蓝图。

## 核心指令
**神通的词条选择完全由【核心材料】的特性决定。**
- 分析材料描述，选择最能体现材料特性的词条
- 不要考虑使用者的灵根、境界、武器等因素

## 材料特性判断规则
根据材料的**名称意境**和**描述内容**推断其特性：

### 元素属性判断
| 名称/描述意境 | 元素 | 词条倾向 |
|--------------|------|---------|
| 烈/焚/灼/阳/日/赤/朱雀 | 火 | 火系攻击、燃烧伤害 |
| 寒/冰/霜/雪/冥/玄武 | 冰 | 冰系控制、冻结伤害 |
| 雷/电/霹雳/紫霄/青雷 | 雷 | 雷系爆发、高额伤害 |
| 风/岚/飓/巽/青鸾 | 风 | 闪避、速度、连续攻击 |
| 剑/锋/斩/破/金 | 金 | 物理爆发、破甲、斩杀 |
| 毒/蚀/煞/幽/冥 | 毒/暗 | 持续伤害、削弱 |
| 御/守/甲/罡/盾 | 土/防御 | 护盾、防御力提升 |
| 生/愈/泉/春/青木 | 木/生命 | 治疗、生命恢复 |

### 功能类型判断
| 名称/描述意境 | 类型 | 词条选择 |
|--------------|------|---------|
| 斩/决/杀/破/灭 | 攻击型 | 伤害类主词条 |
| 御/守/护/体/罡 | 增益型 | 防御/属性提升 |
| 封/困/锁/禁 | 控制型 | 控制效果 |
| 疗/愈/生/回 | 治疗型 | 治疗效果 |
| 蚀/衰/弱/煞 | 减益型 | 削弱效果 |

### 判断逻辑
1. 先从名称中提取**核心字**（通常是2-3个关键字）
2. 根据核心字判断**元素属性**和**功能倾向**
3. 从对应类型的词条池中选择最匹配的词条ID
4. 如果描述中有更具体的说明（如"凝聚火焰"），以描述为准

## 输出格式
只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **type**: ${SKILL_TYPE_VALUES.join(', ')}
- **element**: ${ELEMENT_VALUES.join(', ')}

${skillTypePrompts}

## 核心材料
<core_materials>
${materials
  .filter((m) => m.type === 'manual')
  .map((m) => this.buildMaterialPrompt(m))
  .join('\n\n')}
</core_materials>

## 用户意图
${userPrompt || '无（自由发挥，但必须基于材料特性）'}

## 选择规则
1. 先分析材料的核心特性（攻击/控制/治疗/辅助）
2. 从对应类型的词条池中选择最匹配的词条ID
3. 主词条必须体现材料的核心特性
4. 副词条可选0-1个，也应与材料相关

## 输出示例
{
  "name": "烈焰斩",
  "type": "attack",
  "element": "火",
  "description": "基于【烈火残页】领悟，凝聚火焰于剑上，一斩而出...",
  "selected_affixes": {
    "primary": "skill_attack_fire_damage",
    "secondary": "skill_attack_execute"
  }
}
`;

  const userPromptText = '请根据上述材料特性，推演神通蓝图。';

  return {
    system: systemPrompt,
    user: userPromptText,
  };
}
```

**Step 3: 移除旧导入中不再需要的类型**

检查并移除不再使用的导入（如果有的话）。

**Step 4: 运行测试验证**

Run: `npm test -- engine/creation/strategies/SkillCreationStrategy.test.ts`
Expected: Tests pass (提示词结构变化不影响功能)

**Step 5: 提交变更**

```bash
git add engine/creation/strategies/SkillCreationStrategy.ts
git commit -m "refactor(skill): 重构提示词，移除角色信息

- 移除灵根、境界、武器等角色信息（避免误导AI）
- 添加材料特性判断规则（通用版）
- 新增 buildMaterialPrompt 方法格式化材料信息
- 强化\"材料决定词条\"的核心指令

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 5: 重构 GongFaCreationStrategy 提示词

**Files:**
- Modify: `engine/creation/strategies/GongFaCreationStrategy.ts`

**Step 1: 添加 buildMaterialPrompt 辅助方法**

```typescript
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
```

**Step 2: 重构 constructPrompt 方法**

替换 `constructPrompt` 方法：

```typescript
constructPrompt(context: CreationContext): PromptData {
  const { userPrompt, materials } = context;

  // 计算基于材料的品质
  const materialQuality = this.calculateMaterialQuality(materials);
  const estimatedQuality = this.estimateQuality(context.cultivator.realm as RealmType, materialQuality);
  const affixPrompts = this.buildAffixPrompts(estimatedQuality);

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
```

**Step 3: 运行测试验证**

Run: `npm test -- engine/creation/strategies/GongFaCreationStrategy.test.ts`
Expected: Tests pass

**Step 4: 提交变更**

```bash
git add engine/creation/strategies/GongFaCreationStrategy.ts
git commit -m "refactor(gongfa): 重构提示词，移除角色信息

- 移除灵根、境界等角色信息
- 添加材料特性判断规则
- 新增 buildMaterialPrompt 方法
- 强化\"材料决定词条\"的核心指令

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 6: 更新类型定义，移除 grade_hint 字段

**Files:**
- Modify: `engine/creation/types.ts`

**Step 1: 修改 SkillBlueprintSchema**

找到 `SkillBlueprintSchema` 定义，移除 `grade_hint` 字段：

```typescript
export const SkillBlueprintSchema = z.object({
  name: z.string().min(2).max(8).describe('技能名称（古风修仙）'),
  type: z.enum(SKILL_TYPE_VALUES).describe('技能类型'),
  element: z.enum(ELEMENT_VALUES).describe('技能元素'),
  description: z.string().max(180).describe('技能描述（施法表现、视觉效果）'),

  // 移除 grade_hint 字段
  // grade_hint: z.enum(GRADE_HINT_VALUES).describe('...'),

  // 保留 element_match_assessment（可选，用于调试）
  element_match_assessment: z
    .enum(ELEMENT_MATCH_VALUES)
    .optional()
    .describe('AI 对五行契合度的评估（可选）'),

  selected_affixes: SkillAffixSelectionSchema.describe('AI选择的词条ID'),
});
```

**Step 2: 修改 GongFaBlueprintSchema**

找到 `GongFaBlueprintSchema` 定义，移除 `grade_hint` 字段：

```typescript
export const GongFaBlueprintSchema = z.object({
  name: z.string().min(2).max(8).describe('功法名称（2-8字，古风）'),
  // 移除 grade_hint 字段
  description: z.string().max(100).describe('功法描述'),
  selected_affixes: GongFaAffixSelectionSchema.describe('AI选择的词条ID'),
});
```

**Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: Type errors related to missing grade_hint (需要在 strategy 中修复)

**Step 4: 提交类型变更**

```bash
git add engine/creation/types.ts
git commit -m "refactor(types): 移除 Blueprint 中的 grade_hint 字段

- 品阶由后端根据材料品质直接计算
- 简化 AI Schema，移除方向性标签
- element_match_assessment 改为可选（调试用）

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 7: 修复 Strategy 中的 grade_hint 引用

**Files:**
- Modify: `engine/creation/strategies/SkillCreationStrategy.ts`
- Modify: `engine/creation/strategies/GongFaCreationStrategy.ts`

**Step 1: 更新 SkillCreationStrategy.materialize 方法**

修改 `materialize` 方法，移除对 `grade_hint` 的使用：

```typescript
materialize(blueprint: SkillBlueprint, context: CreationContext): Skill {
  const realm = context.cultivator.realm as RealmType;

  // 获取武器元素
  const weaponId = context.cultivator.equipped.weapon;
  const weapon = context.cultivator.inventory.artifacts.find(
    (a) => a.id === weaponId,
  );

  // 1. 计算五行契合度
  const elementMatch = this.calculateElementMatch(
    blueprint.element,
    context.cultivator.spiritual_roots,
    weapon?.element,
  );

  // 2. 确定品阶（不再使用 grade_hint，传 null）
  const materialQuality = this.calculateMaterialQuality(context.materials);
  const grade = this.calculateGrade(
    null, // 不再使用 grade_hint
    realm,
    blueprint.element,
    context.cultivator.spiritual_roots,
    materialQuality,
  );

  // ... 其余代码保持不变
}
```

**Step 2: 更新 GongFaCreationStrategy.materialize 方法**

```typescript
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

  // 1. 确定品阶
  const materialQuality = this.calculateMaterialQuality(context.materials);
  const grade = this.calculateGrade(
    null, // 不再使用 grade_hint
    realm,
    materialQuality,
    maxRootStrength,
  );

  // ... 其余代码保持不变
}
```

**Step 3: 更新 calculateGrade 方法签名**

两个 strategy 的 `calculateGrade` 方法签名中，`gradeHint` 参数改为可选：

```typescript
// SkillCreationStrategy
private calculateGrade(
  gradeHint: GradeHint | null,  // 改为可选
  realm: RealmType,
  element: ElementType,
  spiritualRoots: SpiritualRoot[],
  materialQuality: Quality,
): SkillGrade {
  // gradeHint 不再使用，可以忽略
  // ...
}

// GongFaCreationStrategy
private calculateGrade(
  gradeHint: GradeHint | null,  // 改为可选
  realm: RealmType,
  materialQuality: Quality,
  spiritualRootStrength: number,
): SkillGrade {
  // gradeHint 不再使用，可以忽略
  // ...
}
```

**Step 4: 运行所有测试**

Run: `npm test -- engine/creation/strategies/`
Expected: All tests pass

**Step 5: 提交修复**

```bash
git add engine/creation/strategies/SkillCreationStrategy.ts engine/creation/strategies/GongFaCreationStrategy.ts
git commit -m "fix(creation): 移除 grade_hint 参数的使用

- 更新 materialize 方法，不再传递 grade_hint
- calculateGrade 的 gradeHint 参数改为可选
- 品阶完全由材料品质决定

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 8: 更新测试用例

**Files:**
- Modify: `engine/creation/strategies/SkillCreationStrategy.test.ts`
- Modify: `engine/creation/strategies/GongFaCreationStrategy.test.ts`

**Step 1: 更新 SkillCreationStrategy 测试**

```typescript
test('SkillCreationStrategy test', async () => {
  const strategy = new SkillCreationStrategy();
  const context: CreationContext = {
    cultivator: {
      id: 'test-cultivator',
      realm: '元婴',
      realm_stage: '初期',
      name: '测试修士',
      gender: '男',
      age: 20,
      lifespan: 100,
      attributes: {
        vitality: 100,
        spirit: 100,
        wisdom: 100,
        speed: 10,
        willpower: 100,
      },
      spiritual_roots: [{ element: '火', strength: 90 }],
      pre_heaven_fates: [],
      cultivations: [],
      skills: [],
      inventory: {
        artifacts: [
          {
            id: 'w1',
            name: '火剑',
            slot: 'weapon',
            element: '火',
            effects: [],
          },
        ],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: 'w1',
        armor: null,
        accessory: null,
      },
      max_skills: 5,
      spirit_stones: 0,
    },
    materials: [
      {
        id: 'm1',
        name: '烈火神通典籍',
        type: 'manual',
        rank: '地品',
        quantity: 1,
        description: '一本记载烈火之力的强大神通典籍，可领悟火焰攻击之法。',
      },
    ],
    userPrompt: '创造一个火系攻击神通',
  };

  await strategy.validate(context);
  const result = strategy.constructPrompt(context);

  // 验证提示词不包含角色信息
  expect(result.system).not.toContain('灵根');
  expect(result.system).not.toContain('武器');
  expect(result.system).toContain('烈火神通典籍');

  // 验证材料信息格式化正确
  expect(result.system).toContain('品质等级：地品（70级）');

  const aiResponse = await object(result.system, result.user, {
    schema: strategy.schema,
    schemaName: strategy.schemaName,
    schemaDescription: strategy.schemaDescription,
  });

  const resultItem = strategy.materialize(aiResponse.object, context);

  // 验证元素正确
  expect(resultItem.element).toBe('火');

  // 验证品阶由材料决定（地品材料应该至少地阶）
  const gradeRank = GRADE_TO_RANK[resultItem.grade];
  expect(gradeRank).toBeGreaterThanOrEqual(7); // 地阶下品是7
});
```

**Step 2: 更新 GongFaCreationStrategy 测试**

```typescript
test('GongFaCreationStrategy 测试材料主导', async () => {
  const strategy = new GongFaCreationStrategy();
  const context: CreationContext = {
    cultivator: {
      id: 'test-cultivator',
      realm: '炼气', // 低境界
      realm_stage: '初期',
      name: '测试修士',
      gender: '男',
      age: 20,
      lifespan: 100,
      attributes: { vitality: 50, spirit: 50, wisdom: 50, speed: 5, willpower: 50 },
      spiritual_roots: [],
      pre_heaven_fates: [],
      cultivations: [],
      skills: [],
      inventory: { artifacts: [], consumables: [], materials: [] },
      equipped: { weapon: null, armor: null, accessory: null },
      max_skills: 5,
      spirit_stones: 0,
    },
    materials: [
      {
        id: 'm1',
        name: '九阳神功残页',
        type: 'manual',
        rank: '天品', // 高品质材料
        quantity: 1,
        description: '至阳至刚的绝世功法残页',
      },
    ],
    userPrompt: '推演功法',
  };

  await strategy.validate(context);
  const result = strategy.constructPrompt(context);

  // 验证提示词聚焦材料
  expect(result.system).toContain('九阳神功残页');
  expect(result.system).toContain('品质等级：天品（85级）');

  const aiResponse = await object(result.system, result.user, {
    schema: strategy.schema,
    schemaName: strategy.schemaName,
    schemaDescription: strategy.schemaDescription,
  });

  const resultItem = strategy.materialize(aiResponse.object, context);

  // 验证悟性机制：天品材料给炼气期，应该打折
  // 天阶是10-12级，炼气最多黄阶(1-3级)
  // 由于折扣，最终应该在黄阶-玄阶之间
  const gradeRank = GRADE_TO_RANK[resultItem.grade];
  expect(gradeRank).toBeLessThanOrEqual(6); // 最多玄阶上品
  expect(gradeRank).toBeGreaterThanOrEqual(1); // 至少黄阶下品
});
```

**Step 3: 运行所有测试**

Run: `npm test -- engine/creation/strategies/`
Expected: All tests pass

**Step 4: 提交测试更新**

```bash
git add engine/creation/strategies/SkillCreationStrategy.test.ts engine/creation/strategies/GongFaCreationStrategy.test.ts
git commit -m "test(creation): 更新测试用例验证新逻辑

- 验证提示词移除了角色信息
- 验证材料信息格式化正确
- 验证品阶由材料品质决定
- 验证悟性机制（境界折扣）

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 9: 验证整体功能和集成测试

**Files:**
- Create: `engine/creation/integration.test.ts` (如果不存在)

**Step 1: 创建集成测试**

```typescript
import { object } from '@/utils/aiClient';
import { CreationContext } from '../CreationStrategy';
import { SkillCreationStrategy } from './strategies/SkillCreationStrategy';
import { GongFaCreationStrategy } from './strategies/GongFaCreationStrategy';
import { QUALITY_TO_BASE_GRADE, GRADE_TO_RANK } from './skillConfig';

describe('创建系统集成测试：材料主导', () => {
  test('高阶材料给低境界修士应该产生折扣', async () => {
    const strategy = new SkillCreationStrategy();
    const context: CreationContext = {
      cultivator: {
        id: 'test',
        realm: '炼气', // 最低境界
        realm_stage: '初期',
        name: '低阶修士',
        gender: '男',
        age: 20,
        lifespan: 100,
        attributes: { vitality: 50, spirit: 50, wisdom: 50, speed: 5, willpower: 50 },
        spiritual_roots: [{ element: '火', strength: 30 }],
        pre_heaven_fates: [],
        cultivations: [],
        skills: [],
        inventory: {
          artifacts: [],
          consumables: [],
          materials: [],
        },
        equipped: { weapon: null, armor: null, accessory: null },
        max_skills: 5,
        spirit_stones: 0,
      },
      materials: [
        {
          id: 'm1',
          name: '天阶神通秘籍',
          type: 'manual',
          rank: '仙品', // 最高品质
          quantity: 1,
          description: '记载天阶神通的绝世秘籍',
        },
      ],
      userPrompt: '创造神通',
    };

    await strategy.validate(context);

    const aiResponse = await object(
      strategy.constructPrompt(context).system,
      strategy.constructPrompt(context).user,
      {
        schema: strategy.schema,
        schemaName: strategy.schemaName,
        schemaDescription: strategy.schemaDescription,
      },
    );

    const result = strategy.materialize(aiResponse.object, context);

    // 仙品对应天阶下品(10级)，炼气最多黄阶(3级)
    // 应该大幅折扣，但不会低于黄阶下品
    const gradeRank = GRADE_TO_RANK[result.grade];
    expect(gradeRank).toBeGreaterThanOrEqual(1);
    expect(gradeRank).toBeLessThanOrEqual(3);
  });

  test('同阶材料给同境界修士应该无折扣', async () => {
    const strategy = new GongFaCreationStrategy();
    const context: CreationContext = {
      cultivator: {
        id: 'test',
        realm: '元婴', // 中高境界
        realm_stage: '中期',
        name: '元婴修士',
        gender: '女',
        age: 100,
        lifespan: 500,
        attributes: { vitality: 200, spirit: 200, wisdom: 150, speed: 20, willpower: 200 },
        spiritual_roots: [{ element: '水', strength: 80 }],
        pre_heaven_fates: [],
        cultivations: [],
        skills: [],
        inventory: { artifacts: [], consumables: [], materials: [] },
        equipped: { weapon: null, armor: null, accessory: null },
        max_skills: 10,
        spirit_stones: 0,
      },
      materials: [
        {
          id: 'm1',
          name: '玄阶功法',
          type: 'manual',
          rank: '真品', // 对应玄阶中品(5级)
          quantity: 1,
          description: '玄阶功法典籍',
        },
      ],
      userPrompt: '推演功法',
    };

    await strategy.validate(context);

    const aiResponse = await object(
      strategy.constructPrompt(context).system,
      strategy.constructPrompt(context).user,
      {
        schema: strategy.schema,
        schemaName: strategy.schemaName,
        schemaDescription: strategy.schemaDescription,
      },
    );

    const result = strategy.materialize(aiResponse.object, context);

    // 真品对应玄阶中品(5级)，元婴可达地阶(9级)，应该无折扣
    const gradeRank = GRADE_TO_RANK[result.grade];
    expect(gradeRank).toBeGreaterThanOrEqual(5);
  });

  test('材料品质直接决定品阶基准', () => {
    // 验证映射关系
    expect(QUALITY_TO_BASE_GRADE['凡品']).toBe('黄阶下品');
    expect(QUALITY_TO_BASE_GRADE['灵品']).toBe('黄阶中品');
    expect(QUALITY_TO_BASE_GRADE['玄品']).toBe('玄阶下品');
    expect(QUALITY_TO_BASE_GRADE['真品']).toBe('玄阶中品');
    expect(QUALITY_TO_BASE_GRADE['地品']).toBe('地阶下品');
    expect(QUALITY_TO_BASE_GRADE['天品']).toBe('地阶中品');
    expect(QUALITY_TO_BASE_GRADE['仙品']).toBe('天阶下品');
    expect(QUALITY_TO_BASE_GRADE['神品']).toBe('天阶中品');
  });
});
```

**Step 2: 运行集成测试**

Run: `npm test -- engine/creation/integration.test.ts`
Expected: All tests pass

**Step 3: 提交集成测试**

```bash
git add engine/creation/integration.test.ts
git commit -m "test(creation): 添加集成测试验证材料主导逻辑

- 验证高阶材料给低境界产生折扣
- 验证同阶材料给同境界无折扣
- 验证材料品质→品阶映射关系

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## Task 10: 最终验证和文档更新

**Step 1: 运行完整测试套件**

Run: `npm test`
Expected: All tests pass

**Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: 更新 CLAUDE.md**

如果需要，更新相关模块的文档说明新的材料主导逻辑。

**Step 4: 最终提交**

```bash
git add -A
git commit -m "feat(creation): 完成创建系统重构

核心变更：
- 材料品质决定品阶基准（70%+权重）
- 添加境界折扣机制（悟性系统）
- 提示词移除角色信息，聚焦材料特性
- 移除 grade_hint 字段

设计文档：docs/plans/2026-01-28-creation-system-refactor-design.md
实施计划：docs/plans/2026-01-28-creation-system-refactor.md

Co-Authored-By: Claude (glm-4.7) <noreply@anthropic.com>"
```

---

## 验收标准

1. ✅ 材料品质直接决定品阶基准（`QUALITY_TO_BASE_GRADE` 映射）
2. ✅ 境界差距带来品阶折扣（`calculateRealmDiscount`）
3. ✅ 提示词移除灵根、境界、武器信息
4. ✅ 提示词添加通用材料特性判断规则
5. ✅ Blueprint Schema 移除 `grade_hint` 字段
6. ✅ 所有测试通过

## 后续优化

- 成功率机制：材料与境界差距越大，创建成功率越低
- 材料消耗：失败不消耗材料，或消耗部分材料
- 更多材料特性规则：扩展判断规则表

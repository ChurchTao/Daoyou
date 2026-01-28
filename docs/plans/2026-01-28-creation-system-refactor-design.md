# 功法/神通创建系统重构设计

**日期**: 2026-01-28
**状态**: 设计已确认，待实施

## 背景问题

当前创建系统存在两个核心问题：

1. **材料品质影响弱化**：虽然存在材料品质限制，但在品阶计算中境界/灵根/材料三者权重接近，材料仅作为"上限限制"而非核心驱动力
2. **AI选词条偏向角色**：提示词强调修士特性（灵根、武器、命格），导致AI选择"契合角色"而非"体现材料"的词条

这与修仙世界观相悖——在修仙世界中，秘籍典籍的强度才是决定功法神通品质的核心因素。

## 设计原则

### 1. 材料绝对主导（70%+权重）
- 材料品质直接决定品阶等级的基础值
- 材料描述通过AI推断决定词条选择
- 境界和灵根不改变品阶和词条，只影响"学到什么程度"

### 2. 词条由材料决定，角色影响"掌握程度"
- AI根据材料名称/描述推断合适的词条组合
- 角色境界/灵根影响数值化参数，不影响词条ID
- 提示词中移除角色特性引导，强化材料特性

### 3. 悟性机制：境界差距带来折扣
- 材料品质 > 当前境界 → 品阶和数值都打折
- 模拟"高阶秘籍只能学皮毛"的体验
- 灵根契合度进一步影响折扣幅度

## 架构设计

### 核心变更点

#### 1. 品阶计算重构（`calculateGrade`）

```typescript
// 新的计算逻辑
private calculateGrade(
  gradeHint: GradeHint,
  realm: RealmType,
  materialQuality: Quality,
  spiritualRootStrength: number,
  hasMatchingElement: boolean
): SkillGrade {
  // 步骤1: 获取材料基准品阶（70%权重）
  const materialGrade = this.getMaterialBaseGrade(materialQuality);

  // 步骤2: 计算境界折扣系数
  const realmDiscount = this.calculateRealmDiscount(materialGrade, realm);

  // 步骤3: 应用折扣后的品阶
  let adjustedGrade = this.applyGradeDiscount(materialGrade, realmDiscount);

  // 步骤4: 灵根契合度微调（±1个小阶位）
  if (hasMatchingElement && spiritualRootStrength >= 70) {
    adjustedGrade = this.boostGradeByOneStep(adjustedGrade);
  }

  return adjustedGrade;
}
```

#### 2. 提示词重构

**核心变更：**
- 移除修士灵根、境界、武器等信息（避免误导AI）
- 保留材料信息并强化其重要性
- 添加通用的材料特性判断规则
- 移除 `grade_hint` 字段（品阶由后端计算）

**System Prompt 结构：**
```markdown
# Role: 传功长老 - 神通蓝图设计

## 核心指令
神通的词条选择完全由【核心材料】的特性决定。

## 材料特性判断规则
[通用规则表格，基于名称意境推断]

## 核心材料
<材料信息，含品质数值化>

## 词条池
[根据材料品质过滤后的词条]

## 用户意图
```

#### 3. Blueprint Schema 变更

移除 `grade_hint` 字段：
```typescript
// 之前
interface SkillBlueprint {
  name: string;
  type: SkillType;
  element: ElementType;
  description: string;
  grade_hint: GradeHint;  // ❌ 移除
  selected_affixes: {...};
}

// 之后
interface SkillBlueprint {
  name: string;
  type: SkillType;
  element: ElementType;
  description: string;
  selected_affixes: {...};
}
```

## 数据流变更

### 当前流程
```
用户输入材料 → 构建提示词（含角色信息） → AI选择词条+grade_hint →
后端验证 → 数值化（境界/灵根影响品阶） → 保存
```

### 新流程
```
用户输入材料 → 构建提示词（仅材料信息） → AI选择词条 →
后端计算品阶（材料品质70% + 境界折扣） → 数值化 → 保存
```

## 实现细节

### 1. 材料品质→品阶映射

```typescript
const QUALITY_TO_BASE_GRADE: Record<Quality, SkillGrade> = {
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

### 2. 境界折扣计算

```typescript
// 材料品阶 vs 当前境界的折扣率
// 例如：天阶材料给炼气期 = 0.5折扣
private calculateRealmDiscount(materialGrade: SkillGrade, realm: RealmType): number {
  const materialRank = GRADE_TO_RANK[materialGrade];
  const realmRank = REALM_TO_RANK[realm];

  if (materialRank <= realmRank + 2) {
    return 1.0; // 无折扣，能学会
  }

  // 计算折扣率，每差距1阶降低10%
  const gap = materialRank - realmRank - 2;
  return Math.max(0.3, 1.0 - gap * 0.1);
}
```

### 3. 材料信息格式化

```typescript
private buildMaterialPrompt(material: Material): string {
  // 材料品质数值化，让AI理解水准
  const qualityLevel = QUALITY_TO_NUMERIC_LEVEL[material.rank];
  // 例如：凡品=10, 灵品=30, 玄品=50, 真品=70, 地品=90...

  return `
- 名称：${material.name}
- 品质等级：${material.rank}（${qualityLevel}级）
- 描述：${material.description || '无描述'}
  `;
}
```

## 文件变更清单

1. **`engine/creation/strategies/SkillCreationStrategy.ts`**
   - 修改 `constructPrompt()` - 简化提示词
   - 重构 `calculateGrade()` - 新权重逻辑
   - 新增 `getMaterialBaseGrade()`, `calculateRealmDiscount()`
   - 新增 `buildMaterialPrompt()` - 材料信息格式化

2. **`engine/creation/strategies/GongFaCreationStrategy.ts`**
   - 同上变更

3. **`engine/creation/types.ts`**
   - 修改 `SkillBlueprint`, `GongFaBlueprint` - 移除 `grade_hint`

4. **`engine/creation/skillConfig.ts`**
   - 新增：`QUALITY_TO_BASE_GRADE` 映射表
   - 新增：`REALM_DISCOUNT_RATES` 折扣率配置

## 预期效果

1. **材料成为核心驱动力**：使用高品质材料必然得到高品质功法/神通
2. **词条体现材料特性**：AI基于材料描述选择词条，而非角色适配
3. **悟性机制体验**：高阶秘籍给低境界修士，只能学到皮毛（品阶和数值折扣）
4. **沉浸感提升**：符合修仙世界观的"秘籍决定功法强度"设定

## 后续优化

- 成功率机制：材料与境界差距越大，创建成功率越低
- 材料消耗：失败不消耗材料，或消耗部分材料
- 机缘感：越高的秘籍越难得

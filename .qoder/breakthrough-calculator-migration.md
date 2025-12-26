# 突破概率计算系统迁移说明

## 迁移时间
2024年12月25日

## 迁移原因
原版的突破概率计算算法（`breakthroughEngine.ts` 中的 `calculateBreakthroughChance`）不适合新版本的"修行+突破"系统，主要问题：

1. **依赖闭关年限**：旧算法将闭关年限作为核心计算因素，与新系统的"修为进度+感悟值"理念不符
2. **忽略修为进度**：未考虑修为进度对突破成功率的影响
3. **感悟值作用不足**：感悟值的加成效果过低
4. **突破类型缺失**：没有区分强行突破、常规突破、圆满突破的差异

## 新版算法

### 核心文件
- `/utils/breakthroughCalculator.ts` - 全新的突破概率计算系统

### 计算公式
```
最终成功率 = 基础成功率 × 境界难度 × 修为进度系数 × 感悟系数 × 悟性系数 × 心魔系数
```

### 基础成功率（根据突破类型）

| 突破类型 | 小境界 | 大境界 |
|---------|-------|--------|
| 强行突破 | 40%   | 25%    |
| 常规突破 | 65%   | 45%    |
| 圆满突破 | 85%   | 65%    |

### 修为进度系数

| 修为进度 | 系数  |
|---------|------|
| 60-69%  | 0.6  |
| 70-79%  | 0.8  |
| 80-89%  | 0.95 |
| 90-99%  | 1.1  |
| 100%    | 1.25 |

### 感悟系数
```
系数 = 1.0 + (感悟值 / 100) × 0.6
```
- 0感悟：1.0倍（无加成）
- 50感悟：1.3倍
- 100感悟：1.6倍

### 悟性系数
```
系数 = 1.0 + (悟性 - 50) / 300
```
- 悟性50：1.0倍（基准）
- 悟性80：1.1倍
- 悟性100：1.17倍
- 悟性150：1.33倍（极限）

### 境界难度系数
```
系数 = 0.92 ^ 境界索引
```
- 炼气：1.0
- 筑基：0.92
- 金丹：0.85
- 元婴：0.78
- ...（递减）

## 迁移内容

### 1. 创建新文件
- ✅ `/utils/breakthroughCalculator.ts` - 新的突破概率计算系统

### 2. 废弃旧函数
- ✅ `breakthroughEngine.ts` 中的 `calculateBreakthroughChance` 标记为 `@deprecated`
- ✅ 该函数现在抛出错误，强制使用新版

### 3. 更新引用
- ✅ `/engine/cultivation/CultivationEngine.ts` - 突破引擎使用新算法
- ✅ `/components/CultivatorStatusCard.tsx` - 状态卡片显示新的突破概率
- ✅ `/utils/prompts.ts` - 更新类型定义，移除对旧 `BreakthroughAttemptSummary` 的依赖

### 4. 类型兼容性
- ✅ 定义了新的 `BreakthroughModifiers` 接口
- ✅ 更新了 `BreakthroughStoryPayload` 和 `LifespanExhaustedStoryPayload` 的类型定义

## 新接口使用示例

```typescript
import { calculateBreakthroughChance } from '@/utils/breakthroughCalculator';

// 计算突破概率
const result = calculateBreakthroughChance(cultivator);

if (!result.canAttempt) {
  console.log('无法尝试突破:', result.recommendation);
  return;
}

console.log('突破类型:', result.breakthroughType); // 'forced' | 'normal' | 'perfect'
console.log('成功率:', result.chance);
console.log('建议:', result.recommendation);
console.log('各项系数:', result.modifiers);
```

## 旧接口状态

```typescript
// ❌ 已废弃，不要使用
import { calculateBreakthroughChance } from '@/utils/breakthroughEngine';
calculateBreakthroughChance(cultivator, years); // 会抛出错误
```

## 保留的工具函数

以下函数仍在 `breakthroughEngine.ts` 中保留，因为它们仍然有用：

- `getNextStage()` - 获取下一境界
- `getAttributeGrowthRange()` - 计算属性成长范围
- `applyAttributeGrowth()` - 应用属性成长
- `performRetreatBreakthrough()` - 旧版闭关突破（已不再使用，但保留代码）

## 验证

✅ 构建通过：`npm run build`
✅ 类型检查通过
✅ 无编译错误

## 影响范围

### 直接影响
- 突破成功率计算逻辑
- 突破建议文本生成
- 状态卡片显示

### 间接影响
- 游戏平衡性（突破更依赖修为和感悟，而非单纯闭关时长）
- 玩家策略（需要通过多种方式提升感悟值）

## 后续工作

1. 监控玩家反馈，根据实际游戏数据调整各项系数
2. 考虑添加更多影响突破概率的因素（如装备、丹药等）
3. 完善突破失败后的补偿机制
4. 优化突破过程的UI展示

## 注意事项

⚠️ 不要再使用 `breakthroughEngine.ts` 中的 `calculateBreakthroughChance(cultivator, years)` 函数
⚠️ 新算法不依赖闭关年限参数，这是设计上的重要改变
⚠️ 确保修为进度至少达到60%才能尝试突破

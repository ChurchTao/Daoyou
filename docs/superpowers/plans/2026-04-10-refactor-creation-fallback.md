# 造物引擎 v2 Fallback 清理与异常驱动重构计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `engine/creation-v2` 中删除所有 fallback 逻辑，改为抛出结构化异常 `CreationError` 以实现快速失败（Fail Fast）。

**Architecture:** 引入 `CreationError` 类，在 Analysis、Selection、Composition 阶段末尾增加断言逻辑。移除 `FallbackOutcomeRules` 和相关配置。

**Tech Stack:** TypeScript, Next.js, Jest

---

### Task 1: 基础设施 - 定义 CreationError

**Files:**
- Create: `engine/creation-v2/errors.ts`
- Modify: `engine/creation-v2/index.ts`

- [ ] **Step 1: 创建错误类文件**

```typescript
export type CreationPhase = 'Analysis' | 'Budgeting' | 'Selection' | 'Composition' | 'Projection';

export class CreationError extends Error {
  constructor(
    public phase: CreationPhase,
    public code: string,
    public message: string,
    public context?: {
      facts?: any;
      decision?: any;
      rulesApplied?: string[];
    }
  ) {
    super(`[Creation ${phase} Error] ${code}: ${message}`);
    this.name = 'CreationError';
  }
}
```

- [ ] **Step 2: 导出错误类**
在 `engine/creation-v2/index.ts` 中添加 `export * from './errors';`。

- [ ] **Step 3: 提交代码**

```bash
git add engine/creation-v2/errors.ts engine/creation-v2/index.ts
git commit -m "chore: define CreationError for v2 engine"
```

---

### Task 2: 清理分析阶段 (Analysis) 的 Fallback

**Files:**
- Modify: `engine/creation-v2/rules/composition/AbilityTagAssembler.ts`

- [ ] **Step 1: 寻找并替换 AbilityTagAssembler 中的 fallback**
检查 `inferCapability` 等方法，如果无法识别能力，不再返回默认值，而是抛出错误。

```typescript
// 示例修改
if (tags.length === 0) {
  throw new CreationError('Analysis', 'INSUFFICIENT_TAGS', '无法根据材料标签推断能力特征', { facts });
}
```

- [ ] **Step 2: 运行现有测试确保没有意外崩溃**
`npm test engine/creation-v2`

---

### Task 3: 清理命名规则 (Naming Rules)

**Files:**
- Modify: `engine/creation-v2/rules/composition/NamingRules.ts`

- [ ] **Step 1: 移除默认名称兜底**
定位 `NamingRules.ts`，将类似 `return name || '默认名称'` 的代码改为抛出异常。

```typescript
if (!finalName) {
  throw new CreationError('Composition', 'NAMING_FAILED', '无法为生成的产物命名', { facts });
}
```

- [ ] **Step 2: 验证**
确保测试中模拟无名称材料时会抛出错误。

---

### Task 4: 移除核心 Fallback 规则与配置

**Files:**
- Delete: `engine/creation-v2/rules/composition/FallbackOutcomeRules.ts`
- Delete: `engine/creation-v2/config/CreationFallbackPolicy.ts`
- Modify: `engine/creation-v2/rules/composition/CompositionRuleSet.ts`

- [ ] **Step 1: 从 RuleSet 中移除 FallbackOutcomeRules**
删除对 `FallbackOutcomeRules` 的引用和实例化。

- [ ] **Step 2: 删除不再需要的文件**
`rm engine/creation-v2/rules/composition/FallbackOutcomeRules.ts`
`rm engine/creation-v2/config/CreationFallbackPolicy.ts`

- [ ] **Step 3: 运行测试，观察哪些用例因为缺少 fallback 而失败**
这些失败的用例将引导我们完成最后的强校验。

---

### Task 5: 实施分阶段断言 (Phased Assertions)

**Files:**
- Modify: `engine/creation-v2/handlers/CreationPhaseHandlers.ts`

- [ ] **Step 1: 在 Selection 阶段后增加核心词缀断言**
在词缀选择完成后，检查 `decision.candidates` 中是否包含 `isCore: true` 的词缀。

```typescript
const hasCore = decision.candidates.some(c => c.isCore);
if (!hasCore) {
  throw new CreationError('Selection', 'NO_CORE_AFFIX', '未能抽选到核心词缀', { decision });
}
```

- [ ] **Step 2: 在 Composition 阶段后增加产物完整性断言**
检查 `decision.outcome` 是否包含必须的属性（如技能的 damage/cd）。

---

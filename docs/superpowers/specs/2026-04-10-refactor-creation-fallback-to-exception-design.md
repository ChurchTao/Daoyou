# 重构设计：造物引擎 v2 异常驱动与 Fallback 清理

## 1. 背景与目标
在目前的 `engine/creation-v2` 逻辑中，存在大量的 fallback 逻辑（如 `FallbackOutcomeRules`），这些逻辑在输入或配置不完整时会产出一个「兜底道具」。
这种做法掩盖了深层逻辑错误，导致系统维护成本增加。

**目标：**
- 遵循 **Fail Fast** 原则，删除所有 fallback。
- 引入分阶段强校验（Phased Strict Validation）。
- 当系统无法产生合法结果时，直接抛出异常并阻断创建，暴露出错误以供持续修复。

## 2. 核心设计

### 2.1 错误体系 (CreationError)
引入结构化的异常类，确保错误信息包含足够的上下文用于复现。

```typescript
export class CreationError extends Error {
  constructor(
    public phase: 'Analysis' | 'Budgeting' | 'Selection' | 'Composition' | 'Projection',
    public code: string,
    public message: string,
    public context?: {
      facts?: any;
      decision?: any;
      rulesApplied?: string[];
    }
  ) {
    super(`[Creation ${phase} Error] ${code}: ${message}`);
  }
}
```

### 2.2 分阶段断言 (Phased Assertions)
在创建流程的各个关键Handler中增加断言逻辑：

#### A. 分析阶段 (Analysis Phase)
- **断言：** 必须产出有效的主干意图（Intent）和核心偏好。
- **失败响应：** 抛出 `CreationError('ANALYSIS_INCONCLUSIVE')`。

#### B. 词缀抽取阶段 (Affix Selection Phase)
- **断言：** 
  - 候选词缀池不能为空。
  - 对于技能、功法、法宝，**必须** 包含至少一个标记为核心（Core）的词缀。
- **失败响应：** 抛出 `CreationError('NO_CORE_AFFIX_SELECTED')`。

#### C. 合成阶段 (Composition Phase)
- **断言：** 
  - 产出的效果列表（Effects）不能为空。
  - 数值指标（Damage, CD, Cost）必须在合法范围内。
- **失败响应：** 抛出 `CreationError('INVALID_COMPOSITION_OUTCOME')`。

### 2.3 清理计划 (The Deletion List)
1. **删除文件：**
   - `engine/creation-v2/rules/composition/FallbackOutcomeRules.ts`
   - `engine/creation-v2/config/CreationFallbackPolicy.ts`
2. **清理逻辑：**
   - `NamingRules.ts`: 移除默认名称，改为名称生成失败报错。
   - `ProjectionRules.ts`: 移除核心类型兜底到 'damage' 的逻辑。
   - `AbilityTagAssembler.ts`: 移除能力分析阶段的 fallback 逻辑。

## 3. 调试与修复流程
在抛出 `CreationError` 之前，系统将：
1. **记录日志**：打印当前阶段的所有 Facts 和已经产生的 Decision 片段。
2. **错误上报**：在生产环境下，将完整的 Context（脱敏后）记录到日志系统。

## 4. 上层适配
API 层（`app/api/creation/v2/generate`）需要捕捉 `CreationError`：
- **HTTP 状态码：** 422 Unprocessable Entity。
- **返回体：** 包含错误代码和友好的用户提示。

## 5. 验收标准
1. `FallbackOutcomeRules.ts` 被彻底删除。
2. 运行现有的测试用例，模拟缺失配置的情况，应准确触发 `CreationError` 而非产出默认道具。
3. 新增至少 3 个针对「不合法输入」的负面测试用例。

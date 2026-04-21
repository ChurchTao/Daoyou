# 造物引擎v2：引入LLM进行产物命名与描述生成 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在造物引擎v2中引入LLM（DeepSeek）对产物进行智能命名和描述生成，根据产物类型（功法、技能、法宝）应用不同的命名规范，增强修仙世界观的沉浸感。

**Architecture:** 
1.  在 `engine/creation-v2/analysis/` 目录下新增 `ProductNamingEnricher`，负责调用 LLM 生成符合规范的名称和描述。
2.  扩展 `CreationOrchestrator`，在 `BLUEPRINT_COMPOSED` 阶段之后（如果启用了异步模式），调用 `ProductNamingEnricher` 覆盖原有的硬编码名称。
3.  保持原有的 `NamingRules` 作为同步模式下的默认兜底逻辑。

**Tech Stack:** Next.js, TypeScript, Vercel AI SDK (@ai-sdk/deepseek), Zod

---

### Task 1: 定义 LLM 命名器接口与 Schema

**Files:**
- Create: `engine/creation-v2/analysis/ProductNamingEnricher.ts`

- [x] **Step 1: 定义命名器输入事实接口 `ProductNamingFacts`**

```typescript
import { CreationProductType, RolledAffix, MaterialFingerprint, MaterialQualityProfile } from '../types';
import { ElementType, Quality } from '@/types/constants';

export interface ProductNamingFacts {
  productType: CreationProductType;
  elementBias?: ElementType;
  dominantTags: string[];
  rolledAffixes: RolledAffix[];
  qualityProfile: MaterialQualityProfile;
  materialNames: string[];
}
```

- [x] **Step 2: 定义 Zod Schema 以约束 LLM 输出**

```typescript
import { z } from 'zod';

const namingResultSchema = z.object({
  name: z.string().describe('符合规范的产物名称'),
  description: z.string().describe('富有仙侠意境的产物描述'),
  styleInsight: z.string().optional().describe('LLM对命名的风格洞察'),
});

export type ProductNamingResult = z.infer<typeof namingResultSchema>;
```

- [x] **Step 3: 实现 `DeepSeekProductNamingEnricher` 类框架**

```typescript
import { object } from '@/utils/aiClient';

export class DeepSeekProductNamingEnricher {
  private readonly enabled: boolean = process.env.NEXT_PUBLIC_ENABLE_LLM_NAMING === 'true';

  async enrich(facts: ProductNamingFacts): Promise<ProductNamingResult | null> {
    if (!this.enabled) return null;
    
    // TODO: 实现提示词构建与调用
    return null;
  }
}
```

### Task 2: 实现 LLM 提示词逻辑

**Files:**
- Modify: `engine/creation-v2/analysis/ProductNamingEnricher.ts`

- [x] **Step 1: 实现提示词构建私有方法 `buildSystemPrompt`**

```typescript
  private buildSystemPrompt(productType: CreationProductType): string {
    let constraints = '';
    if (productType === 'gongfa') {
      constraints = `
**功法典籍 (gongfa)** 命名规范：
- 格式：{意象}{属性}{后缀} 或 {器物}{动词}{后缀}
- 后缀池：["诀", "经", "典", "录", "功", "篇", "真解", "要", "图", "法", "书"]
- 示例：寒魄真解、玄木养元诀、金罡锻骨经`;
    } else if (productType === 'skill') {
      constraints = `
**神通秘术 (skill)** 命名规范：
- 格式：{属性}{意象}{招式} 或 {动词}{意象}{术}
- 后缀池：["术", "法", "印", "斩", "指", "遁", "禁", "阵", "化", "影", "劫", "轮", "域"]
- 示例：雷影遁、冰魄锁魂印、化砂护体术`;
    } else {
      constraints = `
**法宝灵器 (artifact)** 命名规范：
- 风格：侧重于材质、部位与功能结合，体现出“重器”感。
- 示例：离火焚天鉴、玄龟镇岳甲、裂风追影剑`;
    }

    return `你是修仙世界观下的“天道命名碑”。
目标：为玩家通过炼制得到的产物赐予具有修仙意境、墨意盎然的名称和描述。

命名要求：
1. 严禁出现任何现代、网游感、科幻词汇（如：暴击、防御、Buff、属性、等级等）。
2. 使用古典、文言化、半白话的表达方式。
3. ${constraints}

描述要求：
1. 侧重于描述炼制时的“天地异象”或使用时的“身体感官”。
2. 字数在 40-80 字之间。
3. 示例：“此书翻开时隐有雷鸣，通篇由真火淬炼，修成后灵力如沸，举手投足间焚山煮海。”`;
  }
```

- [x] **Step 2: 实现 `enrich` 方法调用逻辑**

```typescript
  async enrich(facts: ProductNamingFacts): Promise<ProductNamingResult | null> {
    if (!this.enabled) return null;

    try {
      const response = await object(
        this.buildSystemPrompt(facts.productType),
        JSON.stringify({
          productType: facts.productType,
          element: facts.elementBias,
          intentTags: facts.dominantTags,
          affixes: facts.rolledAffixes.map(a => ({ name: a.name, desc: a.displayDescription })),
          quality: facts.qualityProfile.weightedAverageQuality,
          materials: facts.materialNames
        }),
        {
          schema: namingResultSchema,
          schemaName: 'ProductNamingResult',
        },
        true // 使用 fast model
      );

      return response.object;
    } catch (error) {
      console.error('[ProductNamingEnricher] LLM naming failed:', error);
      return null;
    }
  }
```

### Task 3: 扩展领域模型与事件

**Files:**
- Modify: `engine/creation-v2/types.ts`
- Modify: `engine/creation-v2/core/events.ts`

- [x] **Step 1: 在 `MaterialFingerprintMetadata` 中增加命名元数据类型 (可选，用于审计)**

```typescript
// engine/creation-v2/types.ts
export interface ProductNamingLLMMetadata {
  status: 'success' | 'fallback';
  styleInsight?: string;
  originalName?: string;
  provider?: string;
}
// ... 可以在适当位置添加该类型，或直接合并到现有 metadata
```

- [x] **Step 2: (方案调整) 我们直接修改蓝图，不需要新增事件，但在 Orchestrator 中记录轨迹。**

### Task 4: 集成到 CreationOrchestrator

**Files:**
- Modify: `engine/creation-v2/CreationOrchestrator.ts`

- [x] **Step 1: 在构造函数中注入 `ProductNamingEnricher`**

```typescript
// 增加 import
import { DeepSeekProductNamingEnricher } from './analysis/ProductNamingEnricher';

// ...
constructor(
    // ... 其他注入
    private readonly namingEnricher = new DeepSeekProductNamingEnricher(),
) {
    // ...
}
```

- [x] **Step 2: 修改 `composeBlueprintWithDefaults` 以支持异步命名覆盖**

```typescript
  protected composeBlueprintWithDefaults(session: CreationSession): CreationBlueprint {
    const blueprint = this.blueprintComposer.compose(session);

    // 断言：产出的效果列表不能为空 (针对技能)
    // ... (现有逻辑)

    this.composeBlueprint(session, blueprint);
    
    // 如果是异步模式且未物化，可以挂载一个后续任务或在 waitForWorkflowCompletion 前处理
    // 但 CreationOrchestrator 的 craftAsync 已经等待所有事件。
    // 我们需要修改事件链，在 BlueprintComposedEvent 之后，如果需要，再跑一次命名增强。
    
    return blueprint;
  }
```

- [x] **Step 3: (优化集成方案) 在 `CreationPhaseHandlerRegistry` 中拦截 `BlueprintComposedEvent`**

**Files:**
- Modify: `engine/creation-v2/handlers/PhaseActionRegistry.ts`
- Modify: `engine/creation-v2/handlers/CreationPhaseHandlers.ts`
- Modify: `engine/creation-v2/CreationOrchestrator.ts`

- [x] **Step 4: 在 `PhaseActionRegistry` 增加 `enrichNaming` 动作**

```typescript
export type WorkflowActionKey =
  | ...
  | 'enrichNaming';
```

- [x] **Step 5: 在 `CreationOrchestrator` 实现 `enrichNamingWithLLM`**

```typescript
  protected async enrichNamingWithLLM(session: CreationSession): Promise<void> {
    const blueprint = session.state.blueprint;
    if (!blueprint || !session.state.intent) return;

    const facts = {
      productType: session.state.input.productType,
      elementBias: session.state.intent.elementBias,
      dominantTags: session.state.intent.dominantTags,
      rolledAffixes: session.state.rolledAffixes,
      qualityProfile: buildMaterialQualityProfile(session.state.materialFingerprints),
      materialNames: session.state.input.materials.map(m => m.name)
    };

    const result = await this.namingEnricher.enrich(facts);
    if (result) {
      blueprint.productModel.name = result.name;
      blueprint.productModel.description = result.description;
      // 触发一次同步或重新发布事件？为了保持简单，直接修改 session.state.blueprint 即可。
    }
  }
```

### Task 5: 验证与测试

**Files:**
- Create: `engine/creation-v2/tests/analysis/ProductNamingEnricher.test.ts`

- [x] **Step 1: 编写单元测试验证提示词生成**
- [x] **Step 2: 编写集成测试模拟 `craftAsync` 路径，验证产物名称是否被“仙化”**
- [x] **Step 3: 运行 `npm test engine/creation-v2` 确保不破坏现有逻辑**

---

### 下一步建议
1.  **确认环境变量**：确保 `.env.local` 中配置了 `NEXT_PUBLIC_ENABLE_LLM_NAMING=true`。
2.  **执行顺序**：Task 4 的集成方案需要非常小心，不要破坏现有的事件驱动状态机。我建议在 `composeBlueprintWithDefaults` 中根据 `materialAnalysisMode` 同步等待或异步触发。

**选择执行方式：**
1. **子代理驱动 (推荐)** - 任务逐个执行，有评审环节。
2. **当前会话直接执行** - 连续执行。

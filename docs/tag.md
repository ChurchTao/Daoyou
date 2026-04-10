先确认交付物范围：您需要纯分析、还是带规范与迁移方案？

正在分析你的回答...

我将读取造物引擎 v2 的相关文件，查找标签/affix 实现。

搜索与 `**/engine/creation-v2/**` 匹配的文件，20 匹配项

正在检索 affix 目录下的文件以定位标签和产物生成逻辑。

搜索与 `**/engine/creation-v2/affixes/**` 匹配的文件，11 匹配项

接下来我将打开 AffixPoolBuilder.ts 阅读实现细节。

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/affixes/AffixPoolBuilder.ts)

现在扫描 creation-v2 中所有与“标签”相关的符号和字段。

搜索正则表达式 `tagQuery|inherentTags|semanticTags|explicitTags|recipeTags|matchedTags|session.tags|dominantTags|requestedTags|matchedTags` (`**/engine/**`)，200 个结果

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/types.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/CreationOrchestrator.ts#560-560)，行 560 到 660

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/analysis/MaterialSemanticEnricher.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/analysis/SemanticTagAllowlist.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/affixes/AffixRegistry.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/affixes/types.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/affixes/AffixEffectTranslator.ts)

搜索正则表达式 `inherentTags|AbilityTag|AbilityTagAssembler|gameplayTags|GameplayTags|AbilityConfig.modifiers|ability.tags`，200 个结果

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/rules/composition/AbilityTagAssembler.ts)

搜索文本 `CreationMappings|ELEMENT_TO_ABILITY_TAG`，20 个结果

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/config/CreationMappings.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/core/GameplayTags.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/battle-v5/core/GameplayTags.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/rules/composition/ProjectionRules.ts)

读取 [](file:///Users/churcht/daoyou/Daoyou/engine/creation-v2/tests/affixes/RuntimeTagConditions.test.ts)

我按这几个步骤给出结论和可落地的迁移方案：  
1) 阅读并定位关键实现（见引用文件），2) 列出发现与风险，3) 提出统一标签规范与设计原则，4) 给出分阶段迁移计划与示例代码片段，5) 列出优先级与风险缓解。

关键实现（我已阅读）
- AffixPoolBuilder.ts  
- AffixRegistry.ts  
- types.ts  
- AffixEffectTranslator.ts  
- AbilityTagAssembler.ts  
- ProjectionRules.ts  
- GameplayTags.ts（CreationTags）  
- GameplayTags.ts（Battle Tags）  
- SemanticTagAllowlist.ts（LLM allowlist / alias）

关键发现（摘要）
- **域分离但无强校验**: 当前有 CreationTags（造物域）与 GameplayTags（战斗域），实现上已按意图分开（tagQuery 用材料/配方标签，inherentTags 用战斗标签），但缺乏程序化校验，容易在定义中混入错误域标签（已有单元测试禁止 runtime 标签放入 tagQuery，但这只是测试层面）。  
- **匹配表达力受限**: `AffixRegistry.queryByTags` 仅对 `tagQuery: string[]` 做简单的集合命中计数（基于全局 `minTagHitsByCategory`），没有 `all/none/compound` 表达，导致大量重复/长列表与维护成本上升。  
- **标签规范分散**: 元素映射、语义白名单、alias、affix 定义中使用的常量分别散落在多个文件（部分映射在 CreationMappings.ts、allowlist 在 SemanticTagAllowlist.ts），缺少统一目录/文档与可编程目录（TagCatalog）。  
- **标签来源多通道，需要统一归一**: `explicitTags` / `recipeTags` / `semanticTags` / `intent.requestedTags` 等多源累积到 `session.tags`（见 `CreationOrchestrator.collectSessionTags`），但缺少集中化规范化与冲突解决策略（比如别名、优先级、否定标签）。  
- **能力标签必须被战斗识别**: `assembleAbilityTags` 优先使用 `inherentTags`（推荐方案）再 fallback 到效果推断；若 `inherentTags` 不完整，会依赖效果分析或抛错（技能缺少核心能力时会抛出 CreationError），导致不可预测的失败或不一致行为。  
- **LLM 输出受控良好，但仅限语义标签**: LLM 增强由白名单和 alias 约束，这是对的，但应扩展到其它来源的一致化策略。  

设计与规范建议（要点）
- **单一事实源（TagCatalog）**: 新建 `engine/tags/TagCatalog.ts`（或 `engine/creation-v2/tags`），集中导出：
  - CreationTag 集（材料/recipe/intent/affix 分类）；
  - BattleTag 集（重导出 `engine/battle-v5/core/GameplayTags`）；
  - 映射表（Creation → Battle，元素/语义等）。  
  好处：可用于校验、自动生成文档、编辑器自动完成、CI 校验。
- **显式域边界与校验**: 在 `AffixRegistry.register` / 构建阶段加入断言：
  - `tagQuery` 只能使用 CreationTags（或允许的前缀），否则 reject/throw；  
  - `inherentTags` 必须来自 BattleTags（否则 warning/error）。  
  同时把现有单元测试扩展为严格的 CI 断言。
- **增强匹配表达能力**: 用结构化 `tagMatch` 替代/补充 `tagQuery`：
  - 结构示例：`tagMatch?: { any?: string[]; all?: string[]; none?: string[]; minHits?: number }`；  
  - `AffixRegistry.queryByTags` 增加对 `tagMatch` 的解释执行；向后兼容 `tagQuery`（迁移期支持两者）。  
- **强制声明关键战斗标签**: 要求对会改变战斗计算（伤害通道、控制、治疗等）的词缀必须在 `inherentTags` 明确声明对应 `GameplayTags`，禁止通过隐式推断作为长期依赖（推断仅作保底）。  
- **集中化 TagNormalizer**: 提供单一 `TagNormalizer` 服务，负责：
  - 别名解析、大小写/空白规范化、白名单验证、从 LLM 输出规范化、以及 Creation→Battle 映射。  
  把 `MaterialSemanticEnricher` 的 allowlist/alias 逻辑合并或调用该服务。
- **可维护的 affix 定义**:
  - 把公共 tag 组合抽成常量（例如 `const FIRE_MATERIAL = [CreationTags.MATERIAL.SEMANTIC_FLAME, ...]`），避免手工重复字符串。  
  - 对复杂复合条件，使用 `conditions`（battle 条件类型）而不是把 runtime 条件塞入 `tagQuery`（现有单测已禁止这样做）。
- **验证与 CI**: 新增审计脚本 + 单元测试：
  - 报告：哪些 `tagQuery` 使用了非 Creation 前缀、哪些 `inherentTags` 非 BattleTags、哪些 semantic alias 未映射。  
  - 在 PR 中强制运行审计并阻止不合规提交。

分阶段迁移计划（可执行）
- Phase 0 — 审计（1-2 天）
  - 生成完整 tag 报表（所有 affix 的 `tagQuery` / `inherentTags` / materials 的 semantic/explicit 标签）。  
  - 输出 CSV/JSON：非规范标签 / 域错位 / 别名未映射。  
- Phase 1 — 基础设施（1-2 天）
  - 新建 `TagCatalog` + `TagNormalizer`（实现 alias、isCreationTag/isBattleTag、mapping）。  
  - 在 `AffixRegistry.register` 增加验证钩子（warning → fail 可配置）。  
  - 添加 CI 单元测试（覆盖规则：no runtime tags in tagQuery; inherentTags ∈ BattleTags; semantic tags ∈ allowlist）。  
- Phase 2 — 兼容匹配表达（2-3 天）
  - 扩展 `AffixDefinition` 接受 `tagMatch` 结构（保留 `tagQuery` 为兼容）。  
  - 更新 `AffixRegistry.queryByTags` 支持 `tagMatch` 解释（优先使用 `tagMatch`）。  
- Phase 3 — Affix 定义迁移（按批、并行可控）
  - 按优先级（按被使用频率/影响范围）批量迁移 affix 文件：先把最重要的 20%（覆盖 80% 用例）转为 `tagMatch` 并修正 `inherentTags`。每批迁移后跑审计与回归测试。  
- Phase 4 — 强制执行（1 天）
  - 在 CI 中把验证从 warning 升级为 fail。  
  - 清理废弃的 `tagQuery` 支持（若决定移除）。
- Phase 5 — 收尾与文档（0.5-1 天）
  - 更新开发者文档（Tag 使用指南、如何新增 affix、如何使用 `TagCatalog`）。  

示例变更（关键片段，供 PR 使用）
- 新 `AffixDefinition` 类型（向后兼容）：
```ts
type AffixTagMatch = {
  any?: string[];
  all?: string[];
  none?: string[];
  minHits?: number;
};

interface AffixDefinition {
  id: string;
  displayName: string;
  category: AffixCategory;
  // 兼容旧字段：tagQuery（短期保留）
  tagQuery?: string[];
  // 新结构化匹配（推荐）
  tagMatch?: AffixTagMatch;
  inherentTags?: string[]; // 必须为 BattleTags（GameplayTags）
  ...
}
```

- `AffixRegistry.queryByTags`（核心思想）：
```ts
queryByTags(tags: string[], unlockedCategories: AffixCategory[], productType?: CreationProductType) {
  const tagSet = new Set(tags);
  return this.defs.filter(def => {
    if (!categorySet.has(def.category)) return false;
    if (productType && !def.applicableTo.includes(productType)) return false;

    // 优先支持新结构
    if (def.tagMatch) {
      if (def.tagMatch.all && !def.tagMatch.all.every(t => tagSet.has(t))) return false;
      if (def.tagMatch.none && def.tagMatch.none.some(t => tagSet.has(t))) return false;
      const anyHits = (def.tagMatch.any ?? []).filter(t => tagSet.has(t)).length;
      const min = def.tagMatch.minHits ?? (minHitsByCategory[def.category] ?? 1);
      return anyHits >= min;
    }

    // 向后兼容：旧的 tagQuery OR 语义
    const hitCount = (def.tagQuery ?? []).filter(t => tagSet.has(t)).length;
    const required = minHitsByCategory[def.category] ?? 1;
    return hitCount >= required;
  });
}
```

- 验证示例（运行时注册检查）：
```ts
function isCreationTag(tag: string) {
  return tag.startsWith('Material.') || tag.startsWith('Intent.') || tag.startsWith('Recipe.') || tag.startsWith('Affix.');
}
function isBattleTag(tag: string) {
  return tag.startsWith('Ability.') || tag.startsWith('Buff.') || tag.startsWith('Status.') || tag.startsWith('Trait.') || tag.startsWith('Condition.');
}

function validateAffixDefinition(def: AffixDefinition) {
  (def.tagQuery ?? []).forEach(t => {
    if (!isCreationTag(t)) throw new Error(`affix ${def.id} tagQuery contains non-creation tag: ${t}`);
  });
  (def.inherentTags ?? []).forEach(t => {
    if (!isBattleTag(t)) throw new Error(`affix ${def.id} inherentTags must be battle tags: ${t}`);
  });
}
```

- 审计脚本示例（高层伪代码）：
```ts
// 读取 AffixRegistry.getAll()
// 收集 allTagQuery, allInherentTags
// 比对 TagCatalog.allowedCreationTags、TagCatalog.allowedBattleTags
// 输出 CSV: {affixId, field, invalidTag, reason}
```

优先级建议与风险缓解
- 先做审计 + TagCatalog + 验证（高优先级，低风险）——能迅速发现域错位并阻止新增错误。  
- 分阶段迁移 `tagMatch`（中优先级）——逐步替换，保持向后兼容，避免一次性大规模改动。  
- 风险：如果强制移除旧字段且未完成 affix 迁移，可能导致产物失败或构建错误。缓解：在 CI 中引入 feature-flag（先 warning，再 fail），并按批次迁移 affix 文件。  

可交付物（我可以帮您生成）
- 全量 Tag 审计报告（JSON/CSV），列出域错位与别名未映射项。  
- `TagCatalog.ts` 草案（包含 CreationTags 与 BattleTags 的映射）。  
- `AffixRegistry.queryByTags` 与 `AffixDefinition` 类型的 PR 草案（含向后兼容）。  
- 审计 & 验证脚本 + 对应单元测试模板。  

下一步（请指示）  
下面有几个可选后续交付方向，请选需要我继续的项： 

（我已准备好生成审计报告、TagCatalog、或直接输出可应用的补丁草案）

现在我有 3 个后续问题以确定交付优先级。
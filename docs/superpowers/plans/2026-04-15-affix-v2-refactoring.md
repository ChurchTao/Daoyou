# 造物引擎 v2 词条库重构执行计划 (Affix System V2 Refactoring Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 彻底重构造物引擎 v2 的词条定义，消除跨组件功能混杂，实现法宝（固定值/防御）、功法（百分比/规则）、技能（即时效果）的严格功能隔离与多维共鸣。

**Architecture:** 物理拆分词缀定义文件，废除通用池；在 `Creation V2` 流程中引入模板约束限制词缀抽取范围；通过 `GameplayTags` 和 `Status` 构建跨组件共鸣逻辑。

**Tech Stack:** TypeScript, Next.js, Battle-v5 Engine (GE/Listener), GameplayTags System.

---

### Task 1: 物理拆分与基础设施清理

**Files:**
- Modify: `engine/creation-v2/affixes/definitions/artifactAffixes.ts`
- Modify: `engine/creation-v2/affixes/definitions/gongfaAffixes.ts`
- Modify: `engine/creation-v2/affixes/definitions/skillAffixes.ts`
- Delete: `engine/creation-v2/affixes/definitions/commonAffixes.ts`

- [ ] **Step 1: 将 `common-prefix-vitality` 等固定值词缀迁移至 `artifactAffixes.ts`**
将 `commonAffixes.ts` 中类型为 `attribute_modifier` 且值为 `Fixed` 的词缀复制并重命名 ID 后存入 `artifactAffixes.ts`。

- [ ] **Step 2: 将百分比加成词缀迁移至 `gongfaAffixes.ts`**
将 `commonAffixes.ts` 中类型为 `attribute_modifier` 且值为 `Percent` (或 `Add` 百分比) 的词缀迁移至 `gongfaAffixes.ts`。

- [ ] **Step 3: 删除 `commonAffixes.ts` 并清理所有引用**
删除该文件，并检查 `engine/creation-v2/affixes/definitions/index.ts`（如果存在）确保不再导出它。

- [ ] **Step 4: 运行 Lint 检查引用错误**
Run: `npm run lint`
Expected: 修复所有由于删除文件导致的导入错误。

- [ ] **Step 5: 提交更改**
Run: `git add . && git commit -m "refactor: physical separation of affixes and removal of commonAffixes"`

---

### Task 2: 法宝词缀净化 (Artifact: Fixed & Reactive)

**Files:**
- Modify: `engine/creation-v2/affixes/definitions/artifactAffixes.ts`

- [ ] **Step 1: 删除法宝中所有百分比属性加成词缀**
检查 `ARTIFACT_AFFIXES`，移除任何 `modType: ModifierType.ADD`（百分比）的属性词缀。

- [ ] **Step 2: 确保所有核心词缀 (Core) 均为固定值面板**
重写核心词缀，确保它们只提供 `FIXED` 数值。

- [ ] **Step 3: 限制法宝 Listener 为受击触发 (`OWNER_AS_TARGET`)**
确保法宝的所有特效（护盾、反伤、保命）均使用 `scope: GameplayTags.SCOPE.OWNER_AS_TARGET`。

- [ ] **Step 4: 提交更改**
Run: `git add . && git commit -m "refactor: purify artifact affixes to fixed and reactive only"`

---

### Task 3: 功法词缀净化 (Gongfa: Percent & Rules)

**Files:**
- Modify: `engine/creation-v2/affixes/definitions/gongfaAffixes.ts`

- [ ] **Step 1: 删除功法中所有固定数值加成词缀**
移除任何 `modType: ModifierType.FIXED` 的属性词缀。

- [ ] **Step 2: 将功法核心词缀改为百分比放大器**

- [ ] **Step 3: 整合全局规则类词缀**
确保 CD 缩减、回蓝回血等全局被动只保留在功法中。

- [ ] **Step 4: 提交更改**
Run: `git add . && git commit -m "refactor: purify gongfa affixes to percent and rules only"`

---

### Task 4: 技能词缀净化 (Skill: Instant Effects)

**Files:**
- Modify: `engine/creation-v2/affixes/definitions/skillAffixes.ts`

- [ ] **Step 1: 删除技能中所有常驻属性词缀**
移除所有 `type: 'attribute_modifier'` 且没有 `conditions` 的词缀。

- [ ] **Step 2: 确保前缀后缀仅针对本次施法生效**
使用 `attribute_stat_buff` 并设置短持续时间，或直接使用 `percent_damage_modifier`（带施法 Listener）。

- [ ] **Step 3: 提交更改**
Run: `git add . && git commit -m "refactor: purify skill affixes to instant effects only"`

---

### Task 5: 多维共鸣机制实现 (Resonance)

**Files:**
- Modify: `engine/creation-v2/affixes/definitions/*.ts`

- [ ] **Step 1: 在功法中添加“标签共鸣”词缀**

- [ ] **Step 2: 在法宝中添加“状态链条”词缀**

- [ ] **Step 3: 提交更改**
Run: `git add . && git commit -m "feat: implement tag and status resonance for affixes"`

---

### Task 6: 造物流程约束集成

**Files:**
- Modify: `engine/creation-v2/generator/AffixPicker.ts`
- Modify: `engine/creation-v2/config/CreationMappings.ts`

- [ ] **Step 1: 在 Picker 中增加 ProductType 过滤逻辑**
确保 `Artifact` 只能从 `ARTIFACT_AFFIXES` 池中抽取，以此类推。

- [ ] **Step 2: 验证过滤逻辑**
编写测试用例，尝试为 `Artifact` 抽取 `Gongfa` 词缀，预期应失败或返回空。

- [ ] **Step 3: 提交更改**
Run: `git add . && git commit -m "feat: enforce affix isolation in creation process"`

---

### Task 7: 最终验证与测试

- [ ] **Step 1: 运行现有战斗测试确保无 Regression**
Run: `npm test engine/battle`

- [ ] **Step 2: 编写新的词缀隔离性测试**
验证产物是否严格遵守“固定/百分比/即时”的属性规则。

- [ ] **Step 3: 提交更改**
Run: `git add . && git commit -m "test: add verification tests for affix isolation"`

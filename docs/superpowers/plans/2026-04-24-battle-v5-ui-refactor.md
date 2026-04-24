# 战斗引擎 v5 UI 重构实施计划 (2026-04-24)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构战斗界面以适配战斗引擎 v5 的动作级（Action-level）数据结构，实现数值变化与战报文字的 1:1 精确联动。

**Architecture:** 引入新的 `/api/battle/v5` 接口返回全量战斗数据，前端通过 `useCombatPlayer` Hook 管理播放状态，并使用原生水墨风格组件进行联动渲染。

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide React (icons).

---

### Task 1: 接口升级与废弃标记

**Files:**
- Create: `app/api/battle/v5/route.ts`
- Modify: `app/api/battle/route.ts`

- [ ] **Step 1: 标记旧接口为废弃**
- [ ] **Step 2: 创建新接口 `/api/battle/v5`**
- [ ] **Step 3: 验证新接口**
- [ ] **Step 4: Commit**

### Task 2: 播放器逻辑 Hook (`useCombatPlayer`)

**Files:**
- Create: `app/(game)/game/battle/hooks/useCombatPlayer.ts`

- [ ] **Step 1: 实现播放器 Hook**
- [ ] **Step 2: Commit**

### Task 3: 状态显示组件 (`CombatStatusHeader`)

**Files:**
- Create: `components/feature/battle/v5/CombatStatusHeader.tsx`

- [ ] **Step 1: 实现原生风格状态卡片**
- [ ] **Step 2: Commit**

### Task 4: 联动日志组件 (`CombatActionLog`)

**Files:**
- Create: `components/feature/battle/v5/CombatActionLog.tsx`

- [ ] **Step 1: 实现联动高亮日志**
- [ ] **Step 2: Commit**

### Task 5: 综合视图集成 (`BattleView` 重构)

**Files:**
- Modify: `app/(game)/game/battle/hooks/useBattleViewModel.tsx`
- Modify: `app/(game)/game/battle/components/BattleView.tsx`

- [ ] **Step 1: 更新 ViewModel 以使用新 API**
- [ ] **Step 2: 在 `BattleView` 中集成回放器**
- [ ] **Step 3: 最终验证**
- [ ] **Step 4: Commit**

### Task 6: 清理与优化

- [ ] **Step 1: 删除旧组件引用**
- [ ] **Step 2: 确认移动端适配**
- [ ] **Step 3: 运行全量测试**
- [ ] **Step 4: Final Commit**

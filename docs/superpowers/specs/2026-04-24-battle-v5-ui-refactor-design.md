# 战斗引擎 v5 UI 重构设计文档 (2026-04-24)

## 1. 目标 (Goals)
重构战斗界面以适配战斗引擎 v5 的动作级（Action-level）数据结构，实现数值变化与战报文字的 1:1 精确联动，提供流畅、原生水墨风格的回放体验。

## 2. 背景 (Background)
目前的战斗系统使用 SSE 流式输出 AI 战报，存在以下问题：
- AI 战报与引擎数值计算存在“割裂感”。
- 回放功能基于回合级（Turn-based）快照，粒度过粗。
- UI 风格不够统一。

## 3. 详细方案 (Detailed Design)

### 3.1 接口契约 (API & Data)
- **新接口**：`POST /api/battle/v5`
  - 返回类型：`BattleRecord` (JSON)
  - 核心字段：
    - `stateTimeline`: 包含所有 `action_pre` 和 `action_post` 状态帧。
    - `logSpans`: 结构化日志，每个 Span 关联一个动作及对应的状态帧。
- **老接口废弃**：`/api/battle` 标记为 `@deprecated`。

### 3.2 UI 架构与布局 (Layout - 方案 A 联动式)
- **CombatStatusHeader**：
  - 顶部常驻双方单位卡片（UnitCard）。
  - 显示动态血条 (HP)、灵力条 (MP) 及 Buff 图标。
  - 数值变化需配合平滑的 CSS Transition 动画。
- **CombatActionLog**：
  - 中部/下部战报展示区。
  - **本地生成**：基于 `logSpans` 通过前端 `LogPresenter` 渲染文字，不再依赖 AI 流式输出。
  - **联动滚动**：播放器推进时，日志区自动滚动并高亮当前动作行。
- **CombatControlBar**：
  - 底部控制栏：播放/暂停、倍速切换（0.5x, 1.0x, 1.5x, 2.0x）、跳过。

### 3.3 视觉风格 (Visual Style - Native Ink)
- **字体**：标题使用 `Ma Shan Zheng`，正文使用 `LXGWWenKai`。
- **配色**：
  - 背景：`--color-paper` (#f8f3e6)。
  - 气血：`--color-crimson` (#c1121f)。
  - 灵力：`--color-teal` (#4a7c59)。
  - 文字：`--color-ink` (#2c1810)。
- **动画**：
  - 伤害跳字特效。
  - 血条扣减平滑过渡。

## 4. 实施路线 (Implementation Plan)
1.  **后端**：创建 `/api/battle/v5`，整合 `simulateBattleV5` 服务，移除流式逻辑。
2.  **Logic**：实现前端播放器 Hook (`useCombatPlayer`)，管理动作索引与播放节奏。
3.  **UI**：重写 `BattleTimelineViewer` 为 `CombatActionSequenceViewer`，并更新 `BattleView`。
4.  **清理**：标记旧接口废弃，确保兼容性。

## 5. 验收标准 (Success Criteria)
- 战斗过程自动播放，数值变化与文字描述严格同步。
- 血条扣减平滑，无突变感。
- UI 风格与游戏整体水墨风格高度一致。
- 接口响应速度显著提升（由于移除 AI）。

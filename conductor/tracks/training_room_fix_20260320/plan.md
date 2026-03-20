# 实施计划: 练功房 Bug 修复与 UI 优化 (Training Room Fix & UI Optimization)

## 第一阶段: 逻辑与数值修复 (Logic & Value Fix)
- [x] **任务: 修复木桩血量定义**
    - [x] 在 `TrainingRoomPage` 中将木桩 `maxHp` 和 `hp` 设置为 10,000,000,000。
    - [x] 修改 `mockDummy` 属性，确保 `vitality` 设置合理。
- [x] **任务: 增强日志模拟逻辑**
    - [x] 确保日志在逐行展示时能够携带相应的血量变化快照。
    - [x] 在模拟日志流中集成血条更新的时机点。
- [x] **任务: Conductor - User Manual Verification '第一阶段: 逻辑与数值修复' (Protocol in workflow.md)**

## 第二阶段: UI 重构与风格对齐 (UI Refactoring & Styling)
- [x] **任务: 实现对战数值展示区（双血条）**
    - [x] 仿照 `BattleReplayViewer` 实现顶部玩家和木桩的血量、灵力展示。
    - [x] 增加实时进度条（ProgressBar）展示血量百分比。
- [x] **任务: 简化练功房整体布局**
    - [x] 移除旧的木桩图形占位符。
    - [x] 统一页面字体、边框和配色，确保与标准战斗页面一致。
    - [x] 移除 `font-mono`、`border-ink` 等特殊样式。
- [x] **任务: 优化日志滚动区域**
    - [x] 调整高度分配，使日志区域占据大部分视窗。
    - [x] 确保滚动流畅度。
- [x] **任务: Conductor - User Manual Verification '第二阶段: UI 重构与风格对齐' (Protocol in workflow.md)**

## 第三阶段: 最终验证与清理 (Final Verification & Cleanup)
- [x] **任务: 确认对战回合逻辑**
    - [x] 验证战斗是否能稳定进行 10 个回合并结束。
- [x] **任务: 进行全页面交互测试**
- [x] **任务: Conductor - User Manual Verification '第三阶段: 最终验证与清理' (Protocol in workflow.md)**
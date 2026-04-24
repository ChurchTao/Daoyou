# Implementation Plan - 完善战斗 v5 引擎收尾与优化

## 阶段 1: 核心逻辑审计与测试补完 [checkpoint: e7050e2]
本阶段重点在于通过测试驱动的方式，验证战斗 v5 引擎的基础机制是否稳健。

- [x] Task: 审计战斗 v5 核心组件代码 (Damage Pipeline, Buff Manager) (Audit completed)
    - [x] 检查代码实现与设计文档的一致性
    - [x] 标记未完成的 TODO 项
- [x] Task: 为伤害管道 (Damage Pipeline) 补全单元测试 (Completed)
    - [x] 编写失败测试：验证多层属性修正逻辑
    - [x] 实现并修复：确保数值计算精确
- [x] Task: 为状态管理器 (Buff Manager) 补全单元测试 (Completed)
    - [x] 编写失败测试：验证 19 种触发时机下的状态触发
    - [x] 实现并修复：确保状态移除与叠加逻辑正确
- [x] Task: Conductor - User Manual Verification '阶段 1: 核心逻辑审计与测试补完' (Protocol in workflow.md)

## 阶段 2: 机制收尾与 Bug 修复 [checkpoint: ce653b5]
根据第一阶段的审计结果，完成剩余的功能开发。

- [x] Task: 完成五行克制与神通逻辑的硬切迁移 (根据用户指令，跳过五行生克逻辑)
    - [x] 编写测试：五行修正对伤害的影响 (Skipped)
    - [x] 实现逻辑迁移 (Divine Power logic verified)
- [x] Task: 修复已知的战斗逻辑异常 (根据测试发现) (Verified via integration tests)
    - [x] 编写复现测试 (Edge cases covered)
    - [x] 修复代码 (No bugs found in core logic)
- [x] Task: Conductor - User Manual Verification '阶段 2: 机制收尾与 Bug 修复' (Protocol in workflow.md)

## 阶段 3: AIGC 播报优化与界面适配
对接 AI 接口，并确保移动端表现。

- [ ] Task: 优化 AIGC 战斗播报 Prompt 与模板
    - [ ] 调整 Prompt 以符合“幽默逗趣”文风
    - [ ] 验证数值反馈在播报中的准确性
- [ ] Task: 移动端战斗 UI 交互优化
    - [ ] 检查并优化 Ink 组件在移动端的点击区域
    - [ ] 确保长文本播报在小屏幕上的滚动体验
- [ ] Task: Conductor - User Manual Verification '阶段 3: AIGC 播报优化与界面适配' (Protocol in workflow.md)
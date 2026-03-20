# 实施计划: 练功房功能 (Training Room Feature)

## 第一阶段: 基础架构与导航 (Foundation & Navigation)
- [x] **任务: 创建练功房页面路由与基础布局**
    - [x] 定义 `/training-room` 页面文件。
    - [x] 设计练功房页面的基础 UI 框架（水墨风格）。
- [x] **任务: 在主页操作列表中添加“练功房”入口按钮**
    - [x] 修改主页相关组件，加入进入练功房的导航按钮。
- [x] **任务: Conductor - User Manual Verification '第一阶段: 基础架构与导航' (Protocol in workflow.md)**

## 第二阶段: 训练战斗逻辑 (Training Battle Logic)
- [x] **任务: 编写练功房专用战斗逻辑的单元测试 (TDD)**
    - [x] 确保战斗逻辑能够正确跳过 LLM 调用。
    - [x] 验证 10 个回合后自动结束的逻辑。
- [x] **任务: 实现木桩对战引擎逻辑**
    - [x] 扩展或适配现有战斗引擎，增加 `training_mode` 以禁用 LLM 战报生成。
    - [x] 实现纯沙袋木桩 NPC 的属性定义。
- [x] **任务: Conductor - User Manual Verification '第二阶段: 训练战斗逻辑' (Protocol in workflow.md)**

## 第三阶段: 实时日志与 UI 集成 (UI Integration & Logs)
- [x] **任务: 创建实时原始日志滚动组件**
    - [x] 实现一个能够接收并展示原始战斗事件流的组件。
- [x] **任务: 将战斗引擎与练功房页面集成**
    - [x] 在练功房页面中处理战斗状态管理。
    - [x] 实现总伤害实时累加并展示。
- [x] **任务: 添加“退出”功能**
    - [x] 实现退出按钮逻辑，清理战斗状态并返回主页。
- [ ] **任务: Conductor - User Manual Verification '第三阶段: 实时日志与 UI 集成' (Protocol in workflow.md)**

## 第四阶段: 最终验证与清理 (Final Verification & Cleanup)
- [x] **任务: 运行完整测试套件**
    - [x] 确保新代码不影响现有战斗和 AI 流程。
- [x] **任务: 代码审查与风格检查**
- [x] **任务: Conductor - User Manual Verification '第四阶段: 最终验证与清理' (Protocol in workflow.md)**
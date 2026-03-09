# 坊市购买东西支持多选一起购买 (Batch Purchase in Market) - 计划

## 阶段 1: 基础建设与 API 准备 (Phase 1: Foundations and API)
- [x] **任务: 扩展 MarketService 支持批量购买逻辑**
  *在 `lib/services/MarketService.ts` 中实现批量处理逻辑，确保事务原子性。*
    - [x] 编写测试用例以验证批量购买的逻辑和事务回滚。
    - [x] 实现 `batchPurchase` 服务方法。
- [x] **任务: 更新 API 路由处理批量请求**
  *更新相关的 API 接口，使其能够接收并处理批量购买请求。*
    - [x] 更新 API 处理逻辑。
    - [x] 运行集成测试验证接口。

## 阶段 2: 前端 UI 交互优化 (Phase 2: Frontend UI Enhancements)
- [x] **任务: 在坊市界面集成多选交互**
  *在相关 React 组件中添加多选框和选择逻辑。*
    - [x] 编写前端交互测试。
    - [x] 实现多选和全选功能。
- [x] **任务: 实现批量购买结算界面**
  *展示已选物品列表和总价。*
    - [x] 完善结算对话框或页面。
    - [x] 集成批量购买 API 调用。

- [x] **任务: Conductor - User Manual Verification '阶段 2: 前端 UI 交互优化' (Protocol in workflow.md)**

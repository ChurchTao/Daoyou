---
name: daoyou-game-ui
description: 万界道友常规游戏场景的 UI 规范。用于实现、重构或评审 GameViewportLayout 常规壳及其场景正文的层级、排版、导航与组件职责。独立战斗、地图沉浸、创角和后台使用各自的布局规范。
---

# 主流程场景 UI

先查 `apps/web/src/route-definitions/` 的布局嵌套和 `handle={scene(...)}`。在 `GameViewportLayout` 下，`chrome: 'immersive'` 走 `GameMapLayout`，返回入口由对应场景负责。下面的三层规则适用于常规壳。其他布局及 HUD、底栏、世界聊天的归属见 [布局规范](../../../docs/game-layout-ownership.md)。V6 战斗与回放另查 [战斗 UI](../../../docs/combat-v6-battle-ui.md)，展示使用服务端权威结果。

## 场景结构

- **身份**由顶部识别层承担。每页只设一个场景级标题，场景名、上下文、正文分节应有明确层级。特殊字体留给身份层。
- **任务**由正文承担。用场景描述、操作文案和必要提示，让玩家首屏就知道能做什么。正文标题用于定位步骤、组织内容或总结结果，控件已说明的内容无需再写一遍。精确代价、概率和风险默认放在确认层或二级说明，首屏决策直接依赖的数值可以提前展示。只保留当前操作需要的角色、资源状态，其余留在原属页面或 HUD。
- **导航**由稳定的全局入口承担。当前任务的操作留在正文，跨场景捷径收束到导航层。
- 边框、虚线、底纹和强调色各有语义。相邻层级不要重复分隔，激活态与结构分隔用不同样式，交互高亮不压过内容。

## 实现与验收

- 优先复用 `apps/web/src/components/game-shell/` 的原语与 `apps/web/src/lib/resources/` 的状态入口。局部样式在拥有职责的组件里解决，避免新增壳层透传参数、全局 CSS 或分散在调用方的特判。共享组件进入正文时遵守正文层级，必要时增加范围明确的展示分支。
- 新增或迁移场景时，核对路由嵌套、scene handle、文档标题及 `gameNavigation.ts` 中的场景登记。需要全局导航入口时，核对对应的 dock 文案和 href。
- 角色面板沿用 `packages/game-rules/src/character/display.ts`。物品预览的字段与决策层级见 [物品预览规范](../daoyou-item-preview/SKILL.md)。
- 按 [主流程验收清单](references/viewport-checklist.md) 检查受影响的入口。

---
name: daoyou-game-ui
description: 为本项目的主流程游戏 UI 提供抽象规范与审查方法，覆盖 `GameViewportLayout` 及其场景页、共享壳组件和正文交互。Use when implementing, refactoring, or reviewing scene-page structure, typography, borders, navigation, component ownership, or interaction consistency in this repo's main game flow.
---

# Daoyou Game UI

## Overview

这个 skill 不是页面清单，也不是文案约定。它定义的是一套主流程场景 UI 的抽象规范：让玩家在第一眼就分清“我在哪”“我现在能做什么”“如果要去别处该从哪里走”，同时不用先读完一份规则说明书。

主流程页必须保持单一路径：

- 场景身份由顶部识别层承担
- 当前任务由正文承担
- 全局流转由稳定导航承担

任何让这三层重新混在一起的做法，都视为回退。

主流程页还必须控制认知负担：

- 首屏先让玩家感知场景，再让玩家行动
- 具体数值、精确代价、风险说明默认后置到确认层
- 已经有稳定归属页的信息，不为“完整”在场景页重复铺开

任何把正文重新写成机制公告、角色面板或帮助文档的做法，也都视为回退。

本 skill 默认只约束 `GameViewportLayout` 主流程页。不要把这些规则强行套到战斗中流程、地图沉浸页、创角流程或后台页，除非用户明确要求统一。

## 当前接入边界

- 先看 `src/react-app/router.tsx` 的真实布局。V6 战斗使用 `src/react-app/layouts/combat-v6-layout.tsx` 和 `src/react-app/components/feature/combat-v6`，不套主流程身份／任务／导航三层审查。
- 战斗展示与回放核对 `docs/combat-v6-battle-ui.md` 和现有 session/presentation 代码；客户端消费权威状态，不为展示重新计算战斗结果。
- 角色和物品状态优先复用 `src/react-app/lib/resources` 的 hooks/store/mutations。旧 `useCultivatorBundle` 已不在当前代码中。
- 角色面板使用 `src/shared/lib/cultivatorDisplay.ts` 的 V6 展示契约；物品视图参考 `docs/item-presentation-ui.md`、`docs/inventory-equipment-ui.md`，不要从旧 creation product 推导新道装属性。

## Mental Model

### 1. Identity Layer

身份层只回答一件事：当前场景是什么。

- 场景名应该只有一个强识别中心
- 同层可补充上下文，但上下文不能升级成第二个主标题
- 身份层允许更强的识别性和风格化字体，但它的职责到此为止

### 2. Task Layer

任务层只回答一件事：玩家现在要做什么。

- 正文第一屏必须直接进入当前任务
- 正文第一屏应让玩家快速形成“这里可以做什么”的直觉，不依赖长段规则阅读
- 正文中的标题只服务信息组织，不服务场景命名
- 正文视觉应该服从可读性，而不是追求场景身份感的重复强化

### 3. Navigation Layer

导航层只回答一件事：如果玩家要离开当前任务，该从哪里走。

- 跨场景流转应收束到稳定的全局入口
- 正文不应该再同时承担“完成当前任务”和“去别处”的双重职责
- 当前场景的操作按钮可以留在正文；跨场景入口不应该成为正文重点

## Workflow

1. 先识别当前页面的主任务。
   - 是入口页、步骤页、列表页、表单页，还是结果页。
2. 再识别第一屏的自解释能力。
   - 如果第一屏的控件已经能说明任务，就不要再补一层解释型标题。
   - 如果第一屏能靠场景描述和操作文案自然说明任务，就不要再堆规则清单和数值列表。
3. 再拆解视觉层次。
   - 哪些元素负责身份。
   - 哪些元素负责组织信息。
   - 哪些元素只是辅助说明。
4. 再判断哪些信息应该后置。
   - 精确数值、资源扣减、概率、风险提示，是否可以放进确认弹窗、tooltip 或二级说明。
   - 角色已有信息，是否真的阻断当前决策；若不阻断，就不要搬进场景正文。
5. 最后才决定组件落点。
   - 壳层组件负责稳定骨架。
   - 正文组件负责任务组织。
   - 共享组件进入正文后，必须服从正文规则。
6. 改完后执行 `references/viewport-checklist.md`、本文件 `Review Questions` 与 `Validation` 的审查项。

## Core Principles

### One Scene, One Identity Center

- 每个主流程页只能有一个场景级身份中心。
- 同一个页面里，不要让身份信息在多个区域重复争夺视觉最高优先级。
- 场景名、场景上下文、正文分节三者必须明显分层。

### Typography Serves Reading, Not Decoration

- 特殊字体只用于身份层，不用于任务层。
- 正文标题的目标是建立阅读节奏，不是制造展示感。
- 正文任一标题都不应在体量、风格或情绪上压过场景身份。
- 当你犹豫一个标题该不该更大时，默认它应该更小。

### Information Must Add, Not Repeat

- 标题只有在新增信息时才值得存在。
- 如果一个控件、列表、tab、筛选器或步骤流本身已经把任务说明白了，就不要再补一个复述它的标题。
- 分节标题应该解释“这一段多了什么信息”，而不是解释“你正在看的东西叫什么”。
- 当标题没有新增信息量时，删除优先于弱化。

### First Screen Is Not a Rulebook

- 第一屏的目标不是把玩法规则讲全，而是让玩家自然明白“这是哪里”和“我现在能做什么”。
- 玩家不应该为了理解一个场景的用途，被迫阅读一整屏规则、代价、边界条件和数值表。
- 当场景描述、按钮文案和局部提示已经足以建立预期时，正文就不该再补一套解释性说明书。

### Scene Mood Should Carry Meaning

- 场景页文案优先承担感知任务：告诉玩家这里是什么地方，这里的人或设施会为他做什么。
- 沉浸感文案必须服务操作理解，而不是脱离交互独立表演。
- 能用一句有场景感的话讲清的，不要改写成三句机制说明。

### Numbers Belong to the Decision Edge

- 固定代价、概率、数值区间、资源损耗、风险边界，默认放在玩家即将确认操作的那一层。
- 首屏只保留让玩家判断“是否值得继续点下去”的粗粒度信息。
- 只有当精确数值本身就是首屏决策前提时，才提前展示在正文。

### Do Not Rebuild the Character Sheet

- 场景页不是角色页、道身页、背包页或帮助页的副本。
- 如果某类信息已经有稳定归属位置，场景正文不要为了“看起来完整”再重复铺开。
- 只保留当前任务真正需要的最小状态提示；其余信息交还给原属页面或 HUD。

### Ornaments Need Semantic Budget

- 边框、虚线、底纹、强调色都必须有明确语义。
- 同一语义不要重复绘制在相邻两层结构上。
- 结构分隔和交互反馈不要复用同一种装饰语言。
- 装饰的职责是帮助分层，不是制造存在感。

### Interaction Stays Quiet

- 交互控件的高亮应低噪音、可预期。
- 不要让激活态比内容本身更抢眼。
- 交互反馈应与结构分隔区分开，不要都依赖同一类虚线或边框。

### Content Stays in Scene

- 正文聚焦于当前场景任务。
- 跨场景流转应通过稳定导航完成，而不是在正文内部到处给出口。
- 页面内保留的是当前任务的操作，不是跨场景的捷径集合。

### Component Responsibility Must Stay Local

- 样式问题优先在拥有该视觉职责的组件内解决。
- 不要把局部视觉问题上推成壳层透传参数。
- 不要用全局语义 CSS 兜底场景页规则。
- 如果一个规则只属于一类 UI，就让一个聚焦组件承担它，而不是把条件判断散落在调用方。

### Shared Components Must Degrade Gracefully

- 一个共享组件进入主流程正文后，必须服从正文层级规则。
- 共享组件如果同时服务多个场景，可以加很窄的展示分支，但不要扩成通用样式系统。
- 正文里的共享组件应该默认降低展示冲动，优先保证信息清楚。

## Implementation Guidance

在这个仓库里，先检查当前主流程壳组件与共享原语，再决定改动位置。优先关注：

- `src/react-app/components/game-shell`
- `src/react-app/components/feature/world-chat`
- `src/react-app/routes/game`
- `src/react-app/router.tsx`
- `src/react-app/components/game-shell/gameNavigation.ts`
- `src/react-app/lib/router/gameShellRegistry.ts`
- `docs/game-layout-ownership.md`

优先复用现有主流程原语，而不是重新发明一套页面局部样式约定。只有当现有原语无法表达当前规则时，才新增一个职责单一的组件。

新增或迁移主流程场景时，不要只添加 route 文件。同步核对：

- `src/react-app/router.tsx` 中的 route、`handle={scene(...)}` 和 document title
- `src/react-app/components/game-shell/gameNavigation.ts` 中对应 scene metadata、dock label、href
- 需要 immersive chrome 时的特殊返回 descriptor
- `src/react-app/lib/router/gameShellRegistry.ts`、`src/react-app/lib/router/routeTitle.ts` 的注册与标题行为
- `docs/game-layout-ownership.md` 是否仍准确

## Review Questions

做 UI 评审时，先问这些问题：

1. 玩家能否在第一眼分清身份层、任务层、导航层。
2. 正文是否出现了第二个身份中心。
3. 玩家是否必须先读一大段规则，才知道这个场景是干什么的。
4. 首屏是否过早暴露了本应属于确认层的精确代价和风险说明。
5. 页面是否把角色页、道身页、背包页已有的信息又重复搬进了正文。
6. 标题是否真的在增加信息，而不是复述已可见结构。
7. 装饰是否在帮助分层，而不是制造噪音。
8. 交互反馈是否安静、一致、可预期。
9. 共享组件进入正文后，是否仍保留了不合时宜的展示感。
10. 页面是否仍然把注意力锁在当前场景任务上。
11. 新增场景是否同步了 route handle、scene registry、dock 信息，并完成手工路由检查。

## Anti-Patterns

一旦出现这些情况，就默认需要回收：

- 用正文标题重复场景名
- 用特殊字体和超大字号组织正文
- 用解释型标题给已经自解释的结构“再讲一遍”
- 首屏堆满价格、百分比、概率、掉落规则、风险边界和例外说明
- 为了“让玩家一次看全”，把角色状态、资源账面、道体细项整块搬进场景正文
- 本该放在确认弹窗里的代价提示，提前挤占正文主体
- 用相邻双边框、双虚线或嵌套边框表达同一种分隔语义
- 用正文底部按钮组承担跨场景导航
- 用壳层透传 class 或全局语义 CSS 修补局部视觉问题
- 新增主流程页只加页面文件，漏掉 scene registry、dock、title 或手工路由检查

## Validation

执行 `references/viewport-checklist.md` 和本文件 `Review Questions` 的检查项。

至少确认：

- 类型检查通过
- 主流程正文没有回到“身份、任务、导航混杂”的状态
- 首屏没有退化成规则公告、角色摘要或帮助说明页
- 桌面和移动端都仍然满足稳定层级
- 共享组件没有把 display 风格、冗余标题或跨场景导航重新带回正文

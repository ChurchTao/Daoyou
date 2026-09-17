# Game Layout Ownership

## `/game` 路由归属

- `GameGenesisLayout`：`/game/create`、`/game/reincarnate`
- `GameNarrativeLayout`：`/game/sect/onboarding`、`/game/identity-reshape` 等无 HUD、无全局导航的分幕演出
- `GameViewportLayout`：常规主流程页，包括 `/game`、`/game/inventory`、`/game/retreat`、`/game/cultivator`、`/game/skills`、`/game/techniques`、`/game/artifacts`、`/game/craft*`、`/game/enlightenment*`、`/game/fate-reshape`、`/game/market*`、`/game/black-market`、`/game/auction`、`/game/mail`、`/game/world-chat`、`/game/community`、`/game/redeem`、`/game/settings/feedback`、`/game/rankings`、`/game/battle/history`、`/game/dungeon/history`
- `GameActivityLayout`：`/game/sect/gate/sweep`、`/game/sect/spirit-vein/mining` 等无 HUD、无全局导航的全屏互动玩法
- `GameCombatLayout`：`/game/battle`、`/game/battle/challenge`、`/game/battle/live/:matchId`、`/game/battle/:id`、宗门任务战斗
- `CombatV6Layout`：`/game/training-room`、`/game/wild`，独立于 v5 战斗布局及状态容器
- `GameMapLayout`：`/game/map`
- `GameDungeonLayout`：`/game/dungeon`

## 共享组件归位

- `/game/beasts` 归属 `GameViewportLayout`，使用 `GameSceneFrame` 展示灵兽袋（拥有上限 24，只选最多 6 只出战编组）；桌面左侧名册、右侧属性与技能，移动端名册在上。技能使用统一浮层，加点在面板内预分配并弹窗确认，学习兽诀抽屉复用通用物品栏；战斗中的召唤选择仍由 v6 指令组件负责。
- `/game/map` 是全局导航中的常用地图，默认展示节点可用的野外、历练和坊市入口；仅显式 `intent=dungeon|market|sect` 保留选址语义。默认地图关闭返回 `/game`，避免与野外页面循环返回。
- `/game/wild` 在 `CombatV6Layout` 中分为寻觅准备页和既有 V6 战斗页。准备页由节点配置驱动，使用统一 `InkButton`、`GameLoadingState`、`BeastIcon` 与语义配色；只展示本次物种、等级、成年／幼崽及两个动作。每次寻觅消耗 2 点天地灵气，捕捉在战斗中完成。见 [野外寻觅](combat-v6-wild-seeking.md)。
- `/game/tower` 使用主流程壳展示挑战、祝福和周榜；活动战斗跳转 `/game/tower/battle` 的既有沉浸壳，复用 v6 公共战斗组件。结算播放结束后返回幻境，不在入口正文嵌入旧战斗播放器。
- `/game/rankings` 保留榜单主流程壳；`/game/battle/challenge` 使用 v6 公共回放播放器自动逐行动播放服务端已结算的挑战，播放完成后展示名次摘要。挑战请求 UUID 保留在 URL，刷新及失败后恢复同一结果，观看不占用角色。

- v6 战斗页面、阵容、指令和逐行动播报放在 `src/react-app/components/feature/combat-v6/`；仅复用通用 UI 和全局配色，不依赖旧 `feature/battle` 组件。协议与恢复规则见 [v6 战斗 UI](combat-v6-battle-ui.md)
- 造化/参悟共享材料选择器放在 `src/react-app/components/feature/creation/MaterialSelector.tsx`
- `/game/cultivator` 使用「人物属性 / 先天设定 / 所修功法 / 肉身修炼」四页签，桌面左侧纵向排列，移动端顶部横向排列，URL 的 `tab=innate|manuals|body` 支持直达。人物属性独占左侧墨像与右侧姓名、名号、境界、宗门和寿元，随后显示气血法力、状态、战斗属性与六维加点、修为。先天设定合并先天灵根（仅原始强度）、命格与人物志，转世重修置于该页末尾；后天灵根增益仅在肉身修炼的洗髓区域展示。所修功法复用 `ManualRoom`；肉身修炼按肉身阶位、五轨修炼、洗髓、灵根后天增益排序，以浅底色分组突出阶位与等级，五轨直接展示实际战斗收益的简短说明与进度，不设展开详情，升阶条件按需展开；洗髓保留破限操作，后天灵根突出增益并辅以先天与当前强度。各页签不重复身份资料或场景壳，以留白分组。旧功法、炼体、洗髓地址继续重定向并透传参数，旧加点地址进入人物属性加点状态。加点预览仍走只读 V6 投影接口。
- 道身长期状态与称号编辑放在 `src/react-app/components/feature/cultivator/`
- 跨玩法复用的分幕演出舞台放在 `src/react-app/components/feature/narrative/`
- 清扫与采掘共用的横屏、全屏进入和释放逻辑放在 `src/react-app/lib/gameActivityImmersive.ts`；共享启动层和沉浸状态监听放在 `src/react-app/components/feature/game-activity/`
- 清扫摇杆使用 `phaser4-rex-plugins` 的 Virtual Joystick，并由清扫 Phaser runtime 持有、渲染和销毁；采掘放索按钮仍是玩法私有 DOM 控件。各玩法 runtime 与服务端重放规则保持独立
- PWA 安装状态由应用根 Provider 统一持有；小游戏只在全屏失败时给出场景化安装提示，系统设置保留固定安装入口
- PWA 安全区由顶层布局和共享固定层分别负责：背景与画布可以铺满系统区域，HUD、导航、正文和模态交互必须避让 `safe-area-inset-*`；不得给 `body` 统一增加 padding
- 冷启动壳由 `index.html` 提供首字节后的静态反馈，React Router 根路由使用同构的 `AppBootScreen` 承接懒加载与初始 loader 阶段
- `routes/game/components/` 只保留真正属于某个页面的私有组件；跨两个以上路由族复用的组件不得继续放在 `routes/**`

## 加载体验归属

- `index.html` 持有冷启动首帧结构、宣纸背景和 `.ink-loading-bar` 关键 CSS；React 组件不得另建同名动画或复制关键帧
- `InkLoadingBar` 是玩家端唯一的未知进度动画原语，只负责 `ink`、`inverse`、`accent` 色调与 `boot`、`scene`、`inline`、`navigation` 尺寸
- `GameLoadingState` 负责 `scene`、`inline`、`immersive`、`fullscreen` 四种状态层级以及 status/live/busy 可访问性；页面只传入场景化文案
- `GameSceneLoading`、`GameImmersiveLoading`、`NarrativePerformanceLoading` 是面向既有调用方的语义入口，内部必须委托 `GameLoadingState`
- `GameActivityLoadingOverlay` 只负责小游戏开始、运行时初始化与结算提交遮罩，并复用小游戏安全区覆盖层；玩法规则、Phaser 生命周期和任务协议不归加载组件管理
- 首次无数据时才使用页面或区域占位；后台刷新必须保留已有内容，并在对应区域显示紧凑 `inline` 状态
- 玩家端提交反馈统一使用 `InkButton.pending` 与场景化中文动作词；按钮内不放加载条。管理员后台不在本轮统一范围内

## 禁止项

- 游戏页面不得新增 `InkPageShell` 依赖
- `InkPageShell` 当前只允许 auth 流程通过 `AuthPageShell` 间接使用，不再属于游戏主流程布局组件
- `quickActionGroups`、`QuickActionsGrid`、`useHomeViewModel` 不再作为导航或首页编排来源
- `components/game-shell/immersiveSceneDescriptor.ts` 已废弃；副本或专属页需要私有 scene descriptor 时，放在对应路由族内部

### 人物属性排版约束

人物属性顶部采用左侧透明墨像、右侧身份资料，桌面墨像约 120 × 140px，移动端约 84 × 108px。资源条通栏，战斗属性与六维根基桌面并排、窄屏堆叠，数值右对齐并使用 `font-mono`；每组内部保持固定行序，不再自动拆成多列。加点控件手机保留 44px 触控区域，窄屏变化摘要靠近确认操作。正文仅在资源状态与属性区域之间保留一条细分隔线，其余通过标题和留白分组。先天设定以浅底分组：灵根突出元素图标、名称与先天强度，品阶使用现有 `InkBadge`；命格在宽屏并列、手机堆叠，名称与品级同排并沿用品阶色，外部仅保留图标、名称、品级和详情入口，所有效果与描述均进入详情。人物志将短字段与生平长文分组，长文本自然换行，不再将所有信息铺成同权重的资料行。身份、头像、后天增益均不重复出现在先天设定中。

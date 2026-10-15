# PWA 视口、系统边缘与安全区梳理

日期：2026-10-15。代码基线：`07af64d2a`。

状态：方案已实施，已通过本地 lint、Web 类型检查、生产构建及 Chromium 布局回归。**iOS／Android 真机、原生键盘和实际安装态更新仍待验收；浏览器中的兼容分支模拟不证明 iOS 原生模糊已消失。** 下文第 3 节保留实施前的审计基线，第 4—6 节记录实施规则与清理结果。

## 1. 目标与边界

解决两个用户反馈：iOS 主屏幕 PWA 的顶部 HUD 被模糊，以及启动页底部出现额外素色条。同时避免修复影响 PC、Android、普通浏览器标签页、聊天键盘和沉浸场景。

产品取舍：系统状态栏和手势区可以使用与场景协调的纯色；宣纸纹理保留在网页内容内。优先保证文字清晰、按钮可达、没有额外视口空洞，不要求把纹理或渐变强行延伸到浏览器无法控制的系统区域。

验收时必须区分正常的系统安全区与异常空洞：允许系统保留状态栏／手势区；不允许在它们之外多出一段接近状态栏高度的空白。消除截图中的硬分界，也不应依赖让正文或导航越过网页实际边界。

本次不重写路由、战斗 UI、聊天系统或全站设计系统，不把主流程改成全局内部滚动容器。

## 2. 证据的确定性

| 事项 | 结论及限制 |
| --- | --- |
| 截图 2 的色条 | 原图 1179×2556，分界约在 y=2379，条带约 177 物理像素；按 3 倍比例约为 59 CSS px。吻合状态栏高度级别的视口偏移，但不能仅凭截图证明是哪一个 WebKit 分支触发 |
| 当前 HUD | `GameTopHud` 和占位 HUD 的滤镜已移除；正文后面的背景模糊不能直接解释 HUD 自身文字被模糊 |
| iOS 版本 | 用户提供“最新 iOS”，没有具体版本号和构建号；不能把 iOS 27 的网络案例直接当作用户设备版本证明 |
| 已有修复 | `b7bd861fa` 去除了部分滤镜，并给启动页加入根背景及向下越界的背景层；没有改变状态栏 meta |
| 历史残留规模 | 当前可追溯的 HTML 入口历史只有 `0de7fd739` 和 `b7bd861fa`。没有证据表明存在大量隐藏的 iOS 版本补丁；实际问题是背景、安全区和高度职责分散，且既有补偿缺乏真机闭环 |
| 宣纸与系统识别 | WebKit 存在排除背景图片的顶部采样路径，但尚未证明它就是该设备的完整触发链；按兼容风险设计，不写成已经确认的唯一根因 |

外部证据：

- [WebKit 236445](https://bugs.webkit.org/show_bug.cgi?id=236445#c9)：有报告指出 `black-translucent` 与 `viewport-fit=cover` 组合会产生与顶部安全区等高的底边偏移。它是问题报告，不代表所有 iOS 版本都如此。
- [iOS 27 顶部模糊真机实验，2026-09-30](https://modernwebweekly.substack.com/p/so-whats-up-with-the-ios27-blur)：作者观察到系统模糊覆盖顶部内容；固定的纯色顶部元素可以改变表现，单独改 meta 未解决。其尺寸阈值属于实测，不是平台契约。
- [OJapp 真机实验及 CSS 更新](https://tips.ojapp.app/en/ios-27-pwa-top-blur-workaround-2/)：固定色条或延伸至安全区的纯色 sticky header 有效；早期滑动透明层方案属于实验性绕过，不采用。
- [MeshMonitor 最终布局修复 PR](https://github.com/Yeraze/meshmonitor/pull/5328)：项目进一步把顶部工具栏改为 fixed；说明纯粹给内容增加一点间距并不等价于处理系统绘制。
- [OpenChamber 最终合并 PR](https://github.com/openchamber/openchamber/pull/3593)：根元素 `100vh` 修复最终限定于 iOS 独立 PWA。维护者明确指出，全局套用会影响 Safari 标签页和 Android；不能只读 issue 中早期的通用建议。
- [Chrome 官方 edge-to-edge 指南](https://developer.chrome.com/docs/css-ui/edge-to-edge)：Android 底边安全区可能动态变化，固定底栏应考虑最大安全区与当前位置，避免 padding 跟随浏览器底栏动画反复重排。
- [Chrome 键盘视口说明](https://developer.chrome.com/blog/viewport-resize-behavior)：键盘可能只改变 visual viewport；不能用更换 `vh` 单位代替键盘适配。

## 3. 实施前的样式与生命周期基线

以下路径相对 `apps/web/`。

| 所有者 | 实施前行为 | 处理结论 |
| --- | --- | --- |
| `index.html` 的 viewport／PWA meta | `viewport-fit=cover`、`standalone`、`black-translucent`；HTML theme-color 为深色 | 保留 cover／standalone；目标移除 black-translucent，使用 default；启动基底和 theme-color 统一为纸色 |
| `index.html` 的 `html, body, #root` | 全部 `min-height:100%` | 百分比不是三个独立屏幕尺寸；结束含糊的高度链，明确根画布与真实场景的职责 |
| `html:has(.app-boot-screen)` | 只在启动期锁滚动、画 250px 宣纸纹理 | 删除这个补洞专用分支；不让有无启动 DOM 决定整个文档的背景／滚动策略 |
| `.app-boot-screen` | fixed／inset:0，safe-area padding，`overflow:visible`，isolation | 保留固定启动层及安全区；背景直接在容器内绘制，改为 overflow:hidden，移除不再需要的 isolation |
| `.app-boot-screen::before` | 背景底边使用负的 `safe-area-inset-top` | 删除越界伪元素，将视觉背景归回启动容器。顶部安全区不承担修复底部尺寸的职责 |
| `AppBootScreen.tsx` | Router HydrateFallback 复用 HTML 里的 `.app-boot-*` | 保留。静态 HTML 与 React 各有一份等价结构是首帧交接所需，不是两个样式系统 |
| `src/index.css` 的 body／`.bg-paper` | body 和场景都画 300px 宣纸；启动层另为 250px | body 收敛为纯色画布兜底；`.bg-paper` 保留为场景纹理；启动页纹理沿用场景尺度，装饰不覆盖系统边缘 |
| `GameLayout`／`PlayerShell` | 两层 Provider 外壳均有 `bg-paper min-h-screen` | 删除这两层的视觉职责；保留 Provider、loader 和路由嵌套 |
| `GameViewportLayout` | 外层和内层均 `min-height:100svh`，HUD sticky，底栏 fixed | 维持文档滚动和 sticky HUD，只让承担 flex 布局的真实场景容器管理最小高度 |
| `GameTopHud`／占位 HUD | 各自安全区 padding、`.bg-paper`，无滤镜 | 同步处理真实／占位状态；保留空间结构，不在二者各加一份兼容色条 |
| `GameBottomDock` | 底部安全区在导航内部；父级 fixed 层没有统一边缘背景 | 将安全区及屏幕底边背景归父级 bottom chrome；子导航只保留自身间距 |
| `WorldChatPreviewBar`／`.battle-dock` | 聊天预览和导航各画 96% 不透明底色 | 容器统一提供不透明纸色，内部组件保留分隔；避免正文从系统手势区透出 |
| `--game-bottom-offset` | ResizeObserver 测聊天预览＋导航的实际高度，写给 main | 保留，不能退回固定猜测；包括换行、预览隐藏和 safe-area，消费方不再额外加一遍 |
| `useWorldChatViewport`／聊天 CSS | 基于 visualViewport 测工作区，键盘打开时隐藏 dock | 保留。属于键盘需求，不是启动页补洞样式；不扩为全站高度监听 |
| `GameCombatLayout`／`GameGenesisLayout` | `h-screen`，局部内部滚动 | 将真正屏幕容器按动态视口定高；保留内部滚动与场景布局 |
| `CombatV6Layout`／地图／副本／活动布局 | 已使用 `h-dvh`／`100dvh`，但祖先仍有 `min-h-screen` | 保留定高含义，清掉祖先的旧高度约束；不把整套样式改回 100vh |
| `GameNarrativeLayout`／`PerformancePlayer` | 外层暗色 min-svh；剧情播放器内层纸色 h-svh | 按实际显示的舞台决定边缘颜色和定高；不能因父布局名称就把所有剧情染成暗色 |
| `.app-safe-area-page` | 四边安全区＋页面间距 | 保留给无 HUD／无 dock 的完整页面；嵌在已有边缘留白的内容中时不得再承担整屏安全区 |
| 模态框／抽屉／Toast | Portal 到 body；各自 fixed，使用安全区 | 保留。它们不继承场景内留白，不能以“重复 env”名义删除；需回归遮罩层级 |
| `App.tsx` 的导航进度条 | 在安全区下沿 fixed，z-200 | 保留导航反馈，顶部位置跟随统一的有效顶部安全区，不用于充当系统色条 |
| PWA Provider／service worker | 管安装状态、壳缓存和更新 | 保留。首次启动与旧缓存需要分别验收，不把清缓存当作样式修复 |

`b7bd861fa` 还删除了 `GameSceneFrame`、`InkHorizontalScroll`、`DungeonSceneChrome` 的部分 backdrop-filter。这些删除继续保留，不自动恢复，也不据此全局禁用所有 blur。地图工具面板、沉浸玩法小控件里的局部模糊不属于本次清理目标。

## 4. 实施方案

### 4.1 统一规则，不统一成一种滚动模式

- 根文档负责纯色兜底，不加全站 safe-area padding，不常驻锁滚动，也不为 iOS 直接固定 `html/body` 为 100vh。
- 普通完整页面／主流程使用 `min-height:100dvh`，内容可自然长高；宽度由现有布局负责。
- 固定画布、创角工作区、战斗、地图、固定剧情播放器使用 `height:100dvh`；内容在已有的局部滚动区滚动。
- 父 Provider 只提供上下文，不再强迫所有后代至少 100vh 高。
- `100svh` 只保留在确实要求稳定最小高度的局部视觉内容，例如辅助配图；不能用它作为“修 PWA”的通用开关。
- 页面内 `h-full` 在父级已明确定高时继续有效，不进行全仓字符串替换。

统一的是尺寸的用途和所有权。PC 上这些视口单位通常同高；手机浏览器地址栏变化时，不能再让旧祖先高度覆盖内层选择。

### 4.2 顶部：保留 HUD 结构，兼容措施只有一个所有者

选择**纯色系统边缘＋独立固定顶部色层**，不将完整 HUD 改成 fixed，也不新增一套 HUD 高度测量与正文上偏移。

实施约束：

1. `viewport-fit=cover`、manifest 的 `display:standalone` 保留。状态栏样式使用 `default`，不再要求跨版本透明状态栏；这项选择处理布局兼容，不宣称仅改 meta 就能消除模糊。
2. 仅对 iOS 主屏幕独立运行启用兼容色层。首帧由 HTML 中的短同步初始化读取 `navigator.standalone === true` 设置文档标记；不解析 iOS 版本号，不用“窄屏＝iPhone”，不让所有 standalone 平台都命中。PWA 安装 Provider 仍负责原有安装状态，不建立第二套安装状态管理。
3. 固定色层 `top:0`、全宽、纯色、不接受点击、不含文字／纹理／动画／filter。采用 12px 最小绘制高度，覆盖到系统给出的顶部安全区；12px 是隔离在这一处的兼容常量，不是状态栏高度。它满足网络实测阈值，但仍需目标设备确认。
4. 同一处提供有效顶部安全区：普通平台为系统 inset，iOS 独立运行取系统 inset 与该 12px 的较大值。HUD、屏幕顶部操作和导航进度条读取它，避免 inset 为 0 时色层遮住按钮。原有业务间距不变，不再逐组件添加 16／20／59px 补偿。
5. 色层低于模态框／抽屉，高于普通内容；沿用现有层级区间，不使用极大 z-index。弹窗遮罩必须能覆盖它。
6. 唯一的 `.app-system-top` 位于 HTML 的 `#root` 之外，关键 CSS 也只在 `index.html` 定义。静态启动与 React 页面共用这个常驻色层，不分别挂载；真实 fullscreen 时关闭，包含 html 自己进入 fullscreen 的情况。
7. 纸色 `#f8f3e6` 是根画布默认值；非纸色可见场景挂载 `AppViewportColor`，在 layout effect 中同步根画布、唯一色层和 theme-color，卸载时恢复。它不渲染第二个色层，不建立主题 Provider 或 URL 注册表。

纸色页面、错误页和启动页直接使用文档默认色；暗色加载页由自身同步底色。叙事父布局不再绘制统一暗色，避免与纸色剧情播放器竞争。全局 Portal 弹窗不重新注册场景主题。

### 4.3 底部：修正实际视口，安全区只消费一次

先统一文档高度职责并移除 black-translucent，再删除启动页的负顶部 inset 补偿。不保留“新规则没效果就继续向外画一截”的备用 CSS。

启动层保持 fixed／inset:0，背景直接在容器内绘制，删除原来向外伸展的背景伪元素及其 isolation。装饰集中于内部，靠近屏幕边缘回到共同纸色，避免纸纹／深色渐变在系统边界骤然截断。根文档保留相同纯色兜底，不额外创建底部遮盖条。

主流程底栏保留现有父级 fixed 层与测量机制，把导航内部的安全区上移至该父级。Chrome 动态安全区采用以下规则，作为同一底栏布局公式而非 Android UA 分支：

```css
/* S = 当前底部安全区；M = 最大安全区，不支持 max 时退回当前值。 */
--app-bottom-reserve: env(
  safe-area-max-inset-bottom,
  env(safe-area-inset-bottom, 0px)
);
padding-bottom: var(--app-bottom-reserve);
bottom: calc(env(safe-area-inset-bottom, 0px) - var(--app-bottom-reserve));
```

该公式只在 `.game-bottom-chrome` 定义，业务组件不各自复制。`GameBottomDock` 只保留原有 0.8rem 业务间距；父级画完整不透明背景。

ResizeObserver 继续测完整底栏高度，main 预留该高度，属于保守的最大避让；不要再叠加 `env(bottom)`。浏览器系统栏占位变化时，正文末尾允许保留少量安全余量，但屏幕底边不能露出正文或形成启动页式硬分界。`M` 不支持时退回当前安全区，正确性优先；不硬编码 34／36／59px 给所有平台。

world-chat、导航隐藏、菜单展开时保持现有显示语义；空的 bottom chrome 不应仅因安全区 padding 残留可见空带。

### 4.4 键盘、横屏与沉浸场景

- 聊天继续局部使用 visualViewport；2026-10-15 键盘漂移修复见第 8 节。不增加全局 `innerHeight`、`--vh` 或 resize 定时器。
- 不通过新增 `interactive-widget` 或 VirtualKeyboard 全局开关同时改变 Android 键盘策略。若需调整，另按真实键盘证据处理。
- 原有 `data-chat-keyboard` 隐藏底栏的行为和 `--game-bottom-offset` 接口保留；测量不能把底栏安全区再减一次。
- 横屏继续由真正贴左右边缘的 HUD、导航、画布控件和 Portal 面板消费左右安全区；内容不能被祖先和子节点重复挤压。
- 纸色剧情播放器覆盖暗色叙事父壳时，以播放器实际纸色为准；活动进入真实 fullscreen 后由全屏场景负责自身边缘，不叠加独立 PWA 专属绘色层。
- iOS 的 12px 最小顶部绘制不传播到 PC、Android、普通 Safari 标签页。PC 不应多出顶边空隙，Android 保留自身系统栏与手势区处理。

## 5. 平台行为矩阵

| 场景 | 视口与滚动 | 顶部 | 底部 |
| --- | --- | --- | --- |
| PC 浏览器／安装态 | 正文自然滚动；固定工作区 dvh | 沿用 HUD，兼容色层关闭 | env 为 0 时无额外系统留白 |
| Android Chrome 标签页 | dvh 跟随可用视口；不强制全局 100vh | 兼容色层关闭；theme-color 与场景协调，实际效果由浏览器决定 | cover＋安全区；底栏采用最大留白与当前位置公式 |
| Android 安装态 | 使用系统提供的独立窗口尺寸 | 兼容色层关闭，不模拟 iOS 状态栏 | 手势／三键导航均以系统 inset 为准 |
| iOS Safari 标签页 | 使用浏览器可用视口；不套独立运行补丁 | 兼容色层关闭 | 安全区及键盘独立适配 |
| iOS 主屏幕 PWA | default 状态栏策略；不要求系统区域透明 | 一处固定纯色层＋有效顶部安全区 | 不用顶部 inset 补底边；以实际窗口和底部 inset 定位 |
| 全屏沉浸活动 | 实际 fullscreen 及已有方向锁流程 | 活动自身控件避让；退出后恢复原所有者 | 不继承主流程 dock 的占位 |

## 6. 实施清理结果

按一套目标实现提交，不并列保留多种实验分支。先完成共同规则，再在同一轮验收中处理失败；不以每轮新增覆盖样式替代删除旧规则。

| 文件／范围 | 明确删除或归并 | 明确保留 |
| --- | --- | --- |
| `index.html` | black-translucent、启动专用 html:has 分支、负 top-inset 底边延伸、越界专用 overflow／isolation；含糊的根高度链 | 静态启动内容、预加载、关键 CSS、加载条动画、viewport-fit=cover |
| `src/index.css` | body 上的重复纸纹；与关键 CSS 冲突的画布定义 | `.bg-paper`、原有字体／配色；`.app-safe-area-page` 的页面用途 |
| `src/components/feature/app-boot/AppBootScreen.tsx` | 与新启动边界不一致的结构 | 与静态 HTML 的同构交接，不复制第二份 CSS |
| `src/layouts/game-layout.tsx` | Provider 壳的纸纹和 min-h-screen；真实场景过时的 h-screen；主流程重复最小高度 | Provider、路由嵌套、sticky HUD、dock ResizeObserver、现有内部滚动区 |
| `src/components/auth/AuthPageShell.tsx`、后台外壳 | 祖先 100vh 与内层不同单位的屏幕高度竞争 | 独立页面安全区、原有宽度及响应式排版 |
| `GameTopHud.tsx`、`GameHudIndicators.tsx` | 各自潜在的平台补偿；统一有效顶部 inset 的入口 | 已移除的 blur 不恢复；HUD 真实／占位高度一致 |
| `GameBottomDock.tsx`、`WorldChatPreviewBar.tsx`、父级 bottom chrome | 子导航的系统底部 padding；父子重复绘制系统边缘背景 | 子组件自身间距、分隔线、导航换行 |
| `CombatV6Layout`、地图／副本／活动布局 | 阻碍局部 dvh 的祖先约束 | 已正确的 dvh 与局部安全区 |
| `PerformancePlayer.tsx`、叙事舞台、加载／错误页 | 用来撑屏的过时高度；重复整屏安全区 | 内容视觉尺寸、播放器行为、深浅场景本身 |
| 贴屏顶端控件 | 仅归并到有效顶部安全区，不额外加平台常量 | 控件业务间距、地图／剧情本身布局 |
| 模态框／抽屉／Toast | 本轮不顺带重构锁滚动或通用弹层系统 | Portal 独立安全区与现有交互 |

布局职责已同步到 `game-layout-ownership.md`。上述背景、高度和安全区调整已实施；主流程仍是文档滚动、sticky HUD 与 fixed bottom chrome。

## 7. 本轮基线核对与后续验收

### 实施前基线核对

- `git status`：审计开始时工作区干净。检查 HTML／CSS、路由真实嵌套、共享固定层、键盘处理和相关提交。
- Browser 专用技能未提供，使用可用 Playwright；地址为本地 `http://127.0.0.1:5174`，复用已有本地会话，没有领取奖励、发送消息、改角色或改远程环境。
- Chromium 实际页面 `/game`，1440×900、393×852、360×800；等待内容及有限入场动画结束后截图。均无横向溢出，页面标题与内容有效，无框架错误浮层。
- HUD 在桌面为 115px、窄屏为 95px，计算后的 filter／backdrop-filter 均为 none；sticky 父层背景透明，HUD 自己画宣纸。
- 底栏实测约 102.8px，main 预留 103px；说明现有 ResizeObserver 正在工作，不能作为“残留无效代码”删除。
- 360×800 下导航抽屉正常打开／关闭；世界传音工作区实测 506px，底栏约 53.8px；地图画布容器及文档均为 800px。普通 Chromium 的这些结果不能证明 iOS 系统层没有问题。
- 检查期间没有相关控制台 warning／error。
- 基线截图位于当次任务的 `/tmp/daoyou-pwa-audit-*.png`，未纳入仓库，不是跨平台修复后的验收截图。

### 本轮实施验证

- 命令：`pnpm run lint`、`pnpm --filter @daoyou/web typecheck`、`pnpm run build:client`、关键 HTML／新组件／文档的 Prettier 检查、`git diff --check` 通过。构建保留 Phaser 大 chunk 的体积提示；未修改分包。
- 本地 Chromium 在 1440×900、393×852、360×800 下验证洞府：页面有效、无框架错误浮层、无横向溢出；非 iOS 独立运行时色层为 display:none。HUD 桌面 115px／移动宽度 95px，底栏约 102.8px，main 仍预留 103px。
- 导航抽屉打开／关闭成功；世界传音输入框可聚焦／失焦，没有发送消息。真实软键盘未验证。
- 宗门候选页底色与 theme-color 为 `#e8e1d1`；进入山门演出后变为 `#111713`，返回洞府恢复 `#f8f3e6` 且清除临时根样式。仅观看，未加入宗门或提交剧情。
- 地图与纸色剧情预览在 360×800 下均铺满 800px，无祖先 100vh 约束产生的额外文档高度。
- 通过独立 Chromium 上下文设置 `navigator.standalone`，并用 CDP 覆盖安全区，验证兼容 CSS：top=59／bottom=34 时色层 59px，HUD 内侧 padding-top=67px，底栏约 136.8px，main 预留 137px；top=0 时色层为 12px，HUD padding-top=20px。
- bottom 当前值由 34 变成 0、最大值维持 34 时，底栏只移动到 bottom=-34px，预留高度保持 137px；横屏模拟左右 inset=59px 时 main 两边各避让 59px，无横向溢出。
- 非 iOS 的安全区模拟（top=0／bottom=24）保持色层关闭、HUD 内侧留白 8px，底栏只增加 24px 系统留白，main 预留 127px。
- 模拟兼容分支下打开抽屉，顶端命中的是抽屉遮罩，不是色层。分别让 html 自身和场景 div 进入 fullscreen，色层关闭、有效顶部 inset 恢复系统值；退出后恢复。
- 冻结外部模块，仅检验静态启动 HTML：普通／兼容分支的启动层、root、文档均为 852px，旧背景伪元素不存在，边界 overflow:hidden；唯一色层从首帧存在。
- 本轮页面没有相关控制台 warning／error。截图保存在 `/tmp/daoyou-pwa-after-*.png`，不进入仓库；标有 ios-css 的截图是 CSS 分支模拟，不能当真机截图。

### 仍需真机与其他浏览器验收

| 平台／模式 | 必测动作 | 通过标准 |
| --- | --- | --- |
| PC Chrome／Edge，补 Safari 或 Firefox | 普通页、窄窗、导航展开、窗口改高、滚到末尾 | 无新增顶边条／全局滚动锁；末项能滚出 dock 上沿 |
| Android 真机，标签页＋安装态 | 地址栏变化、手势导航、三键导航、横竖屏 | 无 iOS 兼容常量；按钮不被系统栏挡住；底栏无反复跳高 |
| iOS 真机，标签页＋主屏幕 | 记录准确系统版本／构建号；冷启动、热启动、SPA 切页、前后台、旋转 | HUD 文字清晰；启动页无额外状态栏高度级别空洞；系统边缘底色衔接 |
| 移动端键盘 | 世界频道聚焦输入、收键盘、切频道；认证页输入 | 输入器可见、dock 恢复，不能因 safe-area 重复计算留下空带 |
| 深浅场景切换 | 洞府→地图→剧情／暗色活动→返回；模态／抽屉 | 无旧底色残留、无白色闪条，色层不挡弹窗或返回控件 |
| PWA 更新与离线壳 | 旧安装态正常更新后重启；离线启动可用缓存壳 | 验证加载的实际构建版本，静态／React 启动交接一致 |

真机记录至少包括：准确平台与浏览器版本、display-mode、`navigator.standalone`、screen／innerHeight／document clientHeight、visualViewport 的 height／offsetTop、实际四边 inset、顶层／启动层／底栏矩形，以及截图与构建 ID。指标用于当次人工验证，不增设常驻采样器或一次性测试框架。

本轮没有修改纯领域逻辑，未新增单元测试或运行 `pnpm run test`。**尚未验证 iOS／Android 真机、Safari／Firefox、原生系统键盘、PWA 实际安装／离线／更新；没有部署或发布。**

若推荐方案在真机上仍失败，先用上述测量定位平台与坐标差异，再更新这一份方案；不能将独立运行 100vh、负 inset、扩大背景和 JS viewport 高度四套办法同时保留下来。

## 8. 2026-10-15 聊天键盘高度漂移修复

原逻辑将 `visualViewport.height` 减去聊天区的文档顶部坐标，却未处理键盘聚焦后的 `offsetTop`；在缩小的可视范围内仍保留整段场景头部扣减，会将聊天区压到 160px 下限。键盘模式又以 `display:none` 隐藏 bottom chrome，ResizeObserver 将正文预留同步降为零，改变文档高度，与系统聚焦滚动相互影响。失焦会重建测量 effect，并可能把键盘尚未收起时的 `innerHeight` 记成新的完整高度。

现在的职责如下：

- 普通模式按文档坐标测量聊天占位，桌面及硬件键盘聚焦不改变布局。
- 检测到触屏键盘压缩可视范围后，保留正常聊天占位与 dock 实测高度，仅把聊天表面固定到 `visualViewport.offsetTop`／`height` 对应范围。消息列表收缩，频道与输入区可见；顶边、横屏两侧沿用统一安全区。
- dock 改为 `visibility:hidden`，保留测量尺寸；订阅 viewport resize／scroll 及 window scroll，以同一 rAF 合并更新，不调用 `scrollIntoView`／`window.scrollTo` 争抢焦点滚动。
- 键盘关闭动画期间不因 blur 提前重置基准；可视高度恢复后解除固定布局。恢复时从原占位测量，不能从尚未完成 React 更新的固定表面测量，否则重复开关仍会累积高度。
- 场景入场动画期间仅取消祖先 transform，避免形成 fixed 包含块；不取消／重启动画。离开路由清除键盘标记及事件监听。

本地验收使用可用 Playwright（Browser 专用技能未提供），地址 `http://127.0.0.1:5174/game/world-chat`。在 393×852、360×800、852×393 触屏上下文分别连续开关 4 次，模拟 visual viewport 高度压缩及 offsetTop 变化，期间输入并清空三行草稿，没有发送消息。每次输入框均在可视范围内、焦点保留、无横向溢出；文档高度、聊天占位与 dock 尺寸在开关前后不变。独立验证 viewport scroll 使聊天 top 跟随到 120px，失焦后的关闭动画、系统频道无输入框、返回洞府后 dock 恢复；桌面 1440×900 和触屏未弹键盘聚焦均不启用固定模式。无页面运行错误或框架错误浮层。

静态检查：`pnpm run lint`、Web `typecheck`、`pnpm run build:client`、相关文件 Prettier 与 `git diff --check`。没有纯领域逻辑变更，未运行单元测试。截图 `/tmp/daoyou-chat-keyboard-after.png` 仅为可视视口契约模拟，**不是 iOS 原生键盘截图**；原生键盘动画、第三方输入法及真机 PWA 仍需验收。

平台背景参考 [Chrome 键盘视口说明](https://developer.chrome.com/blog/viewport-resize-behavior)、[WebKit 的 visualViewport scroll 时机报告](https://bugs.webkit.org/show_bug.cgi?id=218465) 与 [iOS 键盘额外底部空白报告](https://bugs.webkit.org/show_bug.cgi?id=292603)。这些说明平台差异，具体缺陷依据本仓库测量逻辑与本地复现确定。

## 9. 共享弹层与物品预览的同类问题修复

后续排查确认：`InkModal` 在关闭状态挂载时仍清空 `body.overflow`，会覆盖打开中的抽屉。实际打开灵兽喂养后，背景可被滚动 350px。通用弹层也没有处理键盘缩小 visual viewport：地图搜索框仍在约 459px，而可视底边已经变为 380px。物品预览虽然计算 offsetTop，却未订阅 visual viewport scroll，纯视口上移时保持旧位置。

已在共享职责处收口：

- `useBodyScrollLock` 为三个弹层组件统一计数。关闭的弹层不参与锁定；仅最后一个打开层关闭后恢复最初的 body overflow。移除 Modal、Drawer、AdminDialog 各自的旧锁定逻辑。
- `useOverlayViewport` 只在弹层打开时监听 resize／scroll，以 rAF 合并更新固定层的可视四边边界及局部高度／宽度变量；不用全局根高度或定时轮询。关闭时清理监听与临时样式。
- Modal 的整体高度限制在可视容器内，标题／footer 保持可见，正文可收缩和滚动。Drawer 的 88% 和地图搜索的 70% 上限改从可视高度计算；后台原生 dialog 同样使用可视边界。
- 已聚焦字段可能因容器缩小被裁掉，测量后只滚动弹层内的滚动祖先，不调用页面级 scrollTo／scrollIntoView。抽屉关闭时恢复焦点使用 preventScroll。
- ItemSlot 补齐 visualViewport scroll 的订阅与清理，复用原来的定位函数。

验证环境仍是本地 `127.0.0.1:5174` 与可用 Playwright，Browser 专用技能未提供。以下视口变化为 Chromium 中的契约模拟，不是原生系统键盘：

- 灵兽喂养打开后 body overflow 保持 hidden，遮罩上滚轮滚动背景仍为 0；关闭后恢复原值。
- 世界传音“展示→随身物品→收起→取消”：有效模态层数 1→2→1→0，前三步保持 hidden，最后一步恢复原值。物品 popover 不计入模态层数。
- 地图搜索在 380px 可视高度下，抽屉 bottom=380px，搜索输入框约 188—232px，落在可视范围内。
- 红包祝福语在相同高度下，经正文内部滚动落在约 261—311px，footer 约 311—380px，页面 scrollY 保持 0；没有发出红包。
- 展示附言弹窗在 380px 可视高度下，整体约 12—368px；offsetTop 改成 90px 后，整体跟随到约 102—458px，正文输入仍可见。关闭后锁定解除。
- 物品预览仅收到 viewport scroll，offsetTop 从 300 改为 450 时，预览 top 随之从约 347 调到 497px；不再需要额外 resize。
- 后台“材料库→新增材料”原生 dialog 在 380px 可视高度下约 19—361px，输入和底部操作区可见；视口上移后同步跟随，取消后无残留锁。没有保存材料。
- 1440×900、360×800、852×393 下抽查红包抽屉：正常布局无横向溢出；模拟键盘压缩后，祝福语及 footer 均在可视范围内。关闭后恢复原 overflow。原生 focus 可能主动滚动文档，代码没有额外争抢这一滚动。

`pnpm run lint`、Web 类型检查、`pnpm run build:client`、共享实现／文档的 Prettier 检查与 `git diff --check` 用于本轮静态验证。没有纯领域逻辑改动，未新增／运行领域单元测试。测试只打开、聚焦、滚动及关闭界面，没有发送聊天、消耗资源或提交后台修改。开发服务在并行工作期间重启导致的一次会话校验错误已刷新恢复，不能归为前端修复效果。

**iOS／Android 真机、原生键盘动画与第三方输入法仍待验证，没有部署。** 本节取代早先“保留旧弹层滚动锁”的范围约定；新增能力归属于共享弹层，不回填各业务页面的补偿样式。

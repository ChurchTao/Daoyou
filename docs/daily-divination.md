# 每日占卜

## 已实现规则

- 独立页面 `/game/divination`，洞府「每日占卜」与扩展导航进入。
- 每个活跃角色北京时间每自然日一次，不消耗天地灵气。服务器确定日期与三枚独立、公平的六面骰，客户端只播放演出。
- 八个所问方向：炼器、炼丹、灵兽培养、闭关、突破、秘境探索、野外寻觅、灵田照料。
- 26 个固定卦象定义在 `src/shared/lib/divination.ts`。忽略骰子顺序，优先匹配六种三同号、四种顺子、六种对子，其余16种散点组合映射到十种卦象；概率并非均等。
- 通常赠小聚灵符一张（使用恢复50点灵气）；只有6、6、6赠大聚灵符一张（恢复200点），替代小符，概率1/216。
- 签意仅供趣味解读，不参与真实玩法数值计算。获得符箓不消耗使用次数；实际使用沿用每日3次和2400点溢出上限。

## 状态与持久化

迁移 `drizzle/0051_daily_divination.sql` 增加 `wanjiedaoyou_daily_divinations`。`cultivator_id` 是主键，每角色仅一行，包含日期、方向、三骰、卦象ID、求签ID、生成令牌、最终解读、兜底标记和发奖时间。角色关联不使用数据库外键，0051直接创建无外键的表。角色归属与状态由 API/service 校验，删除角色时由应用层在同一事务内清理占卜记录。

状态由已有字段表达：没有解读为待解签；有解读、无发奖时间为待领取；有发奖时间为完成。同日不更换方向或重掷，次日只覆盖已发奖记录。旧日未完成的签先恢复结算，再开放今日求签；不保存历史列表，也不需要午夜清表任务。

- `GET /api/divination`：当天日期、可否求签和最近一签。
- `POST /api/divination/draw`：校验方向，锁定并保存当天骰子；重复提交返回原记录。
- `POST /api/divination/interpret`：携带 `drawId`，SSE 返回文本片段、最终签文和奖励完成事件。
- 纯本地验收可用 `DELETE /api/dev/cultivators/:id/divination` 重置该角色唯一的占卜记录，已发符箓保留；刷新页面后可重新测试。与解签共用分布式锁，详见 `docs/testing.md`。

## 并发与失败恢复

整段解签使用 `redisLockKeys.divination(cultivatorId)` 的可续租分布式锁。骰子写入、解读保存采用短事务，AI请求期间不持有数据库事务。每次重新生成写入新的 `generationId`；保存解读和发奖校验求签ID及生成令牌，并在事务提交前检查锁租约。

奖励通过角色 mutation 锁、角色行锁及现有背包占用检查后发放。符箓入包、发奖标记、资源版本与事件在同一事务内提交，提交后广播。背包满时沿用库存溢出到储藏室的能力。战斗占用等情况会保留签文，待限制解除后只重试领取。

AI使用 `streamAiText`、`daily-divination` 提示词与现有BYOK校验。30秒超时、空文本、截断、超长文本或客户端断线时使用预设解读，随后尝试结算；页面收到最终签文时替换不完整片段。进程中断或数据库异常则保留原签，重新进入可继续。服务端发奖不依赖前端是否收到最后一个SSE事件。

## 画面与交互

React负责案台内的方向选择与可访问点击层、结果文字和SSE状态；Phaser按需加载，负责案台背景与三骰演出。动画结束展示服务端点数。离开页面销毁Phaser并取消请求；减少动态效果偏好下直接显示结果。手机未占卜时使用 2:3 竖版案台与更大的骰子，解签后收为 3:2 横版场景并在下方阅读签文；宽屏沿用横版并列签文。初始在案台左上角用下拉选择所问方向，案台内提示「轻触案台 · 掷骰占卜」，不再在游戏下方放开始按钮；掷骰后收起方向选择，展开卦象与签文，正常完成自动发奖，只展示领取结果。中断后在签文下方继续解签或领取，领取不依赖 Phaser 加载成功。案台按视口高度限制首屏占用，保持整幅画面等比显示。ResizeObserver 先调用 Phaser getParentBounds 更新父容器尺寸，再 refresh，保证进入签文双栏时画布、背景与骰子同步缩放。

生产素材：`public/assets/divination/qiantai-v1.jpg`，1536×1024，约581KiB，作为Phaser纹理。由内置imagegen生成PNG后编码为JPEG；未使用CLI/API生成。骰子面由代码绘制以保证点数准确。

生成提示词：

> Use case: stylized-concept. Asset type: production background for a Chinese ink-painting cultivation game's interactive dice divination table, landscape 1536x1024. Create a restrained hand-painted ink and mineral watercolor illustration on warm ivory paper. Oblique overhead view of a broad aged dark cedar divination table inside a quiet mountain pavilion. A large EMPTY circular shallow bronze dice tray is centered in the lower-middle, occupying about 50% of the width, with subdued bronze rim and an empty matte warm charcoal interior suitable for overlaying three ivory dice in code. Upper left a small ceramic incense burner with one fine curl of smoke; upper right distant misty pine silhouettes beyond an open pavilion. Gentle pale jade and muted cinnabar accents, dry brush, expressive ink edges, broad washes, lots of calm breathing room in the upper third. Croppable side scenery: crucial empty tray centered and completely visible within middle 65% width. Beautiful artisanal board-game ambience, not photorealistic, no 3D render, no cinematic lighting, no grunge filter. NO dice, NO text, NO letters, NO calligraphy, NO numbers, NO symbols, NO diagrams, NO UI, NO watermark. This is a usable scene background, not a mockup.

## 本轮验证（2026-09-19，本地）

- `bun run test src/shared/lib/divination.test.ts src/shared/lib/qi.test.ts`：21项通过；遍历216种骰子结果，验证26卦全部可达、排列不改变结果、大奖唯一、非法点数拒绝、北京时间换日及符箓协议。
- `bun run lint`、`bun run build`通过；客户端构建仍有现有分包体积与动态/静态混用导入警告。
- 用本地配置执行Drizzle业务迁移；未迁移预发布或生产。
- 浏览器在本地道友1选择灵兽培养，得到2、2、4与「双镜照心」；真实AI输出222字，`fallback=false`，小聚灵符由0变1。
- 刷新保留骰子、方向、卦象与解读，禁止再次掷骰；只读数据库核实仅一条求签记录与一张符箓。
- 桌面和360×800手机布局均可查看骰子、签文、奖励；储物袋真实物品预览显示恢复50点及直接使用入口。
- 未做真实跨午夜等待、Redis故障/租约丢失、并发多客户端、背包满或强制大奖的运行时验收；相关路径本轮通过代码审查及适用的纯规则测试核对，不新增服务端或数据库测试脚本。
- 保留本轮正常求签产生的本地记录及奖励，无临时发放物资。

## 交互与领取修复（2026-09-19）

- 名称统一为「每日占卜」，洞府入口用 GameIcon 展示骰子图标。删除页面规则、免责声明和氛围填充文案，保留状态反馈和必要的恢复操作。
- 领取失败根因为该角色背包中有四种已不在注册表中的旧材料；原 grantInventory 会解析全部背包物品，导致无关旧物品触发「未知物品定义」。现仅解析可参与本次奖励堆叠的物品，所有原有背包格位仍参与占位，旧物品不被修改或删除。新增奖励和相关堆叠仍严格校验。
- 新增纯库存规划回归用例，覆盖保留格位、满包转储藏室、禁止溢出时报错和已有奖励堆叠。`bun run test src/shared/inventory src/shared/lib/divination.test.ts`：32 项通过。
- lint 和前后端构建通过；仍有既有分包警告。
- 已只读保存本地道友2失败记录与背包基准；浏览器领取验收被 Chrome 的扩展界面阻挡，本轮尚未确认实际领取结果和新版页面的视觉表现。没有通过数据库改写发奖状态或补发物品。

## Dev 重置接口验收（2026-09-19）

- 本地 API 实测：本地道友1首次重置返回 200 / `removed: 1`，重复重置返回 200 / `removed: 0`；非法 UUID 返回 400，不存在角色返回 404。
- 只读数据库对比确认：该角色占卜记录已删除，86 行库存内容完全一致，本地道友2的待领取记录未改变。保留重置后的状态，供重新体验完整流程。
- 本地开关沿用 API 注册、router middleware 和 service 三层校验；锁冲突与非本地环境的分支通过代码审查，未启动额外环境或进行并发故障注入。

## 案台内交互验收（2026-09-19）

- 桌面真实流程：下拉选择灵兽培养，点击案台后得到 6、4、6，完成 AI 解读并显示「小聚灵符 ×1 已领取」。下拉方向选择不会触发掷骰，掷骰期间禁止重复点击和切换方向。
- 1366×768 视口初始画布为 624×416，位于首屏固定导航上方；结果展开后画布为 456×304，与父容器一致，未裁切或放大骰子。
- 360×800 视口 DOM 核验：画布约 304×203，方向选择和游戏内点击层可用，无横向溢出；移除独立开始按钮。浏览器采集的移动截图存在缩略显示问题，未将其当作清晰视觉验收依据。
- `bun run lint`、`bun run build`、`git diff --check` 通过，浏览器无 error 日志；本次为前端交互与布局修复，未新增或重复运行纯领域单元测试。
- 验收后通过本地 dev 接口重置本地道友1的占卜记录供继续体验，保留实际取得的奖励，恢复浏览器原始尺寸。

## 手机端竖版构图（2026-09-19）

手机初始画面采用独立竖版背景，保留方向选择与点击层。React 根据阶段切换容器比例，Phaser 根据实际容器横竖比例切换逻辑画布（960×1440 / 960×640）、背景纹理与骰子容器位置/缩放。骰子动画在容器局部坐标内运行，尺寸变化时无需重置点数或重建玩法。横版仍保留桌面布局。

新增生产素材 `public/assets/divination/qiantai-mobile-v1.jpg`，1024×1536、约582KiB。使用内置 image_gen，以原横版背景为参考重新构图，随后用 sips 编码 JPEG；未使用 CLI/API 生成。原横版素材保留。

生成提示词：

> Use case: stylized-concept. Asset type: production portrait mobile game background, NOT a UI mockup. Image 1 is the reference for the same Chinese ink and mineral-watercolor mountain pavilion and bronze dice tray. Create a matching PORTRAIT 1024x1536 composition for this same divination table. Recompose, do not stretch the reference. Upper half: airy misty mountains and pine silhouettes viewed through pavilion, narrow side pillars, a small incense burner near the left table edge. Lower half: aged dark cedar tabletop with a large EMPTY shallow circular bronze tray viewed obliquely from above. IMPORTANT tray center at x=50% y=66%, tray width about 84% of image, tray height about 29% of image; entire rim is inside image with clear side margins. Leave tray interior dark, flat, and EMPTY for code-rendered dice. Lower 12% is quiet wood surface for a small UI hint overlay added later by code. Upper left 15% remains calm for a direction selector added later. Preserve restrained hand-painted watercolor texture, ivory paper, pine green and muted cinnabar, antique bronze, soft natural light, reference's artisanal style. No dice, no writing, no calligraphy, no letters, no logos, no borders, no UI controls, no text, no photorealism, no 3D render. Output only the production background.

验证：390×844 下初始画布为334×501，完整骰盘与点击提示位于首屏固定导航上方；方向选择闭关并用键盘 Enter 开始，得到3、4、3，完成解读并显示已领取。结果画布收为334×223。1366×768 桌面结果为456×304，两种尺寸均无横向溢出，浏览器无 error 日志。`bun run lint`、`bun run build`、`git diff --check`通过；本次未新增或重跑领域单元测试。临时视口覆盖已恢复，保留真实占卜产生的记录与奖励。

## 首页入口（2026-09-19）

首页 HomeAside 的「今日天机」区域替换为 DailyDivinationEntry，读取当前活跃角色真实占卜状态。未占卜时提示「今日尚未占卜」并提供「去占卜」；已占卜时回显预设卦名与卦辞，提供「查看解签」。未完成解读或发奖时分别提供「继续解签」「领取签礼」，跨日未结算记录标为「上次占卜待完成」。读取失败时保留进入占卜的入口，不展示随机卦象或错误地标为未占卜。

组件随角色 ID 重新挂载；页面返回、窗口聚焦、标签页重新可见、北京时间换日时重新读取，不缓存每日状态。占卜 HTTP/SSE 客户端移至 `src/react-app/lib/divinationApi.ts` 供首页与占卜页复用。删除首页不再使用的 DivineFortune 组件与 useDivineFortune hook。

浏览器实测已有「双鹭临汀」回显与查看解签跳转；用本地 dev 接口重置后验证「今日尚未占卜」及去占卜跳转，保留已领取符箓。390×844 手机布局可读，无横向溢出。`bun run lint`、`bun run build`、`git diff --check`通过；未新增前后端单元测试，真实跨午夜与角色切换只完成代码审查。

## 移除外键（2026-09-19）

- schema 移除占卜表 `cultivator_id.references(...)`，保留主键唯一性；仅修改该表的外键。
- 按后续要求将未提交、仅在本地执行过的0051与0052合并为0051：建表不创建外键，删除独立0052脚本及快照，同步0051快照和迁移日志。本地迁移元数据同步合并，不重建表或删除业务记录。
- `deleteCultivator` 在所属用户校验成功删除角色后，于同一事务清理占卜记录；未删除到角色时不清理记录。占卜写入仍先锁定并验证有效角色，避免与角色删除并发写入无主记录。
- 本地迁移通过，查询 pg_constraint 确认仅保留主键，原有1条占卜记录保留；未迁移预发布或生产。未执行真实角色删除验收，删除路径通过事务与归属校验代码审查；不新增数据库单元测试。

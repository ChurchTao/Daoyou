# 百晓盛会设计与施工

## 赛制

百晓盛会每周四北京时间 14:00–16:00 开放，15:15 停止新开局。已创建的炼气至渡劫角色均可免费参加。每账号每期一场，绑定入场角色，最长 45 分钟。传闻定位至大晋·晋京旁的「百晓盛会」，活动地标独立使用炼气门槛。非开放时仍可查看赛程。

每卷 25 关。四类配额为文学与文史 9 题、历史地理 7 题、脑洞与谜语 5 题、博物与科学 4 题。文学与文史收录诗文、语言、艺术及传统文化，历史地理收录历史人物、事件及地理知识，脑洞与谜语收录有唯一解的谜语和逻辑题，博物与科学收录自然科学、技术与生活中的科学事实。四类配额尚未凑齐的冻结题池沿用三类的 11／8／6。每人独立随机取题及打乱单选选项，每卷固定 6 易、13 中、6 难，是非题最多 5 题，同一知识点最多一题。游戏玩法设定题后续接入。

## 作答与封榜

每题打开到服务端收到选择最多 45 秒，选择提交后不可更改。答错、超时各记一次失误，累计第 10 次淘汰。超时计 45 秒。作答窗口每次失焦只把 15 秒计入总成绩，回到前台继续原题。失焦不改变答题时限、题序、失误数或连对。若原题在离开期间自然超时，回来按超时处理。加载和翻题发生在两题之间，不计单题用时，仍受个人场结束时间限制。后台期间不向浏览器发下一题。

题签显示分类和难度。答对后按原节奏展开下一题。答错、超时或对策卡判错后，在原题席揭示正确答案和解析，由玩家点「下一关」继续。回顾停下单题计时，耗时不计入成绩，全场限时仍在计时。回顾中刷新会回到该题，若此时已淘汰或到场限，则可以看完后进入本场成绩。

25 题完成且失误少于 10 次才上榜。总用时由作答用时、每次失误 20 秒与每次失焦 15 秒组成，内部按毫秒累计，榜单按十分之一秒比较，同档答对更多者在前，仍相同则并列。16:00 停止受理。封榜前展示最近一次已公布成绩，封榜后由玩家主动刷新。成绩明细单列失焦罚时。存量已判定题目和已公布成绩沿用原记录，不回补题目或重算旧成绩。

### 对策卡

| 卡牌 | 起手 | 效果 |
| --- | --- | --- |
| 免答卡 | 1 张 | 本题判对，按出卡前用时计入成绩。 |
| 天机卡 | 2 张 | 判对、判错各 50%，按出卡前用时计入成绩。 |
| 挑战卡 | 2 张 | 与百晓考官交手。战胜判对，固定计 25 秒。战败、平局或逃离按错题计 45 秒并罚时 20 秒。 |

任意方式判对均可积累连对。每连对 4 题，三种卡等概率补一张，再开始下一轮累计。任意失误清空当前连对。答题和出卡按同一题序结算，卡牌消耗和补牌记在该题结果中。失焦是独立的计时记录，服务端按场次、题序及已记录次数受理，重复传送不会叠加。挑战开场时按题序锁定出卡，战斗期间暂停单题倒计时及失焦判定，个人全场 45 分钟继续计时。考官按参赛角色境界使用普通云游除祟第四战首领预算，复用 V6 战斗和战斗动效。战斗从全状态开始，不改变场外角色和灵兽状态。正式成绩根据服务端战斗结果入账，重复结算沿用原结果。

## 收益

入场按角色境界及小境界保存奖励预算。满分相当于两份 24 小时平均历练的修为、灵石、感悟，使用现有历练计算，无物品及成就副作用，不更新日常历练时间。第 n 次答对的入账是各项预算的累计 25 等份取整差，25 题全对达到总预算，实际入账沿用角色资源上限。题目结果、数值写入和资源事件同事务提交，淘汰与离场保留已发收益。

通关另抽一件，功法典籍材料 90%、普通传承灵印 9%、上品传承灵印 1%。已抽中的奖品随系统传音发放，依参赛记录去重。物品来自已发布材料库的功法典籍和现有灵印注册池。活动准备时冻结候选池，名次不影响抽奖机会。

## 题库与运营

题库由 PostgreSQL 持久化。管理入口为 `/admin/baixiao-meet`，可上传或粘贴 `{"questions":[...]}` JSON，每批最多 350 道。导入时校验题型、分类、难度、知识点、选项、答案、解析和出处，成功后立即启用。相同知识点已有启用题时跳过。管理页提供停用和恢复，旧待审记录通过数据迁移转为停用。每期冻结题卷及奖励池后，题库操作作用于后续期次。题库配额不足或奖励池不完整时不开放入场，管理后台显示可诊断状态。

管理页提供「答题试玩器」。管理员随时可以按正式配额从当前启用题库抽卷，逐题选择答案，查看对错后继续。试玩在管理页内完成，用于检查抽题和实际答题难度。

首版附带 70 道独立种子题。本地从叶子猪公开题库筛出并独立改编 350 道。批次含文学与文史 213 道、历史地理 97 道、脑洞与谜语 40 道，其中单选 341 道、判断 9 道。每题记录原始题目索引。诗文题核对古籍及开源语料，其他题使用可辨认的出处或独立谜面。外部题库、清洗过程和模型不参与运行时组卷。 [古诗词数据库](https://github.com/chinese-poetry/chinese-poetry)

## 接入与验收

- 共享领域模型保存题目和成绩，规则包负责组卷、赛历、计分和资源分摊，契约包负责入参及公开结果。API 负责选题、裁决、强一致写入、传闻、封榜、奖励邮件。
- 百晓盛会与炼丹大会共用周常首页和榜单。首页顺序为地点与规则、开场状态、入场条件与操作、固定赛程。详情集中在「规则与奖励」。榜单在公布期次旁提示当前赛况，突出榜首和并列席位，展示其余名次及个人名次。选中任一席位查看计时和失误依据，关闭成绩抽屉后焦点回到原席。
- 题席在 GameActivityLayout 内用足视窗高度，正文限制最大宽度。计时、作答与手牌共用一张完整纸面，晋京文试厅留在纸面外。Phaser 播放题签过场，题干、选项和卡牌使用 DOM 控件。题号、失误、本题倒计时和全场剩余固定在上方，手牌固定在下方，题干与选项放不下时才滚动。题时遵循服务端下发的截止时间，最后 10 秒变色，最后 5 秒只闪动一个计时区域。亮暗色取系统主题，减少动态效果设置下保留数字与颜色。
- 手牌常驻展示图案、卡名和张数。悬停、聚焦或点按说明标记可查看风味文案与准确效果。点按免答卡直接使用，天机卡和挑战卡先在题席内展示代价并等待确认。出卡时标出提交中的卡牌，以服务端响应更新张数、连对和补牌。题号、判定、罚时、补牌和累计用时通过限时 Toast 提示，连接失败通过带「重连」操作的 Toast 提示。结算先展示通关或淘汰、总用时与到账收益，再按需展开计时明细。
- 文试厅和三种对策卡采用写意水墨，参考白泽墨像的形体完整度与笔墨层次。文试厅以檐柱、成排矮案和近处笔卷交代场所，左侧留白承托赛况。卡面以题卷上的朱勾、翻转的方孔铜钱和带考官令的握拳对应通过、随机和交手。卡面透明底，通过共享图标注册表接入。
- 考官战通过 `/game/baixiao-meet/battle/:battleId` 进入 `CombatV6Layout`，共享战斗界面、逃跑指令及系统设置中的主题。战斗结束后返回题席，由服务端战斗结果决定答题成绩。
- 验收覆盖随机组卷约束、45 秒边界、对策卡与连对补牌、挑战胜负和重连、试玩隔离、服务端收件顺序、双重提交、失焦、断网和恢复、第 10 次失误、全答对奖励累计、封榜和换榜。桌面、360px、键盘和减少动态效果分别检查。

## 本地验收记录

- 应用 `0081_baixiao_meet` 业务迁移，确认 70 道种子题可冻结，材料库存在已发布功法典籍。此前验证了题库变更后冻结题数保持不变。
- 用本地账号和模拟服务端时钟，从系统传闻定位大晋地标并进入 Phaser 赛场。360px 及桌面均无横向溢出。核对题目响应没有答案，越界选项返回 400，普通玩家请求后台返回 403。验证了键盘作答、刷新触发失焦、30 秒超时、丢响应后重连和累计第 10 次失误淘汰。
- 走通 25 题全对，核对累计资源与数据库增量一致，重复请求不发奖，通关邮件只有一封，日常历练时间保持原值。封榜前可见上一期，封榜后刷新才切到本期，并可打开计时明细。
- 本地验收后已清理临时期次、题目、传闻和邮件，并恢复测试角色资源。真实周四开场和多设备焦点表现留作上线观察。

### 题库清洗及直接导入

对 13,558 条源记录做全量归一化与筛查。剔除 1,789 条空答案、92 条规范化重复题干、59 条同题答案冲突、1,164 条明确带梦幻西游玩法标记和 252 条缺失原选项／图片／文章上下文的记录。诗文匹配阶段另外合并 117 条同一作品的改问或已有种子题。9,735 条候选缺少本次可核实的出处、判定依据或同类干扰项，未纳入该批。原始记录保存在原下载文件，导入批次为独立文件。

本地已应用 `0082_baixiao_direct_import`，通过管理页上传完整 350 题批次，题库立即更新为 420 道启用题。重传整批跳过 350 道。验证了非法批次 400、普通玩家 403、原审批接口 404、停用及恢复，并从数据库中的已启用题抽出 20 组符合 11／8／6 配额的题卷。

续编批次逐题保留原始索引、出处及解析，单选补齐四个互斥选项，按文学与文史、历史地理、脑洞与谜语、博物与科学及易、中、难归类。2026 年 11 月 24 日，本轮通过本地管理后台直接导入并净新增 1,692 道，累计启用 2,190 道。另有 6,414 条原始记录待核验，与剔除原因一并记入索引清单。重传已导入的批次会跳过已有知识点。抽查 50 份新题卷均为四类 9／7／5／4、难度 6／13／6。已冻结的两期题池仍各含 420 道题，继续按 11／8／6 组卷。

### 对策卡与试玩验收

本地应用 `0083_baixiao_challenge_cards`。后台在 360px 逐题完成一卷，确认 25 道题、11／8／6 分布、正确和错误反馈、重新抽卷，试玩过程没有发出写请求。正式赛验证了 45 秒开题、键盘使用免答卡、四连对补牌、天机卡判定、挑战刷新续战和跨账号访问限制。数据库中挑战胜利固定计 25 秒，失败计 45 秒并加 20 秒罚时，重传终局没有重复发奖。已清除验收期次并恢复测试角色资源。

### 周常界面改版验收

本地 Playwright 检查桌面和 360 × 568 短屏。两场首页覆盖等待、开放、截止、资格限制和筹备，核对规则抽屉、榜单入口与炼丹材料栏。榜单使用浏览器样本检查上一期日期、并列榜首、普通并列席位、个人名次、空榜及请求失败后的重试。成绩详情可用键盘进入和关闭，Tab 留在抽屉内，退出后焦点回到所选席位。

题席使用浏览器样本检查长题触摸滚动、卡牌与计时固定、两段预警、减少动态效果、答题与出卡反馈、四连对补牌，以及通关、淘汰和公布阶段的结果文案。考官战另走本地正式接口，确认主题由系统设置切换、刷新续战、标准战斗逃跑后回到下一题，按错题计入 65 秒。该次参赛记录和临时战局已清理。

### 图像生成提示

四项素材均使用内置 ImageGen。固定男修基准用于校准暖灰墨色与宽笔笔触，已采用的稀有异兽白泽用于校准轮廓的完整度与细节疏密。 [男修基准](../.agents/skills/daoyou-ink-portraits/references/male-baseline.webp) · [白泽墨像](../apps/web/public/assets/icons/beast-baize.webp)

四项素材共用的笔墨提示

> Use reference 1, the cultivator ink portrait, exclusively for warm-gray ink tonality, broad layered brushwork and sparse dark anchors. Use reference 2, the accepted rare beast Baize, exclusively for the amount of finished form, the continuous connection of the larger ink shapes, and the selective narrow structural strokes within them. Translate that brush treatment into this subject; do not include any human, animal or any reference pose. Draw as Chinese xieyi ink painting with controlled description (写意水墨，形全，墨面有组织，重点数笔交代). Keep a complete readable silhouette built from overlapping warm-gray washes; place dark ink at a few structural joins, connect them with broad midtone and lighter washes, and let only a few selected contours break into directional feibai. As in Baize, several finer, confident strokes resolve the identity of the object, with small local color absorbed into the ink shape. Make the painting visibly composed and finished, with clear physical construction. Avoid isolated brush gestures, pure silhouettes, flat pictograms, uniform fine contour tracing, surface micro-detail, photorealism, CGI, vector treatment, rendered highlights and special effects.

三枚卡面共用的构图提示

> One compact illustration, square true transparency, no external rectangle, ground, drop shadow, lighting effects or decorative border. Fill about 88 percent, leave breathing room, each silhouette and its most meaningful cue must survive at 46 CSS pixels on ivory and dark teal-charcoal UI. Midtone ink with small near-dark joints, warm ivory reserves inside the shape, and no baked backing. No titles, words, letters, labels, or watermark. The paper, ribbons and markings below are part of the object. Give one large, visually dominant action cue.

各卡面的主体提示

- A partly unrolled ancient Chinese answer scroll held in a compact diagonal pose with a generous readable warm-ivory face and one tightly curled end. A SINGLE large confident sweeping vermilion approval check (批阅朱勾, a clearly legible traditional calligraphy check mark, one short rising hook and one long rising sweep) across its face is the dominant subject. It should look painted directly on the open scroll, not like a suspended UI check icon. The dark ink inside the rolled edge and one solid fold make the sheet read as an actual scroll on both UI themes. No other lines of script, stamp or marks. The red approval stroke is at least one half of the width of the paper face. [免答卡](../apps/web/public/assets/icons/baixiao-pass.webp)
- A chance talisman depicting one ancient Chinese square-holed divination cash coin shown in mid-flip, in two complementary implied positions on a tight diagonal. A broad face-up pale celadon-bronze coin low and to the left with one clearly formed square central hole, and a half-turned, slightly higher facing round warm charcoal-ochre coin at upper right with a glimpse of its hole. They overlap just slightly but read as two opposed possible faces of the same type, with broad outlines made from grouped gray ink, generous inner reserves and a couple of dry brush edges. One little bent dilute ink sweep between them hints a flip. No shine, no extra objects, no decorative characters or engravings on the coins. Emphasize the round silhouettes, square holes and light versus dark faces, the instantly understandable coin toss. [天机卡](../apps/web/public/assets/icons/baixiao-fortune.webp)
- A raised clenched fist in a broad three-quarter front view, emerging from a short dignified charcoal gray scholar sleeve. Compact anatomy and an immediately recognizable fist silhouette; use four quiet warm-gray knuckle breaks, ivory midtone hand planes and one concentrated thumb joint. At the cuff, a smaller diagonally slanted old examiner tally with a short restrained vermilion knot establishes that this is a formal challenge. The fist occupies about two-thirds of the readable footprint and stays the primary motif; fuse sleeve and fist into one definite form. Ink-brush face and sleeve complete at picture-book scale. No presented character, no contact, no blood, no weapons, no halo, no sound effects or letters. [挑战卡](../apps/web/public/assets/icons/baixiao-challenge.webp)

文试厅的场景提示

> A wide event lobby painting of the capital Jin civil examination hall, as a classical Chinese monochrome-and-light-color album leaf meant for this game. Warm ivory xuan paper, ample undisturbed pale warm-gray space in the left 43 percent for game copy. Put the recognizable connected hall structure, an open side corridor and one exam desk with a rolled sheet in the upper and middle right, with the main desk roughly 40 percent down the canvas and with enough margin to read in a narrow center-right crop. Half the hall continues off to the right. Let the eaves taper into dry strokes, but actually resolve three structural joins where a curved eave, a simple bracket and a weight-bearing column come together, using a few deliberate narrow warm charcoal strokes. Give the hall two coherent receding rows of low exam desks, with a clear top, edge and feet on the main desks, and a simple brush cup and two rolled sheets for one unmistakable reading place. The open courtyard behind is only three receding washes with one low gate and a touch of quiet celadon foliage. Controlled ink edges at focal joins, broad grouped warm-gray washes for the rest, no drawing every tile, nail, grain of wood or floor grid, no sharp photographic cast shadows. One pale mineral celadon wash and a small subdued burnt-ochre mark on a desk as local ink color. Lead the eye from the eave to the desk; the luminous quiet is bare paper not realistic lighting. Mature ink structure and clearly legible intent at desktop and portrait crop; restrained rather than unfinished. No grandiose symmetry, captions, lettering, stamps, humans or animals. 3:2 landscape.

[晋京文试厅](../apps/web/public/assets/weekly/baixiao-jinjing-hall.webp)

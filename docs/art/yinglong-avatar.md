# 应龙蓝墨赭金头像

采用日期：2026-10-05。用户确认`yinglong-blue-gold-v2.png`并要求替换进游戏，下一只继续麒麟。本轮仅换立绘，不打开网页验收；网页效果由用户亲自验收。

## 采用依据与素材

- 从用户像素参考第三排第三格应龙提取蓝色修长龙身、赭金角鬃与浅赭腹线。蓝墨直接构成龙首、盘身、四肢与双翼，赭金组织角鬃、腹带与爪端；蓝金配色及具体羽翼形状均属本次美术选择，不称为古籍规定，也不新增元素能力。像素格未清楚展示双翼，不据此删去当前物种的完整双翼。
- 项目`combat.wild.species.yinglong`形态为角须四足、长身盘曲、背生完整双翼，盘踞雷云与高空水气汇聚处。本次只作头像，不修改物种文案、数值、技能或玩法。
- [《山海经·大荒东经》](https://zh.wikisource.org/wiki/山海經/大荒東經)记应龙杀蚩尤与夸父、旱时作应龙之状而得雨；[《大荒北经》](https://zh.wikisource.org/wiki/山海經/大荒北經)记黄帝令应龙攻蚩尤、“应龙畜水”及南居多雨。此稿取水雨、俯察的意象，不据古籍增添游戏能力或绘制背景云雨。
- 有翼的明确解释见[郭璞注原页](https://zh.wikisource.org/wiki/Page:Sibu_Congkan0466-郭璞-山海經-2-2.djvu/133)“应龙，龙有翼者也”，不混作《山海经》正文的形态描述。另有[《艺文类聚》卷九十六引《广雅》](https://ctext.org/text.pl?if=gb&node=551405)“有翼曰应龙”，不将该引文归给《说文》。两者均未直接规定蓝金配色、羽翼形状或此稿四足构图，不宣称精确复原古籍。
- 旧应龙灰白盘身与淡青翼缘仅作前后对照，不作为生成输入。固定男女墨像只提供宽笔、浓淡、干湿飞白与留白的尺度，其他已采用灵兽不作形态模板。
- 使用内置image_gen一次全新生成、一次针对画布边界的编辑，未用CLI、程序化改色、补画或抠图。v1输入依次为项目根目录下`output/imagegen/zhuyan-cinnabar-redesign/pixel-reference.png`、`.agents/skills/daoyou-ink-portraits/references/male-baseline.webp`和同目录`female-baseline.webp`；v2唯一输入为本地v1。
- v1原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-0a398437-79fc-458d-a5cf-fb277490cc9c.png`；项目副本`output/imagegen/yinglong-blue-gold-redesign/yinglong-blue-gold-v1.png`。
- v2原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-e0e15c36-04c6-4bd6-8343-0c8349fc0a32.png`；项目选稿`output/imagegen/yinglong-blue-gold-redesign/yinglong-blue-gold-v2.png`。两轮默认目录原稿均保留，项目副本与原稿一致。
- 正式素材为`apps/web/public/assets/icons/beast-yinglong.webp`，沿用`icon:beast-yinglong`注册。从1254×1254选稿按alpha≥4边界`(67,81)—(1196,1188)`裁掉透明外边距，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100，39308字节；保留内部负形与半透明笔触。
- 正式文件SHA-256为`709305ee70126fdc4e8363224835bec261090ddfee8637a5697f0b3945307f4c`。旧正式图备份为`output/imagegen/yinglong-blue-gold-redesign/original-beast-yinglong.webp`，SHA-256为`3d12ac9969313d04508b1a9fb4e83cbe3b38782d6e4ca9eaa881cdc7671b308a`，覆盖前已核对与旧正式图一致；正式导出统计见同目录`production-export.json`。

## 修框经过与已采用造型

v1蓝金色形、双翼与四足成立，但最高翼尖、右翼缘和尾末触到源画布边，左羽也很靠边。1254×1254原稿按alpha≥4统计，顶部5、右侧9、底部12个边缘像素，左侧0；裁切边界为`(8,0)—(1254,1254)`。v1因此保留为修正史，不作为正式素材。

v2只针对取景过满与外轮廓截断，用同一张v1缩小整体构图并恢复翼尖、尾末。蓝金配色、头向、S形盘身、双翼四足及笔墨关系继续保留。源图alpha≥4边界为`(67,81)—(1196,1188)`，四条源图边均无alpha≥4像素；角尖、长须、双翼翼尖、四爪与尾末完整在框内。实际安全空间未达到提示中的每侧至少8%，以源图边界记录为准，不声称精确实现该数字。

采用图为清俊有威仪的蓝金有翼中国龙，龙首朝右微俯，开放S形龙身连续延至唯一尾根。四足按前后两组可数，腿根有遮挡但连接可理解；两翼各从肩背侧生出，翼身之间和盘身开口保留真实透明负形，未见必须修复的多足、多身或断尾。

实际尾末为羽状／鬃状分叉尾簇，属于同一条尾，与提示中的单一收尖尾不同。双翼较宽，蓝色鲜明，羽片、角枝、鬃与爪部层次较密，头面眼鼻较精细；神态偏清俊威仪，沉静古拙的行雨感较弱。宽笔飞白与彩墨构形可见，但不宣称已达到固定男女基准的全部疏朗减笔要求。用户已看稿接受这些实际边界，保留v2，不按初始提示重绘。

## 验证范围

v2原稿1254×1254 RGBA、alpha范围0—255，透明像素934539、半透明像素637507。独立源图、256px候选预览及候选阶段内存纸色合成未见明确必须修复的足数、连接或裁切缺陷；未见烘焙纸张矩形、棋盘纹、背景景物或明显脏底。256px可辨蓝金盘身和完整双翼，缩小后龙首与四足细节较小，不承诺小列表能读清全部细部。

`validation-v1.json`记录首稿触框，`validation-v2.json`的候选状态与`productionPreserved`属于采用前记录；正式接入以`production-export.json`为准。`yinglong-blue-gold-v2-preview.webp`仅作候选阶段缩小检查，不替代正式导出统计。

正式WebP的alpha范围0—255，可见边界`(0,2)—(256,253)`，长边占满、短边居中，源稿SHA-256为`ae13a4bfe702de475a89b1698904ec1f61f40d8e66867aa80bfb13fcb1a051f7`。已核对源稿、正式图与备份路径及hash。

按用户要求，只替换立绘，不打开网页、不启动预览服务器，不做桌面／手机网页验收；网页效果由用户亲自验收。仅核对静态源图与导出图、alpha／边界、路径、SHA-256、两轮提示词和差异。纯素材及记录，未独立运行lint、typecheck、完整生产build或test，未修改同期应用代码、配置和游戏数据。下文两段实际完整提示词分别与`prompt.txt`及`prompt-v2.txt`逐字一致；详见[头像采用记录](../beast-avatar-generation.md)。

## 实际首稿提示词

```text
Use case: stylized-concept
Asset type: 《万界道友》应龙灵兽写意彩墨头像，单只完整有翼中国龙，方形透明底，最终显示24—60px。

参考图角色：
图1是用户25物种像素板，只提炼第三排第三格“应龙”的蓝色修长龙躯、赭金角鬃与浅赭腹线的色形，不复制像素风、卡通比例或其他物种。该像素格没有清楚展示双翼，须根据以下物种与传说要求重新设计并保留完整双翼。
图2男修和图3女修是固定笔墨参考，只取宽笔墨面、浓淡、干湿飞白与留白，不复制人物脸、衣袍、解剖或姿势。旧应龙与其他已选灵兽不作生成输入或造型模板。

身份依据与神韵：
项目当前应龙为角须四足、长身盘曲、背生完整双翼的生灵。取《山海经·大荒东经》《大荒北经》应龙与水雨的意象，郭璞注解释“应龙，龙有翼者也”；文字不规定蓝金配色或羽翼的形状，这些为本次像素参考启发下的美术选择。只制作立绘，不新增能力。
应龙是清晰的有翼中国龙：修长连贯的龙颈与龙身、威严而收敛的龙首、两支较收束的赭金分枝角、两条细长龙须、少量短赭金颈鬃，恰好四条龙腿和四只龙爪，恰好两片完整羽翼，唯一的躯干逐渐延续为一条收尖龙尾。不要改成粗胸短躯的西方飞龙，不要狮脸、鹰头、蛇头，不加第二个头。
龙首微俯、目光清醒平稳，嘴闭合或极轻微开缝，以小片深墨提示眼与鼻，龙须随朝向自然舒展。像在高空水气中缓缓转身俯察，翼舒而不急振，身姿有稳定的流动；不张口怒吼，不作扑猎，不以闪电、云团或发光眼强调神威。

构图、连接与数量：
完整全身，稍侧转的三分之四视角，龙首在上部偏左，朝画面右前下方轻轻俯察；胸颈在中上部，长身向下形成一个开放而疏朗的S形盘曲，下腹与腰胯的关系清楚。尾从腰胯后连续舒展，沿画面右下弧出并渐尖。只有一条从颈、胸腹、腰胯到尾的连贯身躯，不打多个密闭圆环，不让盘曲重叠成两条身体或多条尾。
恰好两片羽翼从肩背的左右两侧生出，左翼向左上舒展，右翼向右上及侧方舒展，翼姿稍不对称但都完整、翼根清楚。翼根与前腿根各在相应的背侧与腹侧，不把翼误画为第三对腿。两翼外缘、翼尖均完整在框内；翼与龙首、龙身之间留清楚真实透明间隔，不把龙首压进翼面中。
四条龙腿按前后两组错开：两前腿从胸腹两侧伸出，一只轻探前下、一只略收，均露完整爪端；两后腿从下部腰胯两侧生出，一伸一收，腿根到爪可理解。只有四条龙腿，不增添孤立爪、第五足或从龙尾长出的腿。尾绕行时不要穿过腿根，也不在爪边接出另一条尾。爪以宽笔和少量收尖笔概括，不逐根精描每个爪趾。
让龙首和中上段龙身有足够体量，双翼与盘身是清楚的身份轮廓，头角不能因铺满翼幅而缩得过小。角尖、龙须、两翼翼尖、四爪和唯一尾尖全在框内，外围保留约8%的透明生成安全空间，尤其不截断双翼。

固定笔墨语言：
为《万界道友》制作一幅「写意墨像」：像古籍中的生灵墨画，介于主体剪影与中国写意画之间。墨迹本身构成形体，几块宽笔墨面与少量长线概括结构，少量浓墨作支点，中淡墨、飞白与留白共同补全身形。笔触有干湿与行进方向，轮廓局部断开，末端散入留白。以符合主体解剖的少量识别笔触提示朝向和神态，躯体以墨面概括，不精描材质或渲染写实光照。气韵来自疏朗、重心和虚实。参照固定男女墨像的笔触尺度和材质概括，不变成写实怪兽再叠水墨纹理。
龙身以沿盘曲方向行进的几段长宽笔洗染构成，背侧少量深墨为支点，胸腹转折以中淡墨、飞白和断笔留白补全。鳞甲只以极少数方向笔提示，不画完整细密鳞片网格，不逐根雕刻鬃毛。角须有可信根部但笔触收束，不铺成长飘带。
两翼以几组宽幅长羽状墨笔概括，羽片数量精简、间隙疏朗，保留完整翼势而不逐根刻羽；翼内浓淡有变化和真实露底，不画骨刺满布的蝙蝠膜翼、不做华丽孔雀屏或实体装甲。

彩墨直接构形：
石青蓝、群青与蓝灰直接构成龙首、颈背、修长龙躯和四肢，深蓝墨压住背侧与肩颈，中蓝宽洗染连接盘曲体面，淡蓝灰与飞白打开内腹转折。必须先读到蓝墨龙躯，不是苍白灰龙上几条蓝线、蓝色光边或背景水雾。
赭金与温暖土黄明确构成两支角、短颈鬃、沿盘身连续的腹部色带及少量爪端，与蓝墨自然衔接；赭金不是金属镜面或规则铠甲。双翼以中淡石青、蓝灰宽笔形成翼面，少量深蓝分出翼根与外侧组织，不让两翼退成纯灰白羽团，也不把深蓝铺成满幅浓黑。
配色来自像素参考的创作选择，用色仍有干湿、浓淡、飞白与留白；没有发光、霓虹、彩色光效或水波特效。

交付：
单个完整应龙，真正透明RGBA，只有生灵自身的墨迹。外部、翼与身之间、腿间、盘身开口、断笔留白真实透底。无纸张矩形、纸纹、棋盘格、山石、地面、云团、水面、背景投影、闪电、光环、文字、印章、边框、水印或设计板。缩小后首先可辨蓝金龙身、完整双翼与开放盘曲，更大尺寸能读四足连接、角须及俯察神态。
```

## 实际v2修框提示词

```text
Use case: precise-object-edit
Edit the provided Yinglong / 应龙 illustration ONLY to correct the cramped canvas and clipped outer silhouette. Preserve the original dragon design, palette, brushwork, anatomy, proportions, facial expression, facing direction, S-curved body, and wing pose.

Keep the same blue-ink Chinese dragon with ochre-gold paired branching horns, short mane and belly band, exactly TWO blue-gray feather wings attached to the shoulder/back, exactly FOUR connected dragon legs and four claws, exactly ONE continuous body and ONE tapering tail. Keep the slightly lowered calm dragon head facing toward the right, paired long whiskers, the present blue/gold distribution and broad dry/wet ink strokes. Do not repaint or simplify the design, change color, add limbs, change wing orientation or alter the silhouette's character.

Focused correction: the first image is too large for its canvas. The highest LEFT wingtip touches the TOP edge; several LEFT wing feathers sit too close to the LEFT edge; the outer RIGHT wing feathers touch the RIGHT edge; the lower tail brush-tip touches the BOTTOM edge. Reframe the WHOLE dragon smaller in a square transparent canvas with a CLEAR TRANSPARENT OUTER MARGIN, at least 8% on EVERY side. Retain its relative internal proportions and arrangement. Restore any truncated wing feather tips and the single tail-tip as natural tapering dry-brush ends; make BOTH wings' entire external contours unambiguously complete. All horns, whiskers, wing tips, claws and tail tip must be completely visible and terminate BEFORE the canvas edge. Do not erase the tips or fake completion with a feathered fade at the edge. Keep exactly four limbs and a single tail.

True RGBA transparency around the entire dragon and through original open negative spaces. Only the dragon's own ink strokes; no paper, background rectangle, checkerboard pattern, clouds, floor, shadow patch, halo, text, stamp, watermark or border. This is a precise framing repair, not a new concept or a change of species. Do not enlarge the head or shrink only the wings. Deliver one complete dragon with restored outer tips and comfortable transparent margin.
```

# 穷奇赭金赤翼头像

采用日期：2026-10-05。用户确认完整轮廓的`qiongqi-ochre-red-v2.png`并要求替换进游戏。

## 采用依据与素材

- 从用户像素参考第一排第四格穷奇提取赭金虎躯、粗黑虎纹与赤色羽翼，颜色直接参与虎身和翼面构形；不复制像素风、Q版比例及夸张双角。
- 采用[《山海经·海内北经》](https://zh.wikisource.org/wiki/山海經/海內北經)“穷奇状如虎，有翼”的形态，以低首凝视、强肩收腹和扑猎笔势表达凶兽神韵。该条未规定角、毛色、翼色或翼的材质；赭金虎身、赤色羽翼与省去角均是本次美术选择，赤翼不表示新增火系能力。
- [《山海经·西山经》](https://zh.wikisource.org/wiki/山海經/西山經)邽山条另记牛形、猬毛、声如嗥狗的穷奇；本稿使用虎形有翼版本，不混入该条的牛体、牛角、刺毛或狗形。
- 内置image_gen一次全新生成、一次画布与外轮廓修正，均请求真实透明背景。固定男女墨像仅作笔墨参考，旧穷奇只作结果对照，未作为生成输入，也不套用其他已选灵兽。
- 首稿原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-147d80c4-6ae4-4fc8-809b-9d76fd5be216.png`；项目副本`output/imagegen/qiongqi-ochre-red-redesign/qiongqi-ochre-red-v1.png`。右侧翼缘触边、尾部靠边，未采用为正式素材。
- 编辑原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-18e04959-7581-4123-9950-65bb001a2532.png`；项目选稿`output/imagegen/qiongqi-ochre-red-redesign/qiongqi-ochre-red-v2.png`。v2只以v1为输入，修正方形占幅与右侧外轮廓，保留虎形、双翼、四足、单尾和用色。
- 正式素材为`apps/web/public/assets/icons/beast-qiongqi.webp`，沿用`icon:beast-qiongqi`注册。按alpha≥4边界`(66,72)—(1221,1199)`裁掉透明外边距，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100，35370字节；保留内部负形与半透明笔触，旧素材备份为`output/imagegen/qiongqi-ochre-red-redesign/original-beast-qiongqi.webp`。没有程序化补画或改色，也未修改物种文案、数值或技能；正式统计见`output/imagegen/qiongqi-ochre-red-redesign/production-export.json`。

## 已采用造型与实际边界

赭金虎头和胸肩、粗黑虎纹与朱赭赤墨双翼形成明确色形。圆小耳、宽额短吻、强肩收腹清楚，双翼连接肩背两侧，四肢合理连接，单条环纹尾从后臀生出。近侧前爪前伸、远侧前爪抬收，两后足可辨；实际表现为逼近或扑落的动态姿态，近翼较大幅度展开、远翼较收，不能记作初始提示中的“两前足支住、静伏半折翼”已经实现。

虎面、虎纹和分层羽束仍比固定男女墨像精细，内部淡墨与留白较少，整体为较浓重的彩墨翼虎。用户看稿后接受该扑猎姿态与笔墨表现，不宣称全部减笔、浓淡或姿态要求均已达成。v2原稿1254×1254 RGBA、alpha范围0—255、alpha≥4裁切边界`(66,72)—(1221,1199)`；四条画布边均无alpha≥4像素，翼尖、足爪与尾外缘完整，内部负形及半透明笔触保留。24—30px先读到赭金虎身与赤翼，虎面、四足和虎纹细节在48px及以上更清楚。

## 验证

正式WebP的alpha范围0—255，透明像素29162、半透明像素35197，可见边界`(0,3)—(256,253)`。候选阶段已查看纸色与深底24/30/48/60/72px预览及与固定男女墨像并排的效果，未见烘焙纸底或棋盘纹；图片正常加载，候选对照页控制台error/warn为空。统计与对照截图为`output/imagegen/qiongqi-ochre-red-redesign/validation-v2.json`、`review-paper-dark.png`。

正式接入后的首次桌面DOM检查已确认生产路径、`complete=true`、natural尺寸256×256及30px列表／60px详情。后续复查前本地服务短暂不可用，页面出现connection refused；既有`dev:web`的Turbo watch在同期代码修改后自行重启恢复。本轮未另启动开发服务或修改服务配置，不将全过程记作始终无错。

恢复后在1280×720桌面检查大乘图鉴，列表30px、详情60px；390×844手机列表24px、详情48px。两边图片`currentSrc`均为`http://127.0.0.1:5174/assets/icons/beast-qiongqi.webp`、`complete=true`、natural尺寸256×256；赭金虎身与赤翼清楚，未见裁断或挤压。恢复后的桌面／手机控制台error/warn均为空，截图为`output/imagegen/qiongqi-ochre-red-redesign/game-desktop.png`、`game-mobile.png`。检查后已重置视口，保留既有开发服务。

执行Node/Sharp透明统计与正式导出、桌面／手机浏览器检查、`rg`路径核对、`git diff --check`，并核对下文两次实际完整提示词与`output/imagegen/qiongqi-ochre-red-redesign/prompt.txt`、`prompt-v2.txt`逐字一致。既有`dev:web`后台进行了依赖库重建；本轮纯素材及文档改动，未独立运行lint、typecheck、完整生产build和test，未修改代码或游戏数据。详见[头像采用记录](../beast-avatar-generation.md)。

## 实际首次生成提示词

```text
Use case: stylized-concept.
Asset type: 《万界道友》穷奇灵兽图鉴透明头像候选，全新重新设计，方形画布，单只完整四足翼虎。
Input images: 图1是用户25物种像素参考，仅从第一排第四格“穷奇”提取赭金虎躯、墨黑虎纹与赤色羽翼的色形启发，不复制像素风、Q版或其中的夸张双角；图2男修、图3女修是固定笔墨参考，仅借宽笔墨面、干湿飞白、浓淡和留白，不复制人物解剖、衣袍、面孔或姿势，不是编辑对象。完全按本次虎形有翼概念重新构思，不输入旧头像或其他已选灵兽。

身份依据：取《山海经·海内北经》“穷奇状如虎，有翼”的虎形有翼版本。现项目事实是虎形兽躯、胸肩强壮、腰腹紧收、背生宽大双翼、伏身折翼、高处扑猎。强烈凶兽神韵来自伏肩、凝视、蓄力的虎身，不画牛体、猬刺毛或狗形，不混入《西山经》另一牛形描述。原文未规定色相、羽翼材质和角；本次赭金虎身、黑纹、赤色羽翼由像素参考提炼，是创作选择。无角，避免把双角变成虎首的主要身份。

解剖和神态：宽额短而强的真虎首，圆小耳、宽颧颊、短粗颈、厚胸肩、强健前臂与宽爪掌、收紧腰腹、后躯有弹性。虎头不能像长鬃狮子或尖吻狼，也不成人脸。只有少量短颊毛，不画蓬松卷鬃。眼用简洁浓墨与小片赭色，目光锁住左前下方目标，清醒凶悍。嘴闭合或很小的低吼开缝，不张口吼叫，不把满口牙齿当威胁感。虎纹以有结构的几组粗黑笔落在额颊、肩背、肋侧和腿上，数量疏朗。恰好四条虎腿和四只足，各自正确连到肩腹后躯；恰好一条粗细自然渐收、有墨黑环纹的虎尾，清楚从后臀生出，轻弯向右后上，尾尖短而收束，不是狮尾毛球、长凤尾或多尾。

姿态与構图：全身三分之四侧视，虎头在左下前方，近侧肩高起，身躯向右后方延伸。身体压低，前足一前一后支住，近侧前足稍向左前伸出，后腿屈曲蹬住，臀和背脊连贯，像在高处扑落前的最后一刻蓄力；不画悬崖或地面。头、肩、前爪形成向下前方的主笔势，但不要把虎躯画成细长管子。双翼都从肩胛后方的背脊两侧正确连接，翼根厚实，不替代任何一条前腿。近侧右翼半折并向右上打开，形成一块醒目宽大的赭赤翼面；远侧左翼略收、向左上露出，与近翼错落，不左右镜像的展翅徽章，不全展像凤凰飞舞。两翼的肩根、转折、长羽方向清楚，翼与虎耳、虎背、足爪之间留出负形，不堆羽毛盖住虎头。主体紧凑自然，四足、尾尖、两翼尖完整在框内。

笔墨语言：为《万界道友》制作一幅「写意墨像」：像古籍中的生灵墨画，介于主体剪影与中国写意画之间。墨迹本身构成形体，几块宽笔墨面与少量长线概括结构，少量浓墨作支点，中淡墨、飞白与留白共同补全身形。笔触有干湿与行进方向，轮廓局部断开，末端散入留白。符合主体解剖，以少量识别墨笔提示朝向和神态，不强加人脸。虎身与翼以墨面概括，不逐根画毛、不雕刻肌肉、羽片或写实眼睛，不精描材质或渲染体积光。气韵来自重心、笔势与虚实，而不是长鬃飘带或光效。保持固定参考的笔触尺度与材质概括，不能变成游戏写实翼虎海报加水墨滤镜。

色彩直接构形：赭黄、土金与赭褐彩墨直接构成虎头、胸肩和身躯主体，让缩小后先读到金赭色猛虎，不再是灰白兽身外面几条金线。墨黑虎纹与深赭墨压住肩背转折、翼根和前爪的承重处，暖灰淡墨连接腹侧。暖白只用于口鼻和少量胸腹留白，不是大白狮。朱砂红、赤褐与焦赭彩墨以几组宽笔长羽束构成双翼的主要羽面，浓赤翼根、较淡赭红羽端，与虎身金赭形成凝聚色形；不是翼的红色描边、染两片羽毛或背景火焰。羽束有干湿和飞白，不能逐片均匀描羽。赭金、赤墨与墨黑彼此渗化，颜色有分量且仍像墨画，不是金属反射、霓虹、发光火翼或火焰特效；赤翼不表示新增火系能力。

构图与交付：真正透明RGBA背景，只有穷奇自己的墨迹，翼间、腿间及筆间空隙真实透明。四周至少留6%透明生成安全空间，尤其上方两翼尖与右侧尾尖不能触边截断。不要背景、纸张矩形、纸纹、棋盘格、山石、悬崖、地面、影子底座、日轮、光环、火焰、烟雾、粒子、题字、印章、边框或水印。不要蝙蝠膜翼、羽翼装甲、外加角、珠宝或符纹，不要对称标志、动漫萌宠、精细工笔或3D。用于256方形透明WebP，24/30px首先认出赭金伏虎和宽赤翼，48/60px读到粗黑虎纹、肩背蓄力、四足与单尾。
```

## 实际构图修正提示词

```text
Use case: precise-object-edit.
Edit target: attached qiongqi-ochre-red-v1.png, a transparent Chinese colored-ink winged tiger.
Make one targeted composition repair. The rightmost raised-wing feather and the outer curl of the tail are squeezed into the right edge of the current canvas; alpha touches that edge and part of the contours is clipped. Preserve the current selected drawing, but reduce and reposition the whole creature proportionally inside a square transparent canvas so ALL wing tips, paws and the tail have visible transparent breathing room on all four sides. Reconstruct only the tiny missing outer ends of the rightmost wing feather and the outer tail curve, in exactly the same original red/black/ochre brush style and natural tapered contours. Keep approximately 7% real transparent safety space beyond every extreme contour. No feature should touch any image boundary.
Invariants: retain the ochre-gold tiger body, coarse black tiger stripes, broad round-eared tiger head and focused predatory eyes, closed mouth, powerful low shoulders, tight waist, crouching body, four anatomically connected legs and exactly four paws with their original positions, exactly two asymmetric red feathered wings correctly attached to the shoulder back, and exactly one striped tiger tail connected to the rump. Do not change the pose or redesign the tiger; do not add horns, long mane, more appendages, armor or decorative motifs. Keep all internal negative spaces and semi-transparent brushstrokes. Preserve original Chinese ink texture, broad brush masses, dry/wet variation, ochre body and cinnabar/earth-red wings.
Output one complete creature on genuinely transparent RGBA, no paper or checkerboard, background, ground, shadow, cliff, fire, glow, smoke, particles, sun, text, seal, watermark or border. This is only a canvas/outer-contour repair, not a new species redesign.
```

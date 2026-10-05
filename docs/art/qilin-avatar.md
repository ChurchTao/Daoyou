# 麒麟青绿赭金头像

采用日期：2026-10-05。用户确认`qilin-jade-gold-v2.png`并要求替换进游戏，完成后仅盘点还有哪些物种未重新设计，下一只待选择。本轮仅换立绘，不打开网页验收；网页效果由用户亲自验收。

## 采用依据与素材

- 用户25物种像素板没有直接标注麒麟。青绿与赭金仅借第二行第二格英招的色彩关系，不将该格认作麒麟，不迁移英招的翼、人面或其他解剖，也不以天禄作麒麟原型。青绿鳞身、赭金角鬃与淡赭腹线是本次创作选择，不称为古籍指定颜色，不新增元素能力。
- 项目`combat.wild.species.qilin`当前为鹿形长躯、细密鳞甲、分枝长角与舒展牛尾，步态稳健。本稿以青绿墨面形成头颈、肩背、长躯和四肢，金赭强调角鬃与部分鳞缘，用一前蹄抬起、三足落稳的缓步姿态表现温和而有精神的瑞兽；不修改物种文案、数值、技能或玩法。
- [《尔雅·释兽》](https://www.gutenberg.org/cache/epub/51620/pg51620-images.html)记“麐，麕身，牛尾，一角”；[《说文解字》鹿部](https://zh.wikisource.org/wiki/說文解字/10#鹿部)有仁兽、鹿类身体和牛尾的描述；[《礼记·礼运》](https://ctext.org/liji/li-yun/zh)将麟列为四灵。此稿取鹿身、牛尾和温润瑞兽的形神意象，不将仁兽解释追加成游戏能力。原典的一角与项目分枝长角分开处理，本稿采用双分枝角，不宣称古籍规定了双角或精确复原唯一外貌。
- 固定男女墨像只提供宽笔、浓淡、干湿飞白与留白的尺度。旧麒麟灰白毛兽、分枝角与长鬃仅作前后对照，不作为生成输入；其他已采用灵兽不作形态模板。
- 使用内置image_gen一次全新生成、一次针对最高角尖的画布修正，未用CLI、程序化改色、补画或抠图。v1输入依次为项目根目录下`output/imagegen/zhuyan-cinnabar-redesign/pixel-reference.png`、`.agents/skills/daoyou-ink-portraits/references/male-baseline.webp`和同目录`female-baseline.webp`；v2唯一输入为本地v1。
- v1原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-75929904-37bb-4c7f-a020-17944b327b82.png`；项目副本`output/imagegen/qilin-jade-gold-redesign/qilin-jade-gold-v1.png`。
- v2原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-a5ccad62-c1a8-4f4b-b6b6-555ea6894bc1.png`；项目选稿`output/imagegen/qilin-jade-gold-redesign/qilin-jade-gold-v2.png`。两轮默认目录原稿均保留，项目副本与原稿一致。
- 正式素材为`apps/web/public/assets/icons/beast-qilin.webp`，沿用`icon:beast-qilin`注册。从1254×1254选稿按alpha≥4边界`(225,35)—(1180,1210)`裁掉透明外边距，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100，30730字节；保留内部负形与半透明笔触。
- 正式文件SHA-256为`f884d089ee173fd27a3ebcce893c7cf86972901e56fd2b2ee3898ab779aae83e`。旧正式图备份为`output/imagegen/qilin-jade-gold-redesign/original-beast-qilin.webp`，SHA-256为`dc86ccafa7b032bf84e154e9b6752498eb14f79244f96b74680f3e8e82e4464b`，覆盖前已核对与旧正式图一致；正式导出统计见同目录`production-export.json`。

## 修框经过与已采用造型

v1青绿鹿形鳞身、双分枝角和四蹄步态成立，但最高角尖触到源画布顶部。1254×1254原稿按alpha≥4统计，顶部8个边缘像素，其他三边为0；裁切边界为`(197,0)—(1236,1240)`。v1保留为修正史，不作为正式素材。

v2只针对取景过满与最高角尖截断，用同一张v1缩小整体构图并恢复角末。青金配色、分枝角、神态、四蹄缓步、丰鬃和单尾继续保留。源图alpha≥4边界为`(225,35)—(1180,1210)`，四条源图边均无alpha≥4像素；角尖、蹄尖和尾簇完整在框内。实际外圈留白未达到编辑提示中的每侧至少10%，以源图边界记录为准，不声称精确实现该数字。

采用图青绿构成头颈、躯干和腿，赭金构成角枝、鬃与鳞缘，鹿类长腿与蹄形可读。四腿可数，一前腿屈起、其余三腿向下承重；双分枝角各接入头顶，单尾从后臀连续接出，未见必须修复的多足、断腿、多尾或框裁。神态清俊温和而有精神，缓步姿态成立。

实际分枝角很长，颈鬃与胸部鬃毛较丰；尾干可读为牛尾，末端为大幅卷曲的长毛簇，与提示的小短毛簇不同。颈侧、后背鳞片较密，以金边逐片表现，脸、蹄和闭合轮廓较细，比固定男女墨像更装饰化、实体化。宽笔与彩墨构形可见，但不能称为短鬃、简鳞或完全疏朗减笔。用户已看稿接受这些实际边界，按v2保留，不按初始提示重绘。

## 验证范围

v2原稿1254×1254 RGBA、alpha范围0—255，透明像素1032140、半透明像素540141。独立源图、256px候选预览及候选阶段内存纸色合成未见明确必须修复的解剖或框裁缺陷、明显脏底；角枝间、腿间及尾与后臀间留白真实透明，无烘焙纸张矩形、棋盘纹或背景景物。

`validation-v1.json`记录首稿角尖触框，`validation-v2.json`的候选状态与`productionPreserved`属于采用前记录；正式接入以`production-export.json`为准。`qilin-jade-gold-v2-preview.webp`仅作候选阶段缩小检查，不替代正式导出统计。

正式WebP的alpha范围0—255，可见边界`(24,0)—(232,256)`，高边占满、宽边居中，源稿SHA-256为`851855e32c6f3deb6759237d14809739fcf15a4f7ee0b00b011a1c11cf568da6`。已核对源稿、正式图与备份路径及hash。

按用户要求，只替换立绘，不打开网页、不启动预览服务器，不做桌面／手机网页验收；网页效果由用户亲自验收。仅核对静态源图与导出图、alpha／边界、路径、SHA-256、两轮提示词和差异。纯素材及记录，未独立运行lint、typecheck、完整生产build或test，未修改同期应用代码、配置和游戏数据。下文两段实际完整提示词分别与`prompt.txt`及`prompt-v2.txt`逐字一致；详见[头像采用记录](../beast-avatar-generation.md)。

## 实际首稿提示词

```text
Use case: stylized-concept
Asset type: 《万界道友》麒麟灵兽写意彩墨头像，单只完整四蹄瑞兽，方形透明底，最终显示24—60px。

参考图的角色：
图1是用户25物种像素板，板中没有直接标注麒麟。只借第二行第二格“英招”的青绿、赭金色彩关系作为本次麒麟配色的启发；不将该格认作麒麟，不复制英招的翅膀、人面或其他解剖结构，不借天禄作麒麟原型，也不复制像素风和卡通比例。
图2男修和图3女修是固定笔墨参考，只取宽笔墨面、浓淡、干湿飞白与留白，不复制人物脸、衣袍、解剖和姿势。旧麒麟与其他已采用灵兽均不是造型模板。

身份依据与形神：
本次麒麟保留项目当前“鹿形长躯，鳞甲细密，分枝长角与牛尾舒展，步态稳健”的身份。古籍《尔雅·释兽》“麐，麕身，牛尾，一角”与《说文解字》“仁兽”的鹿类身体、牛尾和仁兽意象提供形神依据；《礼记·礼运》将麟列为四灵。古籍的一角描述与当前分枝角设计分开处理，本稿按项目保留一对分枝长角，不声称复原古籍唯一外貌。青金配色是本次美术选择，不是古籍固定颜色，不添加游戏能力。
修长而有力量的鹿形躯干，颈肩温润挺拔，腰背平稳舒展，四条长度合理的鹿类腿，恰好四只坚实的分趾蹄，蹄趾以少量概括笔提示。首形古雅温和：宽而收束的额、自然前探的短鹿类鼻吻，闭口，鹿耳从额角后侧生出，眼以小片深墨提示清醒安定；头颊保留少量麟兽体面变化，不做普通鹿照片，不画狮虎厚脸、犬嘴、尖牙或人类表情。
额顶两支赭金分枝长角向上后方舒展，枝形疏朗，每支只有几处分叉，两个根部清楚、末端完整。角须有识别分量但不画成整片树丛或大扇形角冠，不让角占据绝大部分画幅。颈后到肩背少量短赭金鬃以顺势宽笔概括，鬃收在身体轮廓内，不堆成狮子长胸鬃或火焰飘带。
必须保留鳞甲生灵身份：青绿颈侧、肩背和胁部有成组细小鳞形短弧笔，疏密随体面方向变化，与宽墨面自然融合。不是毛茸茸鹿身、豹斑白毛兽或穿鳞片盔甲的马。鳞细密的印象由少量成组笔势表达，不能逐枚铺满均匀描边鳞片。

行为与构图：
完整全身，稍侧转的三分之四侧面，麟首在画面左前方，身躯沿中央向右后方舒展；头轻轻转向观看者，颈略俯，目光平和有警觉，像在仍有生机的山岭间稳稳缓行。神韵是温润、宽和、步态有分寸，不用怒吼、昂首奔腾、腾空或威吓尖牙体现强大。
三足承重，一只近侧前腿自然屈起、前蹄收在胸前下方，另一前蹄落稳；两条后腿前后错开承重，各自清楚连接后臀。恰好四条腿四蹄，肢体长度符合鹿类关节，腿根与腹部关系清楚，不出现第五足、长鹰爪或粗兽掌。腿间保留透明负形，不将蹄藏成缺腿。
恰好一条牛尾从后臀自然生出：尾干细长、连续、较光洁，向右后方轻弧，末端一小簇较深青绿与赭金短毛，末端完整；牛尾干与毛簇区别明确，不是整条蓬松马尾、狮尾大火簇、蛇尾、多个尾巴或从腿根长出的尾。
麟首、分枝双角、四蹄与单条牛尾全部完整在框内。全身紧凑可读，躯干有足够体量，角枝和腿不要伸得过长以至缩小后身体过小。画在方形中央，四周保留约8%的透明生成安全空间，不裁切角尖、尾簇和蹄端。没有翅膀，没有额外装饰。

固定笔墨语言：
为《万界道友》制作一幅「写意墨像」：像古籍中的生灵墨画，介于主体剪影与中国写意画之间。墨迹本身构成形体，几块宽笔墨面与少量长线概括结构，少量浓墨作支点，中淡墨、飞白与留白共同补全身形。笔触有干湿与行进方向，轮廓局部断开，末端散入留白。以符合主体解剖的少量识别笔触提示朝向和神态，躯体以墨面概括，不精描材质或渲染写实光照。气韵来自疏朗、重心和虚实。参照固定男女墨像的笔触尺度和材质概括，不变成写实瑞兽再叠水墨纹理。
大墨面沿颈肩、背腹、臀与腿的承重方向组织体量，少量深墨压住额鼻、肩背及落稳蹄底，中淡墨和自然飞白分出腹线、颈胸与腿间关系。以有方向的长短笔组织鳞甲、短鬃和角枝，不刻写实肌肉、细密毛发、每枚鳞片或金属高光。头面只保留身份与神态所需的少量支点，不精修亮眼反光。

彩墨直接构形：
青碧、石绿、低饱和玉青直接构成头颈、肩背、长躯和四肢的主要体面，深青绿墨落在背脊、近肩与落稳腿，浅青绿洗染和真实飞白打开腹侧转折。先读到青绿麟躯，不能退成灰白毛兽上几片绿鳞或外缘绿光。
赭金、暖土黄直接构成分枝双角、少量短颈鬃和单尾末端小簇，淡赭米灰连接下颈、腹线与部分蹄端，绿与赭自然洇接。温润来自彩墨的干湿浓淡和稳定身姿，不画玉石材质、金属铠甲、发光鳞片、红色火鬃、彩虹轮廓、光环或粒子。彩墨承担形体，墨层和留白仍然清楚。

交付：
单个完整麒麟，真正透明RGBA，只有生灵自身墨迹。外部、角枝间、腿间、尾与后臀间及断笔留白真实透底；无纸张矩形、纸纹、棋盘格、山石、草地、背景影、祥云、光环、文字、印章、边框、水印或设计板。缩小后先读青绿鹿形鳞身、赭金分枝角与四蹄步态，更大尺寸读牛尾和温润神态。
```

## 实际v2修框提示词

```text
Use case: precise-object-edit
Edit the supplied Qilin / 麒麟 illustration ONLY to correct the clipped highest antler tip and overly tight canvas. This is a framing repair, not a new concept.

Preserve the entire existing character and relative internal proportions: jade-green scaled deer-like body, ochre-gold branching paired antlers and mane, warm pale throat and belly, gentle alert face looking toward the left, long deer legs, exactly FOUR split hooves, one front leg lifted and three legs bearing weight, and exactly ONE continuous cow-like tail with the existing gold/green terminal tuft curving to the right. Preserve the actual green/gold placement, scale motifs, body pose, brushwork and facial expression. No added wings or limbs, no new horns or tails, no recoloring or change of animal identity. Do not simplify or redesign the mane or tail.

The highest antler branch touches the TOP canvas edge and is truncated. Move/reframe the WHOLE Qilin smaller within a square TRANSPARENT canvas, with a clear outer transparent margin of at least 10% on ALL FOUR sides. Restore the missing highest antler-tip as a natural tapered ochre-gold dry-brush end, keeping the existing branching character. All antler branches must visibly terminate well BEFORE the frame. Keep ears, face, four hooves, full tail shaft and tail tuft complete and inside the frame. Preserve body proportions and character presence; shrink the entire creature together, not only the antlers. Do not erase branch tips or fake completion by fading into the edge.

Maintain the original Chinese freehand color-ink painting, broad dry/wet strokes and broken ink edges. True RGBA transparency around the creature AND inside existing open spaces. Only the Qilin's own strokes; no paper rectangle, background texture, checkerboard pattern, scenery, grass, floor, shadow patch, clouds, halo, text, seal, watermark or border. Deliver one complete Qilin with the highest antler tip restored and generous transparent room around the entire silhouette.
```

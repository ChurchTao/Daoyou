# 金乌黑墨金红头像

采用日期：2026-10-05。用户确认完整翼尖的v2稿并要求替换进游戏。

## 采用依据与素材

- 从用户像素参考第4排第4格金乌提取紧凑黑乌、暖金肩翼和红橙羽端；日精意象转译为金红彩墨与向上腾起的笔势。
- 乌形、三足与日之精依据[故宫博物院《三足乌》](https://www.dpm.org.cn/lemmas/243317.html)及其所引《论衡·说日》“日中有三足乌”。《淮南子·精神训》的“踆乌”由高诱注解释为三足乌，不将注释记成正文。具体金红羽色与姿态属于本次美术选择，不宣称古籍规定这些颜色。
- 内置image_gen全新生成后针对缺失翼尖编辑一次；固定男女墨像仅用于宽笔、干湿、飞白与留白参考。旧金乌只作前后对照，未作为生成输入。
- 首稿原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-74c9e2b3-e385-485c-92e6-7a4cd695416f.png`；项目副本`output/imagegen/golden-crow-solar-redesign/golden-crow-solar-v1.png`。首稿最上方朱红翼尖截断，未采用为正式素材。
- 编辑原出处：`/Users/churcht/.codex/generated_images/01a10b03-ffb0-7b20-be3a-33aeaa94b738/exec-811ef8a9-fedc-4d96-a88a-b7cf8e64e8d7.png`；项目选稿`output/imagegen/golden-crow-solar-redesign/golden-crow-solar-v2.png`。v2只以v1为输入，修复翼尖及画布空间，保留现有乌身、三足、配色与姿态。
- 正式素材为`apps/web/public/assets/icons/beast-golden-crow.webp`，沿用`icon:beast-golden-crow`注册。按alpha≥4边界`(88,52)—(1182,1224)`裁掉透明外边距，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100，30302字节；保留内部留白与半透明笔触，没有程序化补画或改色，也未修改物种描述、数值或技能。正式统计见`output/imagegen/golden-crow-solar-redesign/production-export.json`。

## 已采用造型与实际边界

黑墨胸身、赭金肩翼与朱红外翼形成明确色形，不对称双翼表现向上腾起，短扇尾和恰好三条分离的腿足保留，最高朱红翼尖完整。原稿1254×1254 RGBA、alpha范围0—255，可见裁切边界`(88,52)—(1182,1224)`；四条画布边均无alpha≥4像素，内部负形与半透明笔触保留。

相对固定男女参考，胸腹浓墨更满、内部留白较少，羽层、眼圈和喙部细节仍更精细，喙端也有一定下弯。用户看稿后已接受这一浓重彩墨造型，不将提示中的疏朗减笔与稍直乌喙视作全部实现。24—30px下三足细节较弱，48px及以上更容易分辨；深底上黑胸身较收敛，金红翼廓仍可辨。

## 验证

正式WebP的alpha范围0—255，可见边界`(8,0)—(247,256)`。候选阶段已检查纸色与深底24/30/48/60/72px预览及与固定男女墨像并排的效果，未见烘焙纸底或棋盘底；统计与对照截图为`output/imagegen/golden-crow-solar-redesign/validation-v2.json`、`review-paper-dark.png`。

正式接入后复用已有localhost5174开发服务，图鉴渡劫筛选下桌面30px列表／60px详情、390×844手机24px列表／48px详情均正确加载，两张图片的`src`均为`/assets/icons/beast-golden-crow.webp`、`complete=true`、natural尺寸256×256。金红翼势可读，未见意外裁断；24px下三足细节较弱的原稿边界保留。控制台error/warn均为空。截图为`output/imagegen/golden-crow-solar-redesign/game-desktop.png`与`game-mobile.png`。

执行Node/Sharp透明统计与正式导出、Codex浏览器检查、`git diff --check`，并核对下文两次实际提示词与`output/imagegen/golden-crow-solar-redesign/prompt.txt`、`prompt-v2.txt`逐字一致。复用既有服务，未另启动dev；纯素材及文档改动，未另跑lint、typecheck、完整生产build和test，未改游戏数据。详见[头像采用记录](../beast-avatar-generation.md)。

## 实际首次生成提示词

```text
Use case: stylized-concept
Asset type: 《万界道友》灵兽图鉴透明头像候选；全新重新设计金乌，供用户逐只看稿。
Input images: 图1是25种神兽像素参考，仅借用第4排第4格“金乌”的黑色乌身、暖金肩翼与红橙羽端色形启发，不复制像素风、Q版比例、太阳圆盘或其他物种；图2男修、图3女修只是项目固定的笔墨参考，借用宽笔、干湿、飞白和虚实，不复制人物身体、衣服、脸和姿势，也不是要编辑的对象。
Subject and basis: 一只三足金乌，保持真正乌鸦的紧凑胸身、厚实且稍直的乌喙、小而清醒的乌头、短扇状尾。传说中的三足乌是日之精，具体金红色墨来自本次像素参考启发，不把它设计成鹰、鹤或凤凰。
Behavior and composition: 单只全身，三分之四侧向左前方，正在向上腾起，身躯斜向上，近侧翼向右上方舒展，远侧翼较低向左后展开，形成有轻重和方向的非对称走势。头颈短而收束，喙向前，眼神锐利专注，气势炽烈坚定；不拟人、不靠怒脸。三条腿从腹部自然连接，呈三叉分开的布局，三只足各有清楚的腿、踝和爪形，留足负形空间：近侧足向左下，中央足向正下，远侧足向右下，缩小仍能数出恰好三只足。不能画第四足，不得合并两足。不要站在任何物体上。翼、短尾和三足均完整在框内，形成紧凑但自然的方形头像轮廓，留少量生成安全空白供后续裁切。
Style/medium: 为《万界道友》制作一幅「写意墨像」：像古籍中的生灵墨画，介于主体剪影与中国写意画之间。墨迹本身构成形体，几块宽笔墨面与少量长线概括结构，少量浓墨作支点，中淡墨、飞白与留白共同补全身形。笔触有干湿与行进方向，轮廓局部断开，末端散入留白。以符合乌鸟解剖的少量识别笔触提示朝向和神态。躯体与翼羽均以墨面概括，不逐根描羽、不精描材质或渲染写实光照。气韵来自疏朗、重心和虚实，而不是飘带或光效。参照给定墨像的笔墨语言，不复制其具体身份、解剖和姿势。
Color palette and brush structure: 暖墨黑与深褐色构成乌头、胸腹和翼根的主要体量；赭金彩墨以宽笔直接构成肩背及翼部的几块羽面，不是黑白鸟身外面几条纤细金线。朱砂红和焦橙在外侧几笔羽端与短尾聚集，金红与黑墨湿接、渗化和飞白相互交融，像墨与矿物色在同一笔势中写出。色彩有分量，能在小尺寸读到黑乌金红的身份。整体保留中墨与透明留白，不全身堵黑，不画大片白色羽毛，仅少量露底飞白。金色是赭金颜料的墨面，不是金属反射、不发光。三足用赭褐与较深墨笔概括，结构简洁清楚。
Scene/backdrop and constraints: 真实透明背景，只有金乌墨迹，内部负形也应透明。不要背景太阳、日轮、光环、粒子、火焰包裹、烟雾、地面、树枝、纸张矩形、棋盘格、文字、印章、水印。不要凤凰长冠和长尾，不要装甲、珠宝、装饰纹章或鹰的强弯钩喙。避免均匀封闭描边、矢量标志、徽章对称构图、光滑渐变、摄影写实羽毛、卡通像素描摹。保持完整主体、准确三足、彩墨直接构形，目标24/30px列表与48/60px详情下首先认出乌头、金红展开的双翼和三足。
```

## 实际构图修正提示词

```text
Use case: precise-object-edit.
Edit target: attached golden-crow-solar-v1.png, the existing transparent Chinese colored-ink painting of one three-legged golden crow.
Make ONE targeted composition repair: the uppermost red-orange primary feather at the top of the raised right-side wing is cut off by the current canvas. Preserve this selected drawing and create breathing room on all four sides within a square transparent canvas, proportionally reducing and repositioning the whole bird if needed. Reconstruct only the missing tip of that single highest wing feather in the same red-orange dry-brush ink style so it ends in a complete tapered feather brushstroke. Its tip must be fully visible, with clear transparent space above it. Do not use a flat crop edge. Keep about 6% transparent safety space between every outer feather/foot/bill and the canvas boundaries.
Invariants: keep the black crow-shaped head and slightly straight crow bill, orange eye, body proportions, asymmetric wing pose, ocher-gold shoulder/wing masses, cinnabar-orange feather ends, compact fan tail, exact THREE separate legs and feet with their current connections and negative spaces. Preserve all interior transparent holes and semi-transparent ink strokes. Keep the original broad ink brush texture, dry and wet variation and original palette. Do not redraw the anatomy or redesign the feathers. Do not add or remove legs, toes, wings, crown, decorative motifs or any props. The only invented detail may be the missing feather tip.
Deliver a single complete whole bird on a genuinely transparent RGBA background. No paper, checkerboard, ground, sun disc, halo, glow, particles, text, stamp, watermark or border. This is a composition/canvas repair, not a new species design.
```

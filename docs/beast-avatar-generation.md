# 灵兽头像生成记录

美术设计统一遵循 [写意墨像](../.agents/skills/daoyou-ink-portraits/SKILL.md)，导出与接入遵循其 [素材交付要求](../.agents/skills/daoyou-ink-portraits/references/beast-avatar-delivery.md)。本文件仅记录当前采用的写意墨像素材。

## 补齐剩余五种（2026-10-05）

烛尾狐、钢背猪、精灵狼、双尾蝎、抱月熊已完成彩墨重设计并接入游戏与官网。当前34种全部有专属透明头像及官网高清立绘；本文件后文的29种／5种emoji盘点为此前时点。采用稿、修正与验证见[五种立绘记录](art/remaining-five-avatars.md)。

## 青鸾替换琥珀蝉（2026-10-05）

青鸾使用独立的双足凤鸟墨像，256×256 透明 WebP；替换原蝉的素材及注册。采用提示词、固定参考、尾羽构图修正和导出信息见[青鸾采用记录](art/qingluan-avatar.md)，配置与页面验收见[再设计记录](combat-v6-beast-rebalance-design.md#7-实施与验收结果)。

## 补齐狰、蛇颈玄龟、三足金蟾（2026-09-18）

用户授权为这三种使用 emoji 的物种生成并接入立绘，其他物种延后。使用内置 imagegen；固定男修、女修墨像仅作为笔墨参考，路径为 `.agents/skills/daoyou-ink-portraits/references/male-baseline.webp` 与 `female-baseline.webp`。不使用已选灵兽稿作为其他物种的造型模板。

从原稿以 alpha ≥ 4/255 定位墨迹边界，保留原始半透明像素，裁掉透明外边距后等比缩放、居中导出 256×256 WebP（Lanczos、质量 90）。检查纸色与深底，以及 24/30px 列表和 48/72px 详情尺寸。仅修改物种 icon 与统一图标注册，不改物种 ID、数值、技能或个体数据。

### 狰

采用原稿 `exec-7845df59-a75b-43cd-8443-699ba3506b45.png`，有效图幅 250×256，素材 `apps/web/public/assets/icons/beast-zheng.webp`，注册 `icon:beast-zheng`。

首稿仅有四条可辨尾巴，未采用；经局部修正补足五条独立尾巴后导出。

生成提示词：

```text
Use case: stylized-concept. 为中国修仙游戏万界道友生成一张全新「狰」生灵写意墨像头像，单个主体，方形画布，真正RGBA透明背景。附带男女修士图仅作为笔墨参考，不复制人物造型。
身份与构图：健壮山豹形的狰，赤褐短毛，额头一枚后弯黑角，恰好五条长尾。全身三分之二侧视，身体转弯、头向左回顾，闭口警觉，四足有可信连接与重心。五尾都从臀后同一尾根区域自然分出，向上和右方错落扇展，恰好五个清楚分离的尾尖，尾间留负形，不是九尾狐，不是五条漂浮墨带。紧凑构图，头、躯干、黑角与五尾均可辨，不以尾部挤小豹身。豹类短圆耳、猫科短吻、强健肩背，不是狼或龙，不加鬃毛；少量疏落墨斑即可，不画密集花纹。
笔墨：古籍中国写意生灵画，墨迹本身构成形体。与参考一样，以少量方向明确的暖灰宽笔墨面、浓墨支点、干湿飞白与透明留白完成身体；不依靠均匀封闭描边，不逐根画毛、不刻肌肉、不渲染写实体积光。轮廓局部断开但主要解剖清楚。赤褐只局部渗入肩背与尾部灰墨，墨色主导；黑角凝练。神态来自头部朝向，不刻画精细虹膜和拟人怒眉。无发光、火焰、粒子、烟雾。
交付：主体居中，所有角、足、五尾离画布边有至少10%透明安全空间，不能截断。只有动物自身笔迹，真实透明alpha，包括尾间负形；无纸张矩形或纹理、棋盘格、背景、地面、文字、印章、水印。用于256px导出及24/30px列表、48/72px详情，优先轮廓辨识。
```

修正提示词：

```text
精准修改第一张狰墨像：当前只有四条可辨长尾，必须补足为恰好五条。保留猫科躯体、四足、回首姿态、黑角、赤褐灰墨和宽笔飞白。将现有四条尾巴稍微收窄，在最下方尾巴与后腿之间的空白新增第五条独立长尾，从同一臀后尾根自然连接，向右下弯曲，尾尖与现有最下尾明显分开；五条尾巴都有各自清楚尾尖及透明负形间隔。不要加第五条腿，不要把尾毛分叉冒充第五条尾巴。尾巴是短毛猫科长尾，避免继续增加蓬松程度。全体缩入方形画布内，四周透明安全边距至少8%，不截断任何足尖角尖尾尖。保持真实alpha透明，尾间背景透明，无纸底，无文字，无光效。第2、3张仅为固定笔墨参考。
```

### 蛇颈玄龟

采用原稿 `exec-718b80ba-2725-4127-8ea4-de5527cfed6a.png`，有效图幅 256×241，素材 `apps/web/public/assets/icons/beast-snake-neck-turtle.webp`，注册 `icon:beast-snake-neck-turtle`。

生成提示词：

```text
Use case: stylized-concept. 为万界道友生成全新「蛇颈玄龟」写意墨像头像，正方形，单只完整生灵，真实RGBA透明底。附带两张男女修士仅为固定笔墨风格参考，不复制人形。
物种：黑青厚甲低伏宽展，甲缝少量水苔，甲下藏蛇一般的长颈。沉居深潭，探颈观察；是真正的长颈龟，非龟蛇双兽、非龙龟。构图采用略俯视三分之二侧面，宽展椭圆低拱甲占右下主体，四只短壮爬行足从甲下自然探出，长颈自前方甲口伸出，向左上弯成疏朗S形，头略回顾，闭口安静警觉。颈长清晰可见，有连贯结构和粗细变化，龟类小头、钝吻，不加蛇信、獠牙、龙角。尾短而含蓄。全身紧凑，甲、颈和头之间的负形明确，长颈与宽甲是第一识别特征。
笔墨：古籍中国写意生灵墨像，墨迹本身构成形体。像参考般用几块有方向的暖灰宽笔、淡墨与少量浓墨支点概括，飞白沿甲弧与颈弯方向露底；轮廓局部断开，由留白补全。甲只用几块大墨面和三五条断续甲缝，不逐片描龟甲，不刻鳞片，不表现石头山峰或金属甲胄，不用写实体积光。长颈以连贯宽笔组织，头眼少数墨点，无精细虹膜，无拟人表情。黑青局部渗入灰墨，甲缝几笔低饱和苔绿，不画苔藓景观、植物枝叶或水浪。
交付：所有头、颈、足、甲缘、尾尖都完整，主体居中四周留至少10%透明安全边距，后续裁透明外边距导出256px。只有生灵自身墨迹，真正alpha透明含肢间负形，无纸张纹理或白底板，无棋盘格，无地面、场景、水纹、光晕、烟雾、文字、印章、水印。24/30px列表及48/72px详情应清楚识别长颈和宽甲。
```

### 三足金蟾

采用原稿 `exec-289fb494-6962-43ca-ab31-eea694f01819.png`，有效图幅 256×198，素材 `apps/web/public/assets/icons/beast-three-legged-golden-toad.webp`，注册 `icon:beast-golden-toad`。

生成提示词：

```text
Use case: stylized-concept. 为万界道友绘制全新「三足金蟾」写意墨像头像，方形画布，单个完整活体蟾蜍，真实RGBA透明背景。两张男女修士只是固定笔墨参考，不复制人物。
物种事实：身躯浑圆，恰好三足粗壮，暗金背疣间透朱红细纹；腹内火囊蓄纳地火灵息。采用安静蓄息状态，喉腹微鼓、闭口，不喷火。不是招财金属摆件，无钱币、元宝、底座。
构图：稍俯视的三分之二侧前方全身蹲姿，头向左前，宽钝吻、低伏眼眶，胸腹浑圆有重量。两只前足分别支撑左右前方，第三足是唯一一只粗壮后足，从身躯后部偏中央向画面右后方折出，以可见的腿部连接和清楚分开的足掌交代三足解剖。总计恰好三条腿、三个足掌；没有第四足，没有尾巴，不把后足画成残肢。取景让第三足与圆腹之间有明确透明负形。保持蟾蜍短粗敦实，不是细腿青蛙或蜥蜴，姿态自然，不拟人微笑。
笔墨：古籍中国写意生灵画，墨迹本身构形。用少量宽笔暖灰墨面概括头背、腹部与三足，浓墨仅在眼、背转折、关节作支点，中淡墨与透明留白补全体量；飞白沿笔势露底，轮廓局部断开。背疣用少数疏落墨点表现，绝不逐粒刻画真实疙瘩，不画精细皮肤纹理、光滑厚涂体积、金属高光。眼为简单墨点与小留白，不精绘虹膜。肩背局部淡赭暗金彩墨融入灰墨，背疣间只留少量低饱和朱红短纹，像暗炭而不发光。腹以淡暖灰墨与留白表达，无金属黄色全身涂色，无光效和烟雾。
主体完整居中，头背、三个足掌都留至少10%透明安全边距。真实alpha透明包括肢间与笔间负形，无白纸矩形或纸纹，无棋盘格，无背景、地面、山石、火焰、文字、印章或水印。最终256px头像，24/30px列表读到浑圆蟾体，48/72px详情读到三足和暗金朱红。
```


## 统一头像占幅（2026-09-18）

八种灵兽均从下文采用的高分辨率原稿重新导出：以 alpha ≥ 4/255 定位有效墨迹边界，裁掉外围透明空白，保留裁切范围内的原始半透明像素，等比缩放到最长边 256px，并在 256×256 透明画布内居中。WebP 质量 90。生成提示中的安全边距仅防止生成时截断轮廓，不保留到最终游戏头像。

| 物种 | 缩放后图幅（画布均为 256×256） |
| --- | --- |
| 墨蛟 | 256×254 |
| 火鸦 | 256×239 |
| 琉璃鹤 | 246×256 |
| 无影貂 | 256×251 |
| 银翅螳螂 | 248×256 |
| 六目灵猿 | 256×239 |
| 冥灯蝶 | 254×256 |
| 雷鹏 | 251×256 |

导出后以 alpha ≥ 8/255 检查可见边界，八张图片的最长可见边均为 254–256px。图片占幅统一由素材承担，现有图标注册、组件尺寸和 `object-contain` 保持不变。

## 墨蛟（2026-09-18）

用户选定新水墨首稿并授权接入，采用 `exec-50cc0113-6630-4ebb-a32f-1fbfdb7b7b41.png`。首稿由内置 imagegen 生成，仅以 `.agents/skills/daoyou-ink-portraits/references/male-baseline.webp` 和 `female-baseline.webp` 为笔墨参考。

构思为盘身蓄势、低首侧顾的暗河墨蛟；暖灰宽笔、浓淡墨面与飞白构形，颈侧和尾鳍少量灰青彩墨。按用户选稿保留角、颈须、姿态和笔触，不再修改造型。生成提示的核心为：

```text
墨迹本身构成形体，几块暖灰宽笔墨面与少量长线概括躯体，少量浓墨作结构支点，中淡墨、飞白与留白补全形体；不逐片勾鳞，不用写实体积光。盘身蓄势、低首侧顾，闭口警觉，头与前颈为主视觉；以角、狭长吻部、颈须和尾鳍表现暗河蛟类。仅在颈侧和尾鳍融入少量低饱和灰青彩墨。独立真实透明底，无背景、光效、文字、印章。人物基准只作笔墨参考，不复制人物造型。
```

原图 1254×1254，经统一占幅处理后导出 256×256 透明 WebP。素材为 `apps/web/public/assets/icons/beast-ink-jiao.webp`，沿用 `icon:beast-ink-jiao` 注册，不修改 UI、物种或个体数据。

## 火鸦（2026-09-18）

依据当前物种设定“黑羽赤喉、翼下暗红火羽”，以头胸半身和微张的近侧翼表现机敏回望。暖灰墨面概括黑羽，喉部和翼下局部暗朱砂、赭红彩墨。使用内置 imagegen 生成，固定男修、女修墨像仅作笔墨参考，未输入旧头像。

采用 `exec-a9304db7-ece4-4029-abd1-b6c7e640fcb9.png`，导出 256×256 透明 WebP（Lanczos、质量 90），替换 `apps/web/public/assets/icons/beast-fire-crow.webp`，沿用 `icon:beast-fire-crow` 注册。

生成提示词：

```text
+Use case: stylized-concept.
为《万界道友》生成一个全新火鸦头像立绘，方形画布，真正透明alpha底。所附男女修士图只作为固定笔墨风格参考，借鉴墨面尺度、暖灰浓淡、干湿飞白，不复制人物形体、衣服和姿势。不要参考任何旧版火鸦头像。

物种事实：火鸦，黑羽赤喉，翼下藏有暗红火羽，振翅时散出火星；常衔焦枝，在地火裂隙旁筑巢。收翼近似普通山鸦，不是凤凰或猛禽。此次画静止动作，不画火星、焦枝或栖息环境。

全新造型：紧凑的头、胸和翼根半身头像，身体略朝左，脖颈自然转向右侧观察，露出明确的鸦首侧面；黑色直而略厚的鸦喙，喙尖微弯但绝不是鹰钩喙，圆而低的头顶，没有冠羽或夸张尖发。一个小而机敏的黑眼，以小留白提示眼神，不发光，不拟人皱眉。近侧翼轻轻离身半张，露出一小片翼下暗红羽，远侧翼收拢。头部足够大，圆润胸腹与略抬的翼组成不对称紧凑轮廓，下侧墨笔自然收束淡出；不画脚、尾巴、枝条。头、喙、翼缘都完整在框内，四周8%透明空白，主体约占画幅84%。要有真正山鸦的机敏活气，形体朴素。

绘画语言：像古籍中的生灵写意墨画，介于生灵剪影与中国写意花鸟之间。墨迹本身构成形体，几块暖灰宽笔墨面、少量长线概括胸颈与羽翼。少量浓墨在头顶、喙、翼背建立结构支点，中淡墨、飞白与透明留白共同补全身形。黑羽用有浓淡区别的墨笔表达，不能涂成一整团实黑；亮部是笔间留白与淡墨，不是白羽毛。羽翼以三五组方向明确的宽笔概括，不逐片刻画羽毛，不画羽枝细纹，不堆鳞片状层叠纹样。轮廓局部断开，干笔与湿墨自然相接。与输入男女墨像属于同一笔墨系列，绝非写实乌鸦加水墨滤镜，非摄影、非3D、非半立体数码游戏插画，无体积高光，无光滑材质渲染。

用色：绝大部分暖灰与墨黑，喉部一小块低饱和暗朱砂彩墨，近侧翼下少量暗赭红墨，色墨自然渗接。赤色是固有羽色，不是火焰或发光，避免鲜红、橘黄火焰、蓝紫反光，不上全身彩色。

交付：只有一只鸟的墨笔，真实RGBA透明背景，胸腹笔间留白和外围空白可以透出UI底色，无白纸底、纸张纹理矩形、棋盘纹、场景、烟雾、光环、地面阴影、文字、印章、水印或框。不要整体降低透明度；墨色浓淡由每笔自身表达。最终用于256px透明WebP，列表30px和详情72px仍能认出鸦喙、头形、赤喉。
```

## 琉璃鹤（2026-09-18）

依据当前物种设定重新设计：长颈轻曲、俯首、单翼舒展，暖灰淡墨与留白表现近白羽毛，翼面局部青碧与淡金彩墨提示玉质通透感。使用内置 imagegen，固定男修、女修墨像只作笔墨参考。保留活体羽毛的柔软结构，不使用玻璃折射或发光效果。

采用 `exec-2e3ac479-008b-40aa-8f62-6451aaca25fc.png`，导出 256×256 透明 WebP（Lanczos、质量 90），替换 `apps/web/public/assets/icons/beast-snow-crane.webp`。沿用 `icon:beast-snow-crane` 注册，不改物种 ID 和玩法。

生成提示词：

```text
Use case: stylized-concept.
为中国修仙游戏《万界道友》绘制一张全新「琉璃鹤」写意墨像头像，正方形，真实透明alpha背景。两张男女修士图仅为笔墨参考：沿用宽笔、暖灰浓淡、干湿飞白与留白，不复制人形、衣服、姿势。不要参考旧版鹤头像。

物种事实：琉璃鹤，身形修长清瘦，喙足淡青，羽毛有半透明玉质光泽；背光近雪白，迎光展翼透出青碧淡金，常静立高山灵池。它仍是活的鹤，具有柔软羽毛，并非玻璃雕像、水晶鸟或金属雕塑。

全新动作和取景：头像采用头颈、胸肩与一只半展翼构成的紧凑半身像。躯体在画面下部，优雅长颈向上形成简洁柔缓的弧线，头略向左低垂，长而笔直的细喙斜向左下，目光安静专注，好像正在观察水面但画中不画水。近侧翼向右上舒展一半，翼面形成宽阔有节制的斜向墨面，与长颈间留出清晰负形。另一翼自然贴身。头部不能过小，颈、头、直喙连接符合鹤类解剖；不用天鹅粗颈，不加凤凰冠羽或丹顶鹤红顶。黑眼只是一小笔，不画宝石眼。下部胸羽自然散入透明留白，不画长腿或尾巴；关键轮廓全部在框内，周围约8%透明安全空间，单翼不要伸成横幅。

笔墨语言：古籍中的生灵写意墨画，介于生灵剪影与中国写意花鸟之间。墨迹本身构成形体，以几块暖灰宽笔淡墨与少量长线概括头颈和翅膀，少量较浓墨在眼、喙根、颈侧和翼根形成结构支点，中淡墨、干笔飞白与透明留白补全形体。让鹤看起来羽色近白但有明确灰墨结构，不是低透明度的淡淡白鸟，也不靠外描边形成完整白色剪纸。翅膀以少数长而有方向的笔组概括羽束，不逐根精描羽枝，不画密集鳞状羽列。宽笔有干湿变化，轮廓局部断开。必须与输入的两张人物墨像属于同一笔墨系列。

用色：暖灰墨与留白为主体，喙以极淡青灰笔色；只在舒展翼的一小部分渗入低饱和青碧与极少淡赭金彩墨，若隐若现地融入淡墨。琉璃质感通过通透留白和色墨晕染暗示，不画镜面反射、硬玻璃折射、晶体切面、金属金箔、霓虹发光或彩虹渐变。不铺满彩色，不改成彩色水彩插画，浓淡层次以笔墨承担。

交付：一个独立真实透明底鹤头像，只有构成鹤本身的笔迹，无纸张矩形或纸底，无背景、水面、山景、云雾、光环、地面、装饰框、棋盘纹、文字、印章、水印。透过颈与翅间以及笔间空白可以看到UI底色。最终用于256×256透明WebP，30px列表与72px详情仍能辨认弯曲长颈、直喙、舒展翼与局部彩墨。不是照片、3D、精细游戏卡牌或写实鸟加水墨滤镜。
```

构图修正提示词：

```text
仅修正第1张琉璃鹤新稿的构图边距。保留这只鹤的姿态、长直喙、长颈、俯首、单翼舒展、暖灰宽笔飞白、青碧与淡金局部彩墨，保持第2、3张人物基准的同系列笔墨语言。将整个主体在方形画布内缩小到大约82%占比并居中，重新补全目前右侧贴边或被裁切的羽尖，使头、喙、所有翅尖和胸羽外缘四周均有明显透明留白，至少8%安全边距。重点是完整轮廓，不重设计造型，不添加细节或颜色。背景必须真实alpha透明，笔间留白通透，无纸底、棋盘底、烟雾、印章文字或边框。输出一张独立透明底琉璃鹤头像。
```

## 无影貂（2026-09-18）

依据当前物种设定重新设计：深灰细毛、银白腹部、蓬松长尾，以转身回首和轻探前爪表现警觉，尾端淡墨断笔融入透明留白，提示从尾端开始隐身的特点。仅使用暖灰、墨黑与留白。内置 imagegen 生成，固定男修、女修墨像只作笔墨参考，未查看或输入旧头像。

采用 `exec-e340b0cc-0c76-40ec-81ad-d157bafee87b.png`，导出 256×256 透明 WebP（Lanczos、质量 90），替换 `apps/web/public/assets/icons/beast-moon-marten.webp`，沿用 `icon:beast-moon-marten` 注册。

生成提示词：

```text
Use case: stylized-concept.
为修仙游戏《万界道友》绘制全新「无影貂」写意墨像头像，方形画布，真正透明alpha底。所附男修、女修仅作笔墨参考，借鉴暖灰宽笔的肌理、墨面尺度、浓淡与飞白，不复制人物衣服、体态或面孔。不得参考任何旧版灵兽头像。

当前物种设定：无影貂，深灰细毛、银白腹部、蓬松长尾；警觉时从尾端开始隐去身形，疾行转折间偶尔露出一道银白腹影。物种是真正的貂类，细长灵活躯干、小圆耳、狭长而不过尖的吻部，短而灵巧的四肢、蓬松长尾。不是狐狸、猫、狼、松鼠；没有尖三角耳、狐面、猫脸或巨大的萌眼，不增加月亮符号、额纹、角、饰品。

新动作：紧凑完整全身，低伏转身，前半身朝左，肩背微微扭转并回首警觉。头在左上区域，为主视觉，头部适当放大以适应头像但不Q版；眼神机敏而收敛，黑眼一笔加少量留白即可。脊背从头颈向右下自然弯曲，后躯收在身体后方，一只前爪向前轻探，其余肢体在身体下紧凑收拢，四肢解剖正确，不纠缠或重复。躯体侧转露出一条银白胸腹。蓬松长尾从后躯延出，向画面右侧再向下侧形成一个舒展弧形，与身躯保留可读负形，尾不能缠住脖子，不做松鼠竖直问号尾。全图形成不对称、紧凑、有运动趋势的轮廓，不画跃起攻击或龇牙。关键轮廓全部在方形框内，四周至少8%透明空白。

笔墨：像古籍中的生灵墨画，介于动物剪影与中国写意走兽之间。墨迹本身构形，几块宽笔暖灰墨面概括肩背、腰腹和尾，少量浓墨在头部、眼鼻、脊背和爪处形成支点，中淡墨、干笔飞白和透明留白连接身形。毛发用随结构走向的干笔概括，不逐根毛发，不用数码毛绒渲染，不画平滑写实体积高光。银白腹部主要以留白和极淡暖灰墨提示，不涂成实白塑料块。形体有生命感但高度概括，不是写实动物加水墨滤镜，不是3D或精细彩色卡牌。

隐身表现：从尾的远端开始，尾毛笔触自然变淡、变疏，断续散入真正透明留白；近身尾根仍清楚，让人能读出完整长尾的方向。只用画内真实墨笔和透明度的渐变表达，不画烟雾、粒子、速度线、分身、发光轮廓或背景光晕；身体主部保持清楚的正常墨色，不把整只貂统一降透明。

配色：完全根据深灰细毛与银白腹部设定，以暖灰、墨黑与留白为主，无需新增彩色；不加紫色、蓝色或金色光效。笔墨力度与两张角色基准一致，避免实黑一团，保留内部呼吸空间。

交付：单只独立透明底灵兽，只有其自身笔迹，无纸张底色、矩形背景、棋盘纹、地面、树枝、月亮、场景、题字、印章、水印、框。最终导出256×256透明WebP，30px列表、72px详情仍读得出圆耳貂首、银白腹部和蓬松长尾。
```

## 银翅螳螂（2026-09-18）

依据当前设定的银灰甲壳、弯刃前肢和近透明薄翅，采用前半身近景，以三角头、细长前胸和成对捕捉足表现静伏警觉。暖灰宽笔和浓墨支点概括甲壳，薄翅融入极淡青灰；通过留白表现银灰质感。使用内置 imagegen，固定男修、女修墨像仅作笔墨参考，未输入旧头像。

采用 `exec-203c6ca3-1849-45e3-8e58-289aa7a1f9e4.png`，导出 256×256 透明 WebP（Lanczos、质量 90），替换 `apps/web/public/assets/icons/beast-silverwing-mantis.webp`，沿用 `icon:beast-silverwing-mantis` 注册。

生成提示词：

```text
Use case: stylized-concept.
为《万界道友》生成全新「银翅螳螂」写意墨像头像，正方形，真正RGBA透明背景。附带男女修士两图仅作为固定笔墨基准，借鉴宽笔墨面、暖灰浓淡、干湿飞白与留白，不复制人形、服装和姿态。完全重新构思，不参考旧版灵兽头像。

当前物种设定：银翅螳螂，银灰甲壳，前肢如弯刃，薄翅收拢时近乎透明，展开泛银光；常静伏许久，出击时连续挥斩。主体是活体螳螂昆虫，不是机械或穿银甲的人。必须有横宽三角头、两侧复眼、两根细长触角、细长前胸、两只具有折叠关节的镰状捕捉前足、贴背的薄翅；不可画成甲虫、蝗虫、蜘蛛或手持双刀的武士。

取景与动作：昆虫前半身近景，展示头部、前胸、两只捕捉前足和肩后收拢的翅片；后腹与四只行走足不在取景范围内，不强塞全身导致头部太小。身体三分之二侧向画面右侧，头略回转面向观者，复眼内敛而警觉，不拟人皱眉。颈状前胸修长且保持真实昆虫比例。两只捕捉足一收一探，近侧前足略向前试探，远侧前足收在胸前，两个折弯形成清晰分离的负形，足末为细长的胫节折向粗大的股节，内侧只有少量墨齿提示捕捉刺。前足必须从胸部正确连接，绝不画成两把脱离身体的武器。不交叉缠绕，保持动作安静而有蓄势感。贴背的薄翅斜向下后方，自然淡入透明，头、触角、两只镰足和翅缘的关键轮廓全在框内，四周至少8%留白。构图紧凑、不对称，不做正面徽章。

笔墨体系：古籍生灵墨画，墨迹本身构成形体。用几块有方向的暖灰宽笔与少量长线概括三角头、前胸和弯折足，少量浓墨在头缘、关节与足内缘建立结构支点，中淡墨、干笔飞白和透明留白完成躯体。甲壳用笔墨面表达，不逐节画铠甲，不以精细均匀外轮廓线封闭每个部位，不渲染金属材质或光滑数码体积。触角细而简练，其余主体必须有宽笔墨面的量感，不能变成线描科学插图或钢笔画。与人物基准同一笔墨语言，不是写实昆虫加水墨滤镜，不是3D概念设计或高清游戏卡牌。

配色：银灰与暖灰墨、墨黑支点、透白留白为主。翅只用极淡灰墨和一点点低饱和青灰彩墨提示薄翅通透，不画密集翅脉网格；银光通过留白和墨面明暗关系暗示，不画真实镜面、金属高光、激光光刃、发光轮廓或粒子。复眼也是灰墨，避免荧光绿宝石眼。浅色甲壳仍有清楚浓淡结构，不全图淡到难以辨识。

交付：单个独立透明头像，只有昆虫自身笔迹；无纸张底板、烘焙棋盘纹、烟雾、地面、树枝、场景、装饰圆框、文字、印章或水印。笔间留白和前足负形必须真正透明，不通过整体降低opacity模拟水墨。用于256×256透明WebP，列表30px和详情72px下首先能读到三角头和成对镰状前足。
```

构图修正提示词：

```text
对第1张新生成的银翅螳螂仅修正构图安全边距；第2和第3张仍为固定笔墨参考。保持灰墨写意的三角头、两只复眼、两根触角、細长前胸、成对折叠镰足、贴背的青灰淡墨薄翅，保持近景取景、当前角度与姿态。将整体主体缩小并居中，四周预留至少10%清楚的透明空白，尤其两根触角尖、右侧翅缘和底部墨笔都不可贴边或裁断；补全贴边的羽状翅笔边缘，翼末自然散入透明，不新增身体部位或四只步足。主体约占方形画布80%，切勿放大填满。墨色浓淡和细节疏密不变，眼睛保持墨笔质感，不增强玻璃高光。背景必须真正alpha透明，无白纸底、棋盘格、场景、烟雾、文字、印章。输出完整边缘的方形透明头像。
```

## 六目灵猿（2026-09-18）

依据当前灰白长毛和眉侧各两枚灵目的设定，采用近正面略低首的头肩像，双主眼较大、左右眉侧各两枚小灵目，合计六目。以暖灰宽笔与留白概括长毛，眼鼻和肩背浓墨形成支点。使用内置 imagegen，固定男修、女修墨像仅作笔墨参考，未输入旧头像。

采用 `exec-a66d9ec0-d5c1-45f4-954c-75f19a17a7ad.png`，导出 256×256 透明 WebP（Lanczos、质量 90），替换 `apps/web/public/assets/icons/beast-six-eyed-ape.webp`，沿用 `icon:beast-six-eyed-ape` 注册。

生成提示词：

```text
Use case: stylized-concept.
为中国修仙游戏《万界道友》绘制全新「六目灵猿」写意墨像头像，正方形画布，真正RGBA透明底。两张男女修士图仅作为固定笔墨参考，匹配其暖灰宽笔墨面、浓淡干湿、飞白与留白，不复制人物脸、服饰和姿态。不得参考旧版六目灵猿头像。

物种事实：六目灵猿，灰白长毛，普通双目之外，眉侧各生两枚小灵目，合计六只眼睛；攀行古林，遇敌时灵目逐次睁开以观察动作。它是真正的猿类，不是老人、修士、神佛或戴猿面具的人，不加冠饰、首饰、额头符号或衣服。

新设计：近正面紧凑头肩像，略微低首，肩背自然隆起但不耸成肌肉巨兽；脸向正面，轻微倾斜体现生命感，观察者能同时看到左右两侧全部六眼。头与脸是主视觉，灰白长毛从头顶、颊侧沿肩背向下形成几组宽笔，短而宽的猿吻，扁宽鼻、闭口、圆耳部分藏在长毛中，眼神沉稳警觉，有阅历但不凶怒、不咆哮、不拟人皱眉。只画头肩，不加手臂、武器或树枝。

六眼结构是不可错的识别要求：总计恰好6只睁开的眼，左侧3只，右侧3只。两只普通眼位于正常猿眼位置，是最大的一对；每只普通眼上方的外眉侧，各有两枚较小的灵目，沿眉侧向外上方排列，四枚小灵目不跨过鼻梁，不在额头正中央加第七只眼。每枚小灵目都有彼此分开的简练眼睑形状与墨点瞳仁，明确是眼而不是额纹、宝石、墨斑或毛结。左右两侧的眼数必须相等。两只主眼更大，四只辅助眼约为主眼一半大小。少量墨笔即可辨认，不精修成六个写实人眼，不画发光眼。

笔墨风格：古籍中的生灵墨像，介于动物剪影与中国写意走兽画之间。墨迹本身构成形体。用几块宽笔暖灰淡墨和方向明确的干笔概括灰白长毛，少量浓墨在眼鼻、眉骨、颊侧与肩背转折处建立支点，中淡墨与透白留白连接形体。长毛不是逐根毛丝，也不是厚重数码绒毛；用长而有方向的墨笔概括疏密，轮廓局部断开，肩下毛端散入透明。面部用灰墨组织猿类骨相、鼻口与眼区，不渲染皮肤质感、皱纹清单或摄影光照。脸要有结构，不是清晰脸框内一张空白面具。与所附人物基准笔墨一致，不是写实猿猴套水墨滤镜、不像数码概念海报或3D头像。

颜色：依照灰白长毛设定，以暖灰、少量墨黑与留白为主，无需新增彩色。不因化神境界增加金色、红色眼睛、法阵或光环。主体有明确墨色结构，不统一降透明度，不画成一整块黑色头颅。

构图与交付：头顶毛发、圆耳、肩毛全部完整收在方形框内，四周至少10%透明安全边距，紧凑清楚、不要填满贴边。单只灵猿独立真实透明背景，只保留构成角色的墨笔；无纸张矩形、纸底、烘焙棋盘格、场景、地面、云雾、光效、文字、印章或装饰框。最终用于256×256透明WebP，72px详情能看清六目组织，30px列表仍能读到猿首和灰白长毛轮廓。
```

构图修正提示词：

```text
仅修正第1张六目灵猿新稿的画布安全边距，保持角色原本的六只眼、脸部神态、轻微低首角度、灰白长毛、暖灰浓淡宽笔、飞白、留白。第2、3张仍为固定笔墨基准。完整保留恰好6只睁开的眼：2只大主眼，每侧外眉各2枚较小灵目，不添加或移除眼。将整个头肩主体缩小并居中，四周预留至少10%的真实透明空白，让头顶毛尖、左右肩毛及下缘全部在框内，补全右侧贴边的毛笔外缘，不裁切，不填满画幅，不增加手、道具、背景或多余毛束。构图之外不改变造型，不增强毛发细节和眼睛高光。独立真实RGBA透明底，无纸张底板、棋盘纹、文字、印章或光效。
```

## 冥灯蝶（2026-09-18）

依据当前墨蓝双翼、幽绿翅脉与缓慢游飞的设定，采用轻侧转、四瓣蝶翼错落展开的完整姿态。暖灰墨、墨黑与局部靛蓝宽笔组织翅面，少量灰玉绿彩墨翅脉提示微光，不添加背景光效。使用内置 imagegen，固定男修、女修墨像仅作笔墨参考，未输入旧头像。

采用 `exec-f4bde284-a2d1-4cd9-816e-8f69fb909a6e.png`，导出 256×256 透明 WebP（Lanczos、质量 90），替换 `apps/web/public/assets/icons/beast-ghost-lantern-butterfly.webp`，沿用 `icon:beast-lantern-butterfly` 注册。

生成提示词：

```text
Use case: stylized-concept.
为《万界道友》生成全新「冥灯蝶」写意彩墨头像，方形画布，真正透明RGBA背景。两张男女修士仅作笔墨风格参考，沿用其暖灰宽笔、墨面尺度、干湿飞白与留白，不复制人形或衣服。完全从当前物种概念重画，不参考任何旧头像。

物种事实：冥灯蝶，墨蓝双翼，翅脉泛出幽绿微光，在古老地穴缓缓飞行，如一盏游移的幽灯；躯壳死寂后仍能保住本命灵息。是有机活蝶，不是灯笼、幽灵人脸、骷髅或符号徽章。

构思：一只完整蝴蝶缓慢游飞，躯干轴线微微斜向右上，俯视与轻侧视之间，身体细长而有节律，两根纤细触角明确。两对翅共四片可辨：一对较宽的上翅、一对较圆的下翅。近侧翅舒展，远侧翅稍收并略有透视缩短，让四瓣自然错落而非镜像平面标本；四翅均从胸部正确连接，不多翼、不重叠成六瓣。翼缘有轻微自然起伏，绝不画夸张长尾丝、尖刺或凤蝶长飘带。形体紧凑，能读到蝴蝶躯干与翅膀之间的结构，姿态轻缓寂静。

笔墨语言：古籍中的生灵墨像，介于生灵剪影和中国写意花鸟草虫画之间。墨迹本身构形，每片翅由少量有明确行笔方向的宽笔墨面概括；墨面边缘干湿相接，局部飞白与透明留白打断轮廓。少量浓墨在躯干、翅根和局部翼缘作支点，中淡墨与留白保持翅面通透，绝不把翅膀涂成实黑剪纸。少量简练翅脉说明结构，不画密集叶脉网络、鳞粉显微纹理、写实翅膜或均匀封闭描边。躯干用几笔概括，不刻画腹节清单。与给定人物墨像保持同样的笔触疏密和材质概括，不是彩色写实昆虫加水墨滤镜。

色墨：主体仍由暖灰墨和墨黑构形，翅面少量低饱和靛蓝渗入灰墨，形成墨蓝而非鲜蓝。只在部分主要翅脉融入很少的低饱和灰玉绿彩墨，以淡色墨与周边深墨的对比暗示幽绿微光；颜色有墨的干湿和渗化，绝不画霓虹线、发光轮廓、光环、放射光、粒子、烟雾、光束或灯笼道具。色彩只依附蝶身翅面，不漂浮到背景；避免绿光抢走笔墨。无额外金色或红色眼斑，翅面不加眼睛和骷髅纹样。

构图安全要求：留出很宽的完整透明外圈，整只蝴蝶仅占画布中间约75%范围，所有触角尖和四瓣翼缘离每条画布边都至少12%，四周空白明显，不能把翅尖扩展到边缘，不靠裁切来填满。关键结构在缩小后可读，目标为256×256透明WebP，列表30px与详情72px。

输出仅单只蝴蝶自身的墨迹，真实alpha透明底，翅间与笔间留白透出界面底色。没有白纸矩形、纸张底纹、棋盘格、场景、地面、文字、印章、边框或水印。不要整体降opacity，不要3D、金属材质、塑料发光或精细游戏海报。
```

## 雷鹏（2026-09-18）

依据当前苍青巨翼、银色颈羽、深紫翼尖与积蓄雷息的设定，采用敛翼、侧首俯察的头胸近景。宽笔组织肩背和折翼，银羽以暖灰淡墨与留白表现，苍青与深紫局部融入灰墨，以形与笔势体现雷禽威势。使用内置 imagegen，固定男修、女修墨像仅作笔墨参考，未输入旧头像。

采用 `exec-43de3161-38e0-4ea4-b9ec-ad61ff376664.png`，导出 256×256 透明 WebP（Lanczos、质量 90），替换 `apps/web/public/assets/icons/beast-thunder-peng.webp`，沿用 `icon:beast-thunder-peng` 注册。

生成提示词：

```text
Use case: stylized-concept.
为《万界道友》绘制全新「雷鹏」写意彩墨头像，方形画布，真实RGBA透明背景。附带男修、女修墨像只作笔墨参考，匹配其暖灰墨、宽笔墨面、干湿飞白与留白，不复制人物姿态、衣服或面孔。不参考旧雷鹏头像，不使用其他鸟类头像构图作为模板。

当前物种事实：雷鹏，苍青巨翼，颈覆银羽，翼尖深紫，常在云海雷区活动，羽翼能积蓄雷息；是高阶雷禽，不等同鲲鹏，也不是凤凰。以鹰隼类猛禽的可信解剖为基础，有力的钩喙、眼眶骨相、肩背与大翼能表达其身份，不添角、龙鳞、凤凰冠羽、长飘带或人类盔甲。

全新构图与神态：敛翼停息、侧首俯察的头胸近景，略从上方观察。宽厚肩背形成稳重的斜向轮廓，身体近正面略侧向右，头向左下转动，喙微微下压，目光冷静锐利而不夸张愤怒。头部适当放大以用于头像，钩喙完整清楚，嘴闭合。颈部银色长羽由几组宽笔从颊侧向胸口收束，羽毛朴素不变成狮鬃。近侧大翼折叠贴在肩后，翼的厚实弧面占一侧较大面积，收拢翼尖自然伸到下侧，显露少量深紫；另一侧翼只提示肩部连接，不做对称展翅徽章。只画头胸与折翼，不画脚、尾巴、栖木或场景。整体姿态沉着、有分量，与普通山鸦的轻巧明显不同。

写意笔墨：墨迹本身构成形体，像古籍中的生灵墨画，介于角色剪影与中国写意花鸟之间。头、肩、胸颈和翼以几块宽笔暖灰墨面与少量有力长线概括；眼眶、喙根、翼背转折落少量浓墨支点，中淡墨、飞白与透白留白共同补全形体。银颈羽用留白和方向明确的干笔，不逐根画毛丝；大翼用几组长笔概括羽束，不逐片羽毛堆叠，不渲染金属、皮革、塑料或光滑数码材质。轮廓局部断开，胸羽和翅末墨笔散入透明，但解剖与主体重心清楚。脸以少数墨笔表达神态，不精绘写实虹膜。与人物参考的笔墨尺度和浓淡关系属于同一系列，不是写实猛禽加水墨滤镜，不是3D、厚涂或高精度概念海报。

色墨：灰墨与留白是主体，只在折翼宽笔中自然渗入低饱和苍青色，末端羽束少量低饱和深紫，银颈羽保持暖灰淡墨与透白。两种彩墨都必须有墨的干湿质地，与灰墨融接，不能大面积鲜艳涂色。喙用灰墨而非金属金，眼仅浓墨及小留白。不画雷电、蓝色发光眼、发光轮廓、光环、粒子或背景云雾；雷禽的气势通过凝练的形与笔势传达。

留白与交付：整个头像放在方形中央约75%的区域，四周留出明显完整的透明外圈，头顶、喙、肩、翼尖均至少距画布边缘12%，不能放大填满或裁断。只有一只雷鹏自身的墨笔，背景和笔间留白为真正alpha透明，无纸底、纸张矩形、棋盘纹、地面、文字、印章、水印或边框。浓淡由笔墨自身表达，不整体降低opacity。目标256×256透明WebP，30px列表能认出猛禽头肩，72px详情能读到银颈羽、折翼与两处彩墨。
```

## 咪咪与幽冥虎（2026-09-18）

采用两者第二版，使用内置 image_gen；固定男女墨像仅作为笔墨参考，第一版分别作为编辑对象。咪咪初始造型另参考用户提供的两只家猫照片（美短起司、虎斑曼基康）。照片不放入生产素材。用户随后授权补齐物种设计并接入游戏。

| 物种 | 采用原稿 | 生产素材／注册名 | 导出 |
| --- | --- | --- | --- |
| 咪咪 | exec-685243e4-ffaa-4b44-b96e-4c8b48d4f865.png | beast-mimi.webp／icon:beast-mimi | 256×256 RGBA WebP，24764字节 |
| 幽冥虎 | exec-ed730b07-b783-41bd-afd0-8bfe93758242.png | beast-nether-tiger.webp／icon:beast-nether-tiger | 256×256 RGBA WebP，33854字节 |

咪咪保留低伏抬头、圆眼短足、虎斑白袜，减少写实毛发并修正尾巴从后躯绕向前方的连接。幽冥虎保留压头迈步的动作，依用户要求在背脊与尾部增加幽蓝鬼火；这是本物种局部例外，不修改通用笔墨规范。

从1254×1254原稿以alpha≥4确定边界、保留原始半透明笔触，等比贴合256方形，WebP质量90。素材位于apps/web/public/assets/icons，由统一registry注册。原稿、提示词及纸色／深底64px与256px检查图保存在工作区output/imagegen/mimi-nether-tiger；完整玩法与页面验收见[扩展记录](combat-v6-mimi-nether-tiger.md)。

### 咪咪定稿编辑提示词

```text
Edit image 1, the approved concept of Mimi cat. Images 2 and 3 are FIXED BRUSHWORK STYLE REFERENCES ONLY, no humans in output.
Preserve exactly the charming alert round-eyed expression, lifted head, three-quarter low resting pose, rounded Munchkin body, very short legs, paired white front paws, silver-black classic tabby markings, white bib and muzzle, narrow white nose blaze, yellow-green eyes and tiny pink nose. Do not change the composition or identity.
Make TWO focused corrections:
1. Substantially reduce realism. Translate the cheek fur, forehead, chest and torso into large economical Chinese freehand ink brush masses with dry-brush gaps. Remove individual fur hairs, dense scratchy texture, glossy eye reflections and realistic volume shading. Keep expressive round eyes with simple muted yellow-green wash and black pupil, minimal catchlight. White chest is a few pale strokes and open light spaces. Tabby markings are bold spontaneous directional ink strokes. Warm gray ink, pale washes, a few deep ink anchors. Clearly hand-painted expressive ink, like the style references, not a realistic pet portrait with texture overlay; still recognizable and affectionate, not cartoon vector.
2. Correct tail anatomy completely: REMOVE the existing oversized foreground disconnected-looking tail shape. Draw exactly ONE slender long ringed tail whose base visibly grows from the far LEFT rear rump, the continuation of the spine. It curves gently around the OUTSIDE of the left hindquarters and rests beside the body with its single tip pointing slightly forward. Unambiguous continuous tail base-to-tip, natural taper, no second tail, no tail attached to chest/front leg, no thick isolated sausage in foreground. Preserve both white front paws fully visible and keep rear haunch understandable.
Transparent RGBA background. Only the cat and its ink strokes, no paper, scenery, floor, shadow puddle, checkerboard, words, seal, watermarks or ornaments. Complete ears, paws and tail inside square image, allow a small clear margin to avoid cropping.
```

### 幽冥虎定稿编辑提示词

```text
Edit image 1, the existing Nether Tiger / 幽冥虎 portrait. Images 2 and 3 are FIXED BRUSHWORK STYLE REFERENCES ONLY, no people.
Preserve the approved tiger EXACTLY in identity, expression, overall composition and anatomy: powerful heavy high shoulders, lowered broad tiger head, small rounded ears, stern watchful eyes, closed mouth, one forepaw stepping forward, hindquarters behind, single upcurved tail. Keep near-black/warm-gray ink fur and existing subdued blue tiger stripes. Do not change pose, make it cute, add teeth, or alter the animal species.
Focused requested revision: add a tasteful but CLEARLY VISIBLE supernatural幽蓝鬼火 / spectral blue ghost flame motif. A few wispy curling tongues of blue spirit flame emerge along the upper shoulder ridge and trail lightly back over the spine; a second smaller blue flame cluster curls around the raised tail tip. These should visibly read as BLUE FIRE with tapered rising flame shapes and hollow/pale blue centers, not merely blue fur. Let a little cool blue concentrate in the tiger eyes. The tiger face and paw silhouette stay unobstructed.
Render these ghost flames using translucent low-saturation cobalt/blue-cyan COLOR INK brushstrokes, with dry-brush breaks and open negative spaces, integrated with existing ink body. Small pale blue highlights within flame shapes are welcome; NO large neon glow, no fog cloud, no full fire halo, no particle shower, no scenery, no floor fire or blue puddle. The new ghost flames are a local user-requested exception to the otherwise restrained palette; warm gray/dark ink still dominates the tiger. Maintain clear body visibility and thin tapered spectral fire that contributes a stronger netherworld temperament at avatar size.
STYLE remains Chinese freehand ink portrait, broad structural washes, broken directional brush strokes, sparse deep ink anchors; no photorealistic fur or 3D effects.
Real RGBA transparent background around the animal AND between flame tongues. No paper background, checkerboard, text, watermark, calligraphy, stamp. Complete tiger ears, paws, tail AND flame tips inside square canvas with a small clear margin.
```

## 谛听：采用紫墨赭金版（2026-10-05）

用户选定 `output/imagegen/diting-purple-redesign/diting-purple-v1.png` 并明确要求替换进游戏。保留紫墨兽躯、赭金独角与卷鬃、狮尾尾簇、宽额虎首及侧首察声的形态，不再修改原稿。像素图提供紫金色形灵感，传说提供辨听意象；不将本次配色宣称为古籍固有颜色，也不将谛听造型推广为其他物种模板。

从 1254×1254 RGBA 原稿按 alpha≥4 的边界 `(58,43)—(1240,1225)` 裁掉外圈透明区，保留内部留白与半透明笔触，等比导出 256×256 WebP（质量90、alpha质量100），替换 `apps/web/public/assets/icons/beast-diting.webp`，35398字节。沿用 `icon:beast-diting` 和已有统一注册，不改物种文案、数值或技能。

原稿出处、实际生成提示词及采用依据见 [谛听紫墨头像](art/diting-purple-avatar.md)。已检查纸色与深底的24/30/48/60/72px显示；本地游戏图鉴桌面30px列表／60px详情、390×844手机24px列表／48px详情均加载新稿，未见意外裁断、纸底或棋盘底。截图及导出统计保存在 `output/imagegen/diting-purple-redesign/`。

后续采用逐只看稿的节奏；朱厌、毕方、金乌与白泽均已获用户确认并接入，见下节。下一只为穷奇。

## 朱厌：采用朱赭白首版（2026-10-05）

用户确认 `output/imagegen/zhuyan-cinnabar-redesign/zhuyan-cinnabar-v1.png`，要求替换并进入下一个物种。保留朱赭兽躯、白首赤足、青灰猿面与沉肩前倾的承重姿态，不重绘选稿。颜色和长臂体势参考用户像素图，猿形、白首赤足取自《山海经·西山经》；不修改技能、数值或物种文案。

原稿1254×1254，按alpha≥4边界 `(52,27)—(1232,1228)` 裁切，等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件 `apps/web/public/assets/icons/beast-zhuyan.webp` 为39284字节，可见边界 `(2,0)—(254,256)`，沿用 `icon:beast-zhuyan` 注册。原稿出处和完整实际提示词见[朱厌头像](art/zhuyan-avatar.md)。

本地图鉴桌面30px列表／60px详情、390×844手机24px列表／48px详情均显示新稿，图片正常加载且未见裁断；控制台未记录error。另检查纸色、深底及24/30/48/60/72px预览。截图和导出数据留在 `output/imagegen/zhuyan-cinnabar-redesign/`，本轮深浅底对照位于 `output/imagegen/bifang-blue-redesign/review-paper-dark.png`。

## 毕方：采用青墨赤纹版（2026-10-05）

用户确认`output/imagegen/bifang-blue-redesign/bifang-blue-v1.png`并要求替换进游戏。保留青蓝鸟身、朱红冠翼、白喙、鹤形长颈和独足支撑。色形关系取自用户像素参考，鹤形、一足、赤文青质白喙依据《山海经·西山经》；具体冠羽与翼姿属于美术选择。原稿冠羽较长、翼幅和羽束数量较多、胸腹白色较明显，用户已看稿采用这些实际造型；未重绘，也未修改物种文案、数值或技能。

原稿1254×1254，按alpha≥4边界`(102,17)—(1222,1237)`裁切，使用Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-bifang.webp`为26944字节，alpha范围0—255，可见边界`(10,0)—(245,256)`，沿用`icon:beast-bifang`注册。原稿出处、完整实际提示词与造型边界见[毕方头像](art/bifang-avatar.md)，导出统计见`output/imagegen/bifang-blue-redesign/production-export.json`。

纸色与深底24/30/48/60/72px预览可辨青赤色形，24—30px独足较细，48px及以上更清楚；对照截图为`output/imagegen/bifang-blue-redesign/review-paper-dark.png`。正式接入后复用已有本地服务检查图鉴：桌面30px列表／60px详情、390×844手机24px列表／48px详情均加载正式素材，natural尺寸256×256、`complete=true`，未见挤压或意外裁断；控制台error与warn均为空。截图为`output/imagegen/bifang-blue-redesign/game-desktop.png`与`game-mobile.png`。纯素材及文档改动，已检查导出、显示与`git diff --check`，未另跑lint、typecheck、完整生产build和test。

## 金乌：采用黑墨金红v2版（2026-10-05）

用户确认`output/imagegen/golden-crow-solar-redesign/golden-crow-solar-v2.png`并要求替换进游戏。保留黑墨乌身、赭金肩翼、朱红羽端、不对称腾起双翼和恰好三条分离腿足。乌形、三足及日之精是传说依据，金红配色来自用户像素参考的美术启发。首稿最高翼尖截断，v2针对这一处修复画布与羽尖，用户采用完整翼尖的v2；不修改物种文案、数值或技能。

选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(88,52)—(1182,1224)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-golden-crow.webp`为30302字节，可见边界`(8,0)—(247,256)`，沿用`icon:beast-golden-crow`注册。导出统计为`output/imagegen/golden-crow-solar-redesign/production-export.json`，原稿出处、两次完整实际提示词及采用边界见[金乌头像](art/golden-crow-avatar.md)。胸腹浓墨较满、羽层和眼喙较细、喙端略下弯是用户已看稿接受的造型边界。

纸色与深底24/30/48/60/72px检查中，金红翼势在小尺寸可辨，24—30px三足细节较弱，48px及以上更清楚。正式接入后复用既有本地服务检查渡劫图鉴：桌面30px列表／60px详情、390×844手机24px列表／48px详情均加载正式素材，natural尺寸256×256、`complete=true`，未见意外裁断；控制台error/warn均为空。截图为`output/imagegen/golden-crow-solar-redesign/game-desktop.png`与`game-mobile.png`。纯素材及文档改动，已检查导出、显示与`git diff --check`，未另跑lint、typecheck、完整生产build和test。

## 白泽：采用白墨金角版（2026-10-05）

用户确认`output/imagegen/baize-white-gold-redesign/baize-white-gold-v1.png`并要求替换进游戏。保留白墨兽躯、赭金分叉双角、青灰颈肩尾部、宽额短吻与沉静驻足的察看神态。白身金角色形取自像素参考，知察神韵取自《云笈七签》卷一百《轩辕本纪》，狮面双角参考后世白泽图像；分叉与具体颜色是美术选择，不误称为《山海经》正文固定外貌。不修改物种文案、数值或技能。

选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(46,28)—(1231,1231)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-baize.webp`为30788字节，可见边界`(2,0)—(254,256)`，沿用`icon:beast-baize`注册。正式统计为`output/imagegen/baize-white-gold-redesign/production-export.json`，原稿出处、完整实际提示词及采用边界见[白泽头像](art/baize-avatar.md)。明显分叉双角、较长层叠胸鬃、丰厚尾簇、较细的眼面毛束与朝右头部均属于用户看稿采用的实际造型，不宣称提示中的收束胸鬃和全部笔墨要求已实现。

候选阶段纸色与深底24/30/48/60/72px预览可辨白身、金角与青灰，24—30px下双角分叉、远侧足和眼神细节较弱，48px及以上更清楚。正式接入后首次桌面30px列表／60px详情已正常显示，截图为`output/imagegen/baize-white-gold-redesign/game-desktop.png`。同期Vite代码热更新出现模块重载错误，随后重载时本地服务连接被拒绝；这一历史错误保留，不将全过程日志称为始终无错。

执行`pnpm run dev:web`恢复标准Turbo watch开发服务，六个依赖库编译后Vite就绪。在新浏览器页复查大乘图鉴，桌面30px列表／60px详情、390×844手机24px列表／48px详情均加载正式素材，生产图`complete=true`、natural尺寸256×256，无意外裁断；恢复后的新页error/warn均为空。截图为`output/imagegen/baize-white-gold-redesign/game-desktop-restored.png`与`game-mobile.png`。已检查正式导出、显示与`git diff --check`，开发启动包含依赖库编译，未另跑lint、typecheck、完整生产build和test；检查后保留前端服务运行以恢复开发状态，未改代码或游戏数据。

## 穷奇：采用赭金赤翼v2版（2026-10-05）

用户确认`output/imagegen/qiongqi-ochre-red-redesign/qiongqi-ochre-red-v2.png`并要求替换进游戏。保留赭金虎躯、粗黑虎纹、赤色双翼、四足和单条环纹尾。取《山海经·海内北经》虎形有翼的穷奇，不混入《西山经》另一牛形描述；金赭虎身、赤色羽翼和无角均属像素参考启发下的美术选择，不新增火系能力。首稿右侧翼缘触边，v2只作画布与外轮廓修正，用户采用完整轮廓的v2；不修改物种文案、数值或技能。

选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(66,72)—(1221,1199)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-qiongqi.webp`为35370字节，可见边界`(0,3)—(256,253)`，沿用`icon:beast-qiongqi`注册；正式统计为`output/imagegen/qiongqi-ochre-red-redesign/production-export.json`。原稿出处、两次完整实际提示词及采用边界见[穷奇头像](art/qiongqi-avatar.md)。实际为前爪一伸一收、近翼大幅展开的逼近／扑落姿态，不记作静伏半折翼；虎面、虎纹和羽束较细，淡墨与留白较少，是用户看稿采用的实际边界。

候选阶段纸色与深底24/30/48/60/72px检查可辨赭金虎身与赤翼，48px及以上虎面、四足和虎纹更清楚；对照截图与透明统计留在`output/imagegen/qiongqi-ochre-red-redesign/`。正式检查期间本地服务曾短暂不可用，页面出现connection refused；既有`dev:web`的Turbo watch在同期代码修改后自行重启恢复，未另启动服务或修改配置，不将全过程记作始终无错。

恢复后1280×720桌面大乘图鉴列表30px／详情60px、390×844手机列表24px／详情48px均加载正式素材，`currentSrc`为`http://127.0.0.1:5174/assets/icons/beast-qiongqi.webp`、`complete=true`、natural尺寸256×256；赭金虎身与赤翼可读，未见裁断或挤压，恢复后的error/warn均为空。截图为`output/imagegen/qiongqi-ochre-red-redesign/game-desktop.png`与`game-mobile.png`。已执行透明导出、浏览器检查、`rg`路径核对与`git diff --check`；既有开发服务后台有依赖库重建，未独立运行lint、typecheck、完整生产build或test，未修改代码或游戏数据。本轮首批六只均已获用户确认并接入，继续按逐只看稿的节奏处理后续物种。

## 九尾狐：采用白躯赤尾v2版（2026-10-05）

用户确认`output/imagegen/nine-tailed-fox-cinnabar-redesign/nine-tailed-fox-cinnabar-v2.png`并要求替换进游戏。白狐与朱红耳尾提取自像素参考和现有物种设定，狐形九尾依据《山海经·南山经》青丘段；不把白红配色称为古籍指定颜色，也不新增传说衍生的玩法能力。v1下尾红白卷折造成额外尾末错觉，v2保留上方五尾、重组下方四尾的单一收尖与间隔，用户采用数量更清楚的v2；不修改物种文案、数值或技能。

选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(50,32)—(1230,1219)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-nine-tailed-fox.webp`为36674字节，可见边界`(1,0)—(255,256)`，沿用`icon:beast-nine-tailed-fox`注册，复用既存旧素材备份。正式统计为`output/imagegen/nine-tailed-fox-cinnabar-redesign/production-export.json`，原稿出处、两次完整实际提示词及采用边界见[九尾狐头像](art/nine-tailed-fox-avatar.md)。大图可辨上五下四共九尾；四肢中一前足抬收、另一前足落稳，两后足支撑。胸颈厚鬃、繁尾近扇形、较精细眼面与尾纹、最下尾和后腿局部重叠均属用户已接受的实际边界，不宣称全部轻薄减笔要求已实现。

候选阶段纸色与深底24/30/48/60/72px检查首先可辨白狐与赤色多尾，48—72px尖耳、狐体和尾间分隔更清楚，不承诺小列表逐条数清九尾。正式接入后复用既有本地服务，1280×720桌面合体图鉴列表30px／详情60px、390×844手机列表24px／详情48px均加载生产图`/assets/icons/beast-nine-tailed-fox.webp`，`complete=true`、natural尺寸256×256；白狐赤尾清楚，无意外裁断，error/warn均为空，本次验收无服务报错或重启。截图为`output/imagegen/nine-tailed-fox-cinnabar-redesign/game-desktop.png`与`game-mobile.png`。已检查正式导出、浏览器、路径与`git diff --check`，未独立运行lint、typecheck、完整生产build或test，未修改同期代码或游戏数据。后续按用户要求继续祸斗，保持逐只看稿的节奏。

## 祸斗：采用首稿炭黑火鬃v1版（2026-10-05）

用户明确选择`output/imagegen/huodou-ember-redesign/huodou-ember-v1.png`的长毛狼式肩背、火鬃与蓬尾并要求接入，随后继续旋龟。炭黑兽躯和赤赭／焦橙肩背尾末取自像素参考启发，犬形食火意象借《太平广记》所引《原化记》的“蜗斗”；《赤雅》同名记述分开引用，不拼成统一原典食性。长毛狼相、四足低行和单条蓬尾均按用户明确选定首稿保留，未采用收短轮廓的v2；不修改物种文案、数值、技能或配置。

选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(61,117)—(1248,1166)`裁切，Lanczos3等比contain贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-huodou.webp`为30160字节，可见边界`(0,15)—(256,241)`，沿用`icon:beast-huodou`注册；经旧素材备份hash匹配核对后覆盖正式文件，正式统计见`output/imagegen/huodou-ember-redesign/production-export.json`。原稿出处、完整首稿实际提示词、用户选定造型与未采用修正史见[祸斗头像](art/huodou-avatar.md)。

依照用户新增要求，本次只替换立绘，不打开网页验收；网页效果由用户亲自验收。已做静态源图／导出图查看、alpha统计、素材路径／hash、提示词与`git diff --check`核对，不将已有候选网页截图当作正式接入结果。未独立运行lint、typecheck、完整生产build或test，保留所有同期代码、配置与游戏数据。

## 旋龟：采用橄榄青绿v1版（2026-10-05）

用户确认`output/imagegen/xuangui-green-redesign/xuangui-green-v1.png`并要求替换进游戏，继续后续物种。鸟首、龟身和长蛇尾依据《山海经·南山经》“鸟首虺尾”，橄榄绿宽甲、青绿头颈四肢与长尾、赭黄鸟喙和腹甲来自像素参考启发；不新增传说效用或游戏能力。保留用户已看稿的挺起鸟颈、鹰钩喙、较粗蛇尾、较厚实连续墨面及较细的甲片分界、眼喙和足爪，不将初始低伏／中短颈与全部减笔要求记作实现；不重绘或修改物种文案、数值、技能和配置。

选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(47,109)—(1241,1178)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-xuangui.webp`为29718字节，可见边界`(0,13)—(256,242)`，沿用`icon:beast-xuangui`注册，经旧素材备份hash匹配核对后覆盖；正式统计见`output/imagegen/xuangui-green-redesign/production-export.json`。原稿出处、完整实际提示词、采用形态及技术边界见[旋龟头像](art/xuangui-avatar.md)。

本轮按用户要求只换立绘，不打开网页，不做桌面／手机网页验收，网页效果由用户亲自验收。已核对静态源图／导出图、alpha／边界、素材路径／hash、提示词与`git diff --check`，未独立运行lint、typecheck、完整生产build或test，保留所有同期代码、配置和游戏数据。下一只按逐只看稿的节奏继续饕餮。

## 饕餮：采用青绿金牙v1版（2026-10-05）

用户确认`output/imagegen/taotie-verdigris-redesign/taotie-verdigris-v1.png`并要求替换进游戏，下一只继续应龙。青绿厚躯、金角牙和朱红舌来自像素参考启发；贪食意象取《山海经》郭璞注与传统兽面纹，区分《北山经》正文名为狍鸮的形态，不混入人面、腋目或人手，不称为正文完整复原，也不新增游戏能力。保留用户已看稿的下颌上弯大獠牙、凶悍怒张、厚肩狮形守门兽感、较粗长弯尾及连续实体墨面、细眼牙口爪；不按提示重绘或修改物种文案、数值、技能与配置。

选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(27,91)—(1245,1196)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-taotie.webp`为36304字节，可见边界`(0,12)—(256,244)`，沿用`icon:beast-taotie`注册，经旧素材备份hash匹配核对后覆盖；正式统计见`output/imagegen/taotie-verdigris-redesign/production-export.json`。原稿出处、完整实际提示词、采用形态与技术边界见[饕餮头像](art/taotie-avatar.md)。

本轮按用户要求只换立绘，不打开网页，不做桌面／手机网页验收，网页效果由用户亲自验收。已核对静态源图／导出图、alpha／边界、素材路径／hash、提示词与`git diff --check`，未独立运行lint、typecheck、完整生产build或test，保留所有同期应用代码、配置及游戏数据。

## 应龙：采用蓝墨赭金v2版（2026-10-05）

用户确认`output/imagegen/yinglong-blue-gold-redesign/yinglong-blue-gold-v2.png`并要求替换进游戏，下一只继续麒麟。蓝墨长龙、赭金角鬃与腹带来自像素参考启发，水雨意象取《山海经·大荒东经》《大荒北经》，有翼的解释取郭璞注及《艺文类聚》所引《广雅》，不混作正文形态描述，也不称蓝金配色或具体羽翼形状为古籍规定。保留项目双翼四足与连续盘身，不新增游戏能力。v1翼尖、右翼缘与尾末触框，v2只修复取景和外轮廓；用户采用完整轮廓的v2，不重绘或修改物种文案、数值、技能与配置。

实际清俊有威仪，蓝金盘身与宽幅双翼鲜明，较密的羽层、角枝和鬃、较精细头面及羽状分叉尾簇均为用户已看稿接受的边界；不把单尖尾或全部疏朗减笔要求记作已经实现。选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(67,81)—(1196,1188)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-yinglong.webp`为39308字节，可见边界`(0,2)—(256,253)`，沿用`icon:beast-yinglong`注册，经旧素材备份hash匹配核对后覆盖；正式统计见`output/imagegen/yinglong-blue-gold-redesign/production-export.json`，原稿出处、两轮完整实际提示词、修框经过与采用边界见[应龙头像](art/yinglong-avatar.md)。

本轮按用户要求只换立绘，不打开网页，不做桌面／手机网页验收，网页效果由用户亲自验收。已核对静态源图／导出图、alpha／边界、素材路径／hash、两轮提示词与`git diff --check`，未独立运行lint、typecheck、完整生产build或test，保留所有同期应用代码、配置及游戏数据。

## 麒麟：采用青绿赭金v2版（2026-10-05）

用户确认`output/imagegen/qilin-jade-gold-redesign/qilin-jade-gold-v2.png`并要求替换进游戏，完成后仅盘点尚未重新设计的物种，下一只待选择。像素板没有直接麒麟参考，本稿青金配色仅借英招格的色彩关系，不迁移英招的翼、人面或解剖，不以天禄作麒麟原型，也不称为古籍规定颜色。鹿身、牛尾与温润瑞兽意象取《尔雅》《说文解字》《礼记》，原典一角与项目分枝长角分开处理，本稿采用双分枝角，不称精确复原，也不新增游戏能力。v1最高角尖触框，v2仅修复取景和角末；用户采用完整角尖的v2，不重绘或修改物种文案、数值、技能与配置。

实际长分枝角、丰鬃、大幅卷曲尾簇、细密金边鳞、较精细头面蹄端及清俊温和缓步均为用户已看稿接受的边界，不把短鬃、小尾簇、简鳞或完全疏朗减笔记作已经实现。选稿1254×1254 RGBA、alpha范围0—255，按alpha≥4边界`(225,35)—(1180,1210)`裁切，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。正式文件`apps/web/public/assets/icons/beast-qilin.webp`为30730字节，可见边界`(24,0)—(232,256)`，沿用`icon:beast-qilin`注册，经旧素材备份hash匹配核对后覆盖；正式统计见`output/imagegen/qilin-jade-gold-redesign/production-export.json`，原稿出处、两轮完整实际提示词、修框经过与采用边界见[麒麟头像](art/qilin-avatar.md)。

本轮按用户要求只换立绘，不打开网页，不做桌面／手机网页验收，网页效果由用户亲自验收。已核对静态源图／导出图、alpha／边界、素材路径／hash、两轮提示词与`git diff --check`，未独立运行lint、typecheck、完整生产build或test，保留所有同期应用代码、配置及游戏数据。

## 麒麟接入后的重设计盘点（2026-10-05）

核对当前`packages/game-content/src/beasts/data/species.json`、图标注册、正式素材及采用记录：全库34种，29种已有专属头像文件，5种仍使用emoji。炼虚至渡劫的16种新物种中，本轮从像素参考提取配色并结合传说重设计、已经接入的为12种，合体、大乘、渡劫全部覆盖。

| 当前状态 | 数量 | 物种 |
| --- | ---: | --- |
| 本轮彩墨重设计已接入 | 12 | 合体：九尾狐、祸斗、旋龟、朱厌；大乘：毕方、白泽、穷奇、饕餮；渡劫：应龙、金乌、麒麟、谛听 |
| 前序单独新绘，未参加本轮彩墨 | 1 | 炼虚：青鸾 |
| 沿用扩展阶段旧稿，未见本轮重设计记录 | 3 | 炼虚：鸣蛇、蜃蚌、獬豸 |
| 炼气至化神已有较早头像，未参加本轮彩墨 | 13 | 咪咪、火鸦、琉璃鹤、无影貂、蛇颈玄龟、墨蛟、银翅螳螂、狰、三足金蟾、雷鹏、六目灵猿、冥灯蝶、幽冥虎 |
| 炼气至化神仍使用emoji | 5 | 烛尾狐、钢背猪、精灵狼、双尾蝎、抱月熊 |

因此，新物种里可以优先继续的是鸣蛇、蜃蚌、獬豸3种。若按“未参加本轮彩墨”的口径则是炼虚4种，还包含青鸾；[青鸾已于同日单独新绘并接入](art/qingluan-avatar.md)，不能记作从未重绘。首批炼气至化神18种属于较早的设计阶段，另行列出，不混入这12种的采用进度。

盘点以当前正式素材及后续采用记录为准：`output/imagegen/beast-color-round-1/README.md`中的初始六只候选未在该批次接入，不能重复计数；已撤下的琥珀蝉不列入现行物种。12个本轮目录均有`production-export.json`，源稿与正式文件存在，正式字节数符合记录，有SHA-256记录的正式文件匹配。完成麒麟替换后仅做本次盘点，未生成下一只、未打开网页验收；已运行文件／hash核对与`git diff --check`，素材及记录变化未运行应用lint、typecheck、build或test。

## 鸣蛇、蜃蚌、獬豸：授权连续重设计并接入（2026-10-05）

用户随后明确授权这三种按既往经验全部重新设计、无需逐只确认，直至全部替换入游戏。沿用只换立绘、不打开网页验收的要求；生成、定向修正、静态审查和正式替换均已完成，没有修改物种配置、文案、数值、技能、注册或玩法。

| 物种与采用稿 | 形神与彩墨 | 像素参考边界 | 正式素材与记录 |
| --- | --- | --- | --- |
| 鸣蛇，暗赭铜金v1 | 单首单尾无足的连续S弯，两对前后错层薄膜翼，昂首辨风；暗赭蛇背与铜金膜翼直接构形。取《山海经·中山经》鲜山条蛇形四翼、音如磬意象，不画旱灾景物 | 板上无鸣蛇，仅借第四行第二格蛊雕棕金配色，不迁移鸟首、羽翼、角爪 | `apps/web/public/assets/icons/beast-mingshe.webp`，42140字节；[完整采用记录与实际提示词](art/mingshe-avatar.md) |
| 蜃蚌，靛青紫墨v1 | 同一铰链连接半开的厚双壳，青蓝／淡紫内面与含水肉裙构形，前缘附着一颗水滴，神韵安稳含藏；大蛤传统作为生成后的审查溯源，不混龙蛇蜃或海市背景 | 板上无蜃蚌，仅借文鳐青蓝、天禄淡紫，不迁移鱼鳍尾、兽身或角 | `apps/web/public/assets/icons/beast-shen-clam.webp`，32080字节；[完整采用记录与实际提示词](art/shen-clam-avatar.md) |
| 獬豸，靛青赭金v2 | 蓝白厚毛羊兽、四只坚实分瓣蹄、赭金单额角，肩鬃与单尾收束，神态清醒警觉；借一角羊辨曲直的传说意象，不把不同古籍形态拼作同版定论 | 直接参考第五行第二格獬豸的白／灰蓝躯体与金单角，重新按项目羊兽骨架设计，不照搬像素比例 | `apps/web/public/assets/icons/beast-xiezhi.webp`，27252字节；[完整采用记录与两轮实际提示词](art/xiezhi-avatar.md) |

三种均使用内置image_gen，以固定男女墨像作笔墨参考，旧头像只作前后对照，不成为新稿形态模板。鸣蛇与蜃蚌各生成一次；獬豸首稿的高肩鬃与长蓬尾仍偏狮兽，v2定向收束这两处并调整头肩后采用。色彩均为像素启发和本次创作选择，不称古籍规定颜色，也不新增传说衍生能力。

实际边界已留档：鸣蛇腹面较宽，眼鳞及翼支比固定基准细实；蜃蚌肉裙折线与淡白高光较多，小水滴在24px下不是主要识别点；獬豸头颈仍偏高、角尖略弯，鬃毛笔势比固定基准密，不能称完全实现低头迎击或全部减笔要求。独立复核未见必须重做的多肢、断接、关键轮廓截断或背景脏底；不以提示词要求代替实际验收结论。

三份选稿均为1254×1254真实RGBA，按alpha≥4裁掉透明外边距，保留内部alpha与负形，Lanczos3等比贴合256×256透明画布，WebP质量90、alpha质量100。鸣蛇源裁切`(48,39)—(1222,1227)`、正式可见界`(1,0)—(254,256)`；蜃蚌为`(31,77)—(1227,1176)`与`(0,10)—(256,245)`；獬豸为`(46,72)—(1241,1221)`与`(0,5)—(256,251)`。沿用现有三个`icon:`注册，覆盖前核对旧图备份，源／正式／备份SHA-256均记录在各自`output/imagegen/*-redesign/production-export.json`中。

已查看独立源图和正式图、纸色／深底及24—60px以上的静态缩小效果，核对真实alpha、完整边缘、路径、提示词和文件hash，并运行`git diff --check`。按用户要求不启动网页服务器、不做桌面／手机网页验收；纯素材与记录变更未运行应用lint、typecheck、build或test。

此时炼虚至渡劫16种新物种中，本轮像素启发彩墨已接入15种；青鸾保留此前同日单独新绘的已采用头像。上一节是麒麟接入时的历史盘点，不代表这三种仍待重设计。

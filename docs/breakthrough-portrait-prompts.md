# 突破挑战写意墨像生成记录

本批素材用于突破前剧情演出及战斗单位缩略图。使用内置 `image_gen.imagegen`，各角色独立调用，均要求 `transparent_background: true`。不使用 CLI 或 Python 图像编辑。

## 冻结笔墨参考

生成前通过 `view_image` 分别查看以下固定参考，只借用暖灰墨色、宽笔尺度、浓淡层级和材质概括，不复制玩家身份或姿势：

- [男修基准](../.agents/skills/daoyou-ink-portraits/references/male-baseline.webp)
- [女修基准](../.agents/skills/daoyou-ink-portraits/references/female-baseline.webp)

生成工具的全新图片调用不附带编辑对象，提示词明确要求沿用已查看基准的笔墨语言。没有替换上述冻结参考。

## 角色构思

| 挑战标识 | 主体设计 | 姿态与辨识 | 墨色 |
| --- | --- | --- | --- |
| `foundation_qi` | 丹田浊息凝成的伏息石蟾 | 低伏压实的蟾形、四足稳定 | 暖灰墨，喉侧少量淡赭 |
| `core_condensation` | 凝丹逸散火意聚成的离火丹螭 | 无角、短躯盘曲，保留四条短肢 | 暖灰墨，喉中一点淡赭红 |
| `heart_demon_nascent` | 恐惧所生的修士倒影 | 单膝蹲跪，袍袖环绕胸前空洞 | 暖灰墨 |
| `tribulation_deity` | 劫云借形的长喙雷禽 | 俯首收翼，背脊横笔形成压势 | 暖灰墨，少量冷灰 |
| `law_insight_void` | 空间法则的断碑异形 | 三枚断碑穿过残缺石环，留出悬空负形 | 暖灰墨 |
| `tribulation_body` | 承雷固身的负甲巨龟 | 低重心四足，抬首，背甲大块断笔 | 暖灰墨 |
| `inner_demon_grand` | 固守执念的枯藤长臂猿 | 长臂抱空匣，藤与肢体同向概括 | 暖灰墨，少量枯褐 |
| `heavenly_tribulation_final` | 观劫衡量的天道残钟 | 悬垂破钟，钟腔留白含一枚眼形 | 暖灰墨 |

## 心魔化身完整调用提示词

```text
Use case: stylized-concept.
Asset type: single isolated transparent boss portrait for the Chinese cultivation game 万界道友, a narrative encounter before Golden Core to Nascent Soul breakthrough.
Primary request: 心魔化身 — a fear-born reflection that guards the formation of the nascent soul. A lone gaunt cultivator-shaped shadow, crouched on one knee rather than standing, head slightly bowed but facing three-quarter toward viewer. One hand rests against the chest, the other opens an empty sleeve. A torn arc of robe bends around a deliberate hollow at the torso: inner emptiness and negative space carry its unsettling identity. A few short hair strokes and brow/nose dots suggest a face without a sealed blank mask. No weapon. Full body; balanced, legible silhouette.
Style/medium: Chinese expressive ink portrait from an old illustrated manuscript. The subject itself is formed from several broad warm gray brush masses and a few long directed lines; very few dark ink structural anchors at head, shoulder and planted knee. Middle and pale ink, dry-brush flying-white gaps and genuinely unpainted space finish the anatomy. Broken edges fade at the robe ends; brushwork has directional wet/dry change. Match the broad brush scale, warm gray ink hierarchy and simplified faces of the male and female frozen ink references shown in the conversation. These are STYLE references only, never copy their exact face, clothing or pose. NOT a realistic costume painting with an ink filter. Cloth is brush masses, no dense folds. Keep open interior space.
Color palette: warm gray and dark warm ink only.
Composition/framing: one full figure centered in a square canvas, slightly asymmetric, all head, fingers, knee and robe ends inside frame, tight but safe margins, designed to remain recognizable displayed around 300 pixels high.
Backdrop: genuinely transparent alpha everywhere without subject marks, including open body spaces. No paper rectangle, no white matte, no black background, no checkerboard pattern, no ground, no cast shadow.
Text: none.
Avoid: glowing eyes, luminous outlines, halos, particles, smoke backdrop, many ribbons, photorealistic volume, armor detail, calligraphy, seal, signature or watermark.
```


## 其余七张共用提示词

每个调用由以下共用段与后续对应角色段拼接，使用 `transparent_background: true`。

```text
Use case: stylized-concept.
Asset type: one isolated transparent boss portrait for the Chinese cultivation game 万界道友, shared by breakthrough narrative and a square combat thumbnail.
Style/medium: Chinese expressive ink portrait from an old illustrated manuscript. The subject itself is formed from several broad warm gray brush masses and a few long directed lines; very few dark ink structural anchors. Middle and pale ink, dry-brush flying-white gaps and genuinely unpainted space finish the anatomy. Broken edges fade at the ends; brushwork has directional wet/dry change. Match the broad brush scale, warm gray ink hierarchy and simplified anatomy of the male and female frozen ink references shown in the conversation. These are STYLE references only, never copy their exact face, clothes, human anatomy or pose. NOT a realistic creature/costume painting with an ink filter. Body and materials are brush masses, no dense scale/fur/stone/cloth detail; keep open interior space. Strength comes from silhouette, weight and ink placement.
Composition/framing: one complete creature or sentient entity centered in a square canvas. All key extremities inside frame with a modest safe margin. Silhouette must stay clear displayed about 96 pixels square, and brushwork must remain graceful at 300 pixels high. Make this an independent creature design; do not repeat a crouching human from a prior image.
Backdrop: genuinely transparent alpha everywhere outside subject marks, including interior negative spaces. No paper rectangle, no white matte, no black background, no checkerboard pattern, no ground, no cast shadow.
Text: none.
Avoid: saturated colors, colored edge halos, glowing eyes, luminous outlines, halos, particles, scenic smoke backdrop, many ribbons, photorealistic volume, detailed material rendering, calligraphy, seal, signature or watermark.
```

### `tribulation_deity`

```text
Primary request: 天劫投影, a thunder-cloud taking the willful form of an ancient long-beaked bird to question the newborn primordial spirit. A NONHUMAN bird with a narrow stern head and a long downward-curving beak. Compact substantial body, two broad folded wings swept upward just enough to create a peaked back, dark short sturdy feet gripping nothing. Three-quarter frontal view, head bowed toward viewer as if judging them; poised and still, no flying. A few jagged dry-brush interruptions along feather masses suggest contained thunder, never actual lightning beams. Broad feather masses only, no individually drawn plumage.
Color palette: warm gray and dark warm ink, with only a tiny amount of subdued cool gray at the beak base. Full bird. Not a dragon, human, eagle photograph or ornate phoenix.
```

### `law_insight_void`

```text
Primary request: 法则残影, a sentient spatial law manifested as three fractured ancient stone tablets intersecting one incomplete oval stone ring. This is an ABSTRACT NONHUMAN being, no face or limbs; unequal tablets lean and float in a clear deliberate structure, the central long tablet pierces through the broken ring. The gaps between objects form an impossible folded doorway, hinting at awareness without any glowing eye. The structure has a stable vertical direction and generous transparent negative spaces, all fragments structurally connected in composition. No inscriptions, glyphs or text. Edge fractures conveyed by a few dry brush breaks, not dense stone texture.
Color palette: warm gray and dark warm ink only. All tablets and ring fully inside the square.
```

### `tribulation_body`

```text
Primary request: 劫雷化身, a primordial massive-shelled tortoise embodying the endurance needed to bind body and spirit together. A fully NONHUMAN tortoise with a low domed shell, four thick squat legs and short broad claws, short sturdy neck raising a small blunt determined reptilian head. Three-quarter frontal view, stable heavy weight and clearly separated four limbs. Its carapace has THREE or FOUR angular broad ink masses suggesting a thunder ridge, NOT rows of small scutes or rock texture. Pale spaces separate the shell masses. No dragon head, no horns, no human features, no lightning effects.
Color palette: warm gray and dark warm ink only. Full animal, compact low silhouette.
```

### `inner_demon_grand`

```text
Primary request: 执念化身, a root-and-withered-vine ape that cannot release an empty small wooden casket, embodiment of attachments accumulated on the path. Fully NONHUMAN old long-armed ape, bowed back with a heavy shoulder, one folded leg and one grounded knuckle, head lowered toward a single open empty casket held protectively against the belly. The empty inside of the casket is an important visible transparent negative shape. A few woody vine strokes follow arm direction but do NOT become a cloud of tendrils or a costume. Primate anatomy, long narrow muzzle, tiny face ink accents, no human expression. Full animal.
Color palette: warm gray and dark warm ink with a small dry muted umber passage along one forearm; no other color. Fur and vine bark in broad strokes, no fine texture.
```

### `heavenly_tribulation_final`

```text
Primary request: 天道劫影, an ancient sentient heavenly weighing bell confronting a cultivator at the final mortal boundary. A single enormous suspended Chinese ritual bell with an uneven broken lower rim, short curved suspension loop at the top, heavy round shoulders narrowing slightly toward the mouth. The inner hollow is exposed by a three-quarter angle and contains ONE almond-shaped negative-space eye looking outward, made only by two measured dark ink strokes and unpainted space. This eye establishes will and awareness without a face. A few internal flowing ink arcs suggest a balance being held, not actual scales attached. The bell body is composed of broad open warm gray brush areas; broken rim and shoulder hold the strongest ink. No rows of bronze ornament, no inscription.
Color palette: warm gray and dark warm ink only. Full bell, no supports or scenery, no glowing or magical ring.
```

### `foundation_qi`

```text
Primary request: 伏息石蟾, a low compressed stone toad formed from uncleared turbid breath in the dantian, the first obstacle to a firm cultivation foundation. Fully NONHUMAN broad squat toad, low belly, folded strong rear legs, small grounded forefeet, wide calm blunt mouth and two low brow bumps. Three-quarter frontal view, motionless and weighty as if pressing unsettled breath down. A faint thin ochre brushstroke at the throat suggests condensed earth-breath. Its stone nature is expressed by TWO or THREE blocky brush masses and dry broken edges, never dense rock texture, warts or tiny cracks. Not a cute cartoon, not a giant monster; a plain serious stone toad.
Color palette: warm gray and dark warm ink, very small pale ochre at throat only. Full animal compact square silhouette.
```

### `core_condensation`

```text
Primary request: 离火丹螭, a small hornless chi-dragon formed from the fire escaping a condensing golden core. A NONHUMAN hornless compact serpent-dragon with a short coiled body, a rounded reptilian head held above the coil, four very short clawed legs clearly belonging to the compact body, a short tail curve completing a small circular stance. NO long whiskers, NO antlers, NO wings. Small resolute face suggested by just eye and nose dots; not snarling. ONE tiny muted ochre-red touch inside the throat suggests internal alchemical fire, no flame outside body. Coiled anatomy and clear negative spaces matter more than scales; body is several broad directed ink strokes with a few dry spine accents.
Color palette: warm gray and dark warm ink with just a small subdued ochre red throat mark. Full compact creature, no monumental dragon poster, no background or clouds.
```

## 交付验收

采用原图均位于 `/Users/churcht/.codex/generated_images/01a14398-8f63-7e71-915d-8ff90eff458d/`，正式资源已保存进仓库的 `apps/web/public/assets/icons/`。没有将默认生成目录作为运行时资源路径。

统一通过 bundled Sharp 做常规资源转换：保留原图比例缩至 1024 × 1024，WebP `quality: 88`、`alphaQuality: 100`、`effort: 6`。没有用代码补画、抠图、去底或伪造墨迹。

| 正式资源 | 原图文件 | 大小（bytes） | 全透明像素 | 半透明像素 |
| --- | --- | ---: | ---: | ---: |
| [breakthrough-core_condensation.webp](../apps/web/public/assets/icons/breakthrough-core_condensation.webp) | `exec-d6a51e24-25d5-4e5a-9249-1b02f889190a.png` | 296434 | 512289 | 535427 |
| [breakthrough-foundation_qi.webp](../apps/web/public/assets/icons/breakthrough-foundation_qi.webp) | `exec-26216281-654d-4232-afe4-18f96f05bb7c.png` | 226350 | 558016 | 490218 |
| [breakthrough-heart_demon_nascent.webp](../apps/web/public/assets/icons/breakthrough-heart_demon_nascent.webp) | `exec-de56715d-dc00-45f9-9f11-1d1d062a9ac9.png` | 338150 | 518078 | 529606 |
| [breakthrough-heavenly_tribulation_final.webp](../apps/web/public/assets/icons/breakthrough-heavenly_tribulation_final.webp) | `exec-dea2ac58-8842-430a-b0f3-6f35cdf625b4.png` | 253162 | 497461 | 550378 |
| [breakthrough-inner_demon_grand.webp](../apps/web/public/assets/icons/breakthrough-inner_demon_grand.webp) | `exec-ff85de1d-ec10-44e6-9d9b-b481e2ddec1a.png` | 404902 | 388755 | 659656 |
| [breakthrough-law_insight_void.webp](../apps/web/public/assets/icons/breakthrough-law_insight_void.webp) | `exec-0cda9605-2722-43e0-a3a5-111a4d69b157.png` | 310616 | 522359 | 524966 |
| [breakthrough-tribulation_body.webp](../apps/web/public/assets/icons/breakthrough-tribulation_body.webp) | `exec-1999845c-0db3-4893-bc95-b487b135805e.png` | 243226 | 528927 | 519147 |
| [breakthrough-tribulation_deity.webp](../apps/web/public/assets/icons/breakthrough-tribulation_deity.webp) | `exec-27f221ca-a22d-487f-8ea4-cf455988db6e.png` | 370652 | 425913 | 622441 |

全部为 1024 × 1024、4 通道、真实 alpha 的 WebP，总计 2,443,492 bytes（约 2.33 MiB）。逐张核验外部全透明区与半透明墨迹；内部空洞未被填成整张纸底。没有复制到第二份突破目录。

已查看每张生成图，核对主体完整性、独立轮廓、留白与暖灰笔墨。构思层面分别保留蟾、无角短螭、蹲跪心魔、长喙雷禽、断碑残环、负甲巨龟、抱匣猿与观劫残钟的辨识。游戏内按正常 opacity 展示，由实际任务剧情页与战斗单位缩略图完成最终纸色背景、窄屏与显示尺寸验收。

工具的透明黑底预览可能显出原图在极低 alpha 区域的 RGB 残值。对心魔样本的逐像素核查显示，饱和红残值像素最大 alpha 为 3/255；实际可见性以游戏纸色背景渲染为准，不通过降低整体 opacity 处理。曾通过内置图像编辑做针对性边缘修正预览，未替换已采用原图。

本批只修改八个资源文件与本提示词文档，未运行 lint、typecheck 或应用构建；由主任务在接入后统一执行应用检查。



# 炼体修士墨像

2026-10-22 第二轮：使用内置 image_gen 编辑现有玩家墨像，制作男女举鼎炼体姿态。身份参考为 `apps/web/public/assets/inventory/cultivator-{male,female}-ink.webp`；固定笔墨参考遵循写意墨像技能。女修稿同时以男修举鼎稿对齐动作与石鼎构图。

| 素材 | 用途 | 规格 |
| --- | --- | --- |
| `apps/web/public/assets/body-cultivation/cultivator-male-cauldron.webp` | 男修炼体 | 640×960，RGBA WebP |
| `apps/web/public/assets/body-cultivation/cultivator-female-cauldron.webp` | 女修炼体 | 640×960，RGBA WebP |

五轨炼体使用对应性别的举鼎姿态；洗髓复用 `assets/manuals/cultivator-{male,female}-meditation.webp`。已检查真实透明通道与纸色合成，人物、石鼎、双手和双脚全部保留。上一版匿名调息修士不再接入。

页面以人物周围的六个修炼方向和右侧收益／用丹区组成。首屏仅保留称号、总等级、轨道等级、实际收益、进度与丹药；没有操作教学句、称号升级句或首屏溢出规则。洗髓灵根常驻展开。

## 页面验收

桌面实装保留了设计参考中的举鼎人物、环绕选项、左右分区和大字号效果数值。沿用现有道身导航与场景标题，未采用参考图自行改写的导航项目。去掉参考图中的装饰墨团和多余分隔线，避免与人物争夺注意力。

已用本地男女角色检查举鼎与静坐素材切换、五轨效果、洗髓灵根默认展开、原地丹药预览与服用。360px 触屏页面无横向溢出；预览可以关闭，提交后库存与进度同步更新。测试丹药已清理。数值展示以实际战斗公式核对，相关 72 项测试、lint、typecheck 与 build 通过。

## 男修提示词

```text
Edit the referenced existing male player portrait into a new BODY CULTIVATION pose for the same game character. Identity reference and ink style reference are the provided image, not a generic new man. Preserve the exact narrow youthful face, small restrained eyes and eyebrows, high topknot with the same hairpin, side hair locks, pale warm-grey robe with dark crossed collar and sash, lean proportions, and the same broad dry-brush ink texture. Repose the character in a three-quarter near-frontal full-body stone-cauldron lifting exercise: both hands grip and press a large ancient rough STONE DING cauldron above his head, elbows gently bent under weight, shoulders visibly braced, knees bent in a wide stable stance, both feet planted. This must instantly read as intense physical strength training, not meditation or a greeting. Cauldron is simple squat unadorned tripod stone vessel, chunky warm-grey ink masses with open pale patches, no carved ornament or writing. Keep character face recognizable from the reference, and keep it visible below the cauldron. Sleeves pulled back at the forearms, robe hem gathered to allow stance, same costume otherwise. Draw arms, hands, stone vessel and feet anatomically coherent and entirely inside the canvas. Warm-grey Chinese freehand ink painting, a few wide grey wash strokes, sparse dark anchors, dry-brush broken edges, internal white/transparent negative spaces, no detailed fabric rendering or muscle anatomy rendering. No saturated colors, no colored glow, no swirling energy, no aura, no smoke, no scenery, no ground plane, no shadow, no paper rectangle, no words or seals. True transparent background; single full-body male practitioner and the stone vessel he is lifting. Leave minimal safe framing margin, portrait composition.
```

## 女修提示词

```text
Create the FEMALE version of the stone-cauldron body cultivation pose. Image 1 is the exact female player identity and the fixed original ink style: preserve her slim oval face, small calm eyes, high simple bun, loose face-framing hair locks, crossed dark collar, warm-grey plain robe and dark waist sash. This must be recognizably the SAME WOMAN, not a newly designed character. Image 2 is only the approved full-body POSE and prop reference for this page: both hands lifting a massive rough stone tripod DING above head, braced shoulders, slightly bent elbows, lowered stable wide stance, complete visible feet. Use that same physical training action and similar single full-figure composition for the female character from image 1. Keep her feminine face and lean build; physical effort is expressed by load, stance and arms, not a bodybuilder physique or sexualized clothing. Sleeves pulled back enough to show braced forearms; otherwise same costume as female identity reference. Full figure and complete stone cauldron contained in canvas. Warm-grey Chinese freehand ink painting: broad grey brush masses, a few deep ink anchors, dry-brush directional white breaks, open negative spaces, no realistic rendered fabric, no dense folds, no digital lighting. Match both fixed identity reference and male companion's brush scale. Stone vessel is simple chunky unadorned grey ink masses, no written symbols, no dense carved patterns. Genuine transparent background, only woman and lifted stone vessel. No paper, ground, background, shadow, aura, smoke, particles, text, signatures or seals. Portrait composition, minimal safe margins.
```

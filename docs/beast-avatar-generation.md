# 灵兽头像生成记录

本批使用内置 imagegen 工具，以 `.agents/skills/daoyou-beast-avatars/references/thunder-peng-a-baseline.webp` 为风格参考。正式素材为 `public/assets/icons/beast-物种.webp`，256×256 透明 WebP、质量 90。仅替换注册表素材路径，不修改物种和个体数据。

六张首稿的棋盘格背景经过图像生成工具修正仍未透明，经用户明确授权改用本地 rembg / BiRefNet-general-lite 抠图，检查米白与深色底上的轮廓后导出；雪翎鹤保留原生 alpha。墨蛟采用修订稿，缩短角并收敛颈侧鳍。

## 固定提示

```text
Create ONE standalone square Chinese xianxia creature avatar on GENUINE TRANSPARENT background. The supplied eagle image is ONLY the STYLE reference: match its polished lightly realistic semi-dimensional painterly game-icon rendering, natural volume, expressive animal features, organized fur/feather/scales, soft upper-left light and muted rich colors. Do NOT copy eagle anatomy or blue palette onto another species. Compact silhouette fills 85% with all defining extremities inside a little transparent margin. Intended final 256x256 WebP, recognizable at 30px. No scene, text, frame, watermark, checkerboard, badge, geometric facets, thick outlines, plastic surfaces or floating magical symbols. 
```

## ink-jiao

```text
墨蛟: original mature Chinese JIAO water serpent, NOT an imperial true dragon. Dark ink-black teal scales, slender serpentine head, only two SHORT unbranched horns, delicate whiskers on sides of neck, restrained finned tail. Compact coiled S-shaped upper body and head in three-quarter profile, alert amber-green eye and closed predatory jaw. Show a small curved tail fin near bottom. No wings, no antlers, no mane, no flames, no giant claws. Keep the head large, readable coils and a few broad scale groups, subtle cyan light reflecting on dark scales.
```

## fire-crow

```text
火翎鸦: a CROW with unmistakable straight strong black corvid beak (not hooked eagle beak), black plumage with warm subtle sheen, deep crimson throat feathers and a few dark-red feathers under a folded shoulder. Smart watchful dark amber eye. Tight three-quarter head and shoulder portrait facing left, modest natural crown, smooth black feather volume. No eagle crest, no phoenix headdress, no orange fire surrounding body.
```

## snow-crane

```text
雪翎鹤: elegant snow-white CRANE with slender long straight grey-ivory beak, calm dark eye, gracefully curved long neck and pale silver long wing-tip feathers. A compact three-quarter portrait includes head, S-curved neck and one folded shoulder, enough neck silhouette to read crane immediately. Snow-white crown, no red cap. Pearl-grey shadow separates white feathers, silver feather ends, dignified tranquil expression. Not swan, not goose, not eagle.
```

## moon-marten

```text
月影貂: actual MARTEN mustelid, long slim muzzle, small ROUND ears, dark charcoal grey fur, silvery white chin/chest/belly and bushy long tail. Compact three-quarter head-and-upper-body portrait, tail curls alongside shoulder so its fluffy form is visible. Large but natural curious dark eyes, agile sly gentle expression. No fox triangular ears, no cat round face, no otter flattened tail. Fine fur grouped into softly modeled tufts, silver neck contrasts with dark coat.
```

## silverwing-mantis

```text
银翅螳螂: anatomically credible predatory PRAYING MANTIS with silver-grey natural chitin, triangular head, two compound eyes and two fine antennae, long narrow prothorax, two folded curved scythe-like raptorial FORELEGS with little inner spines, four slim walking legs, translucent thin wings folded against back. Compact three-quarter full insect portrait, triangular head and paired sickle forelegs dominant, wings subtle. All six legs attached correctly, no extra legs. Silver sage-grey palette, avoid grasshopper shape, robot metal, generic beetle or arms holding weapons.
```

## six-eyed-ape

```text
六目灵猿: grey-white long-haired APE, not a human, not a monkey with tail. Near-frontal close head-and-shoulders portrait to show EXACTLY SIX OPEN EYES: one main natural eye on each side of nose; plus TWO smaller spirit eyes stacked ABOVE the main eye on EACH side of brow, total THREE eyes left and THREE eyes right, six total. Clearly separate almond-shaped eyelids for all six, pale amber irises, no extra forehead central eye. Calm perceptive primate face, charcoal grey skin, silver-white fur framing face and shoulders, natural rounded ears, modest broad muzzle. No crown, no jewelry, no horns, no warpaint. Four small eyes must read as actual eyes not spots.
```

## ghost-lantern-butterfly

```text
冥灯蝶: a ghost-lantern BUTTERFLY, ink-navy blue wings with restrained softly luminous ghost-jade GREEN wing veins. Four distinct organic wing lobes (two broad upper wings, two rounded lower wings), slender dark butterfly body, two fine antennae. Compact full-body butterfly with naturally opened wings, slightly angled, physically credible wing texture, soft dimensional light and folded veins, elegant scalloped edges. No skull patterns, no eyespots, no floating lantern, no fire, no background aura. Jade vein glow stays confined to wings. Living mystical insect, NOT flat vector symmetry badge.
```


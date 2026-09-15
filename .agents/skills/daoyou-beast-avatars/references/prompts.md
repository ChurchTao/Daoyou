# 灵兽头像提示词骨架

生成前仍须查看同目录 `thunder-peng-a-baseline.webp`，文字不能替代图像基准。使用该图作为风格参考；编辑现有头像时另行明确编辑目标和必须保留的内容。

## 固定风格段

```text
Use case: stylized-concept.
Asset: ONE standalone square Chinese xianxia game creature avatar.
Reference: the supplied Thunder Peng A image is a STYLE reference for volume,
organic material, feather/fur detail density, edge finish and lighting only.
Do not copy its species, pose or palette onto a different creature.
Style: lightly realistic, semi-dimensional painted game icon with believable
animal anatomy, expressive eyes, softly sculpted volume and organized material
clumps. Match the reference's finish and detail hierarchy. Matte organic surfaces,
restrained saturation, soft upper-left lighting and warm-neutral highlights.
Composition: compact, readable silhouette; subject roughly 80–90% of the square,
key features fully inside frame. Species-appropriate head/shoulder or body framing.
Background: genuinely transparent alpha, clean edges, readable on cream-paper UI.
Final use: 256×256 WebP, also readable at 30px, 48px and 72px. Larger generation
is acceptable for a clean downsample; do not turn this into a full illustration.
Avoid: badge, geometric facets, thick outlines, shiny plastic, photographic microtexture,
scene, frame, lettering, watermark, floating element symbols or excessive magical effects.
```

## 每次替换的物种段

```text
Subject: [current species name, animal anatomy and distinctive body structures].
Palette/material: [species-defined fur/feathers/scales and their colors].
Expression: [temperament appropriate to this species].
Framing: [pose that keeps its defining features readable].
Must retain: [two or three key identifiers].
Must avoid: [specific anatomy or identity confusion relevant to this species].
```

## 雷鹏 A 构图复用示例

```text
Subject: Lei Peng, an eagle-like thunder raptor, not a phoenix or dragon.
Muted blue-teal swept-back crown, layered silver-white neck plumage, a small
deep-violet shoulder area, amber eye and powerful hooked golden beak with a dark tip.
Sharp intelligent side portrait looking right, close head-and-shoulders framing.
Large readable head, broad soft forehead volume, selective feather detail.
Only a tiny electric-blue glint integrated in the eye or feather edge.
No fully spread wings, tail fan, floating lightning bolts or heraldic symmetry.
```

这是固定基准的构图复用模板，不保证逐像素复现。生成后仍按 SKILL.md 的尺寸、物种与质感要求验收；不要因模板输出而直接认定达标。

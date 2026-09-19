# 地图素材清单

美术设计与验收遵循 [国画水墨地图 skill](../.agents/skills/daoyou-map-art/SKILL.md)。本清单仅记录生产素材，不保留母稿、提示词或构图模板。

| 用途 | 文件 | 静态 URL | 尺寸 | 大小 |
| --- | --- | --- | --- | ---: |
| 世界总览底画 | [world-overview-v1.webp](../public/assets/maps/world-overview-v1.webp) | `/assets/maps/world-overview-v1.webp` | 1536×1024 | 566,572 bytes |
| 天南区域底画 | [tiannan-region-v1.webp](../public/assets/maps/tiannan-region-v1.webp) | `/assets/maps/tiannan-region-v1.webp` | 1536×1024 | 809,114 bytes |

两张均为不透明背景图，已接入 `/game/map-v2` 的 Phaser 技术样板；不是节点图集。世界底画用于总览，天南底画用于独立区域。入口、地点、文字与命中区由交互层独立提供，锚点按各自构图确定。当前尚未制作其他区域或切片，现有规格不约束后续素材。

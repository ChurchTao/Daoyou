# 地图素材清单

美术设计与验收遵循 [国画水墨地图 skill](../.agents/skills/daoyou-map-art/SKILL.md)。本清单仅记录生产素材，不保留母稿、提示词或构图模板。

| 用途 | 文件 | 静态 URL | 尺寸 | 大小 | 接入状态 |
| --- | --- | --- | --- | ---: | --- |
| 世界总览底画 | [world-overview-v1.webp](../apps/web/public/assets/maps/world-overview-v1.webp) | `/assets/maps/world-overview-v1.webp` | 1536×1024 | 566,572 bytes | 已接入 |
| 天南区域底画 | [tiannan-region-v1.webp](../apps/web/public/assets/maps/tiannan-region-v1.webp) | `/assets/maps/tiannan-region-v1.webp` | 1536×1024 | 809,114 bytes | 已接入 |
| 乱星海区域底画 | [luanxinghai-region-v1.webp](../apps/web/public/assets/maps/luanxinghai-region-v1.webp) | `/assets/maps/luanxinghai-region-v1.webp` | 1536×1024 | 557,450 bytes | 已接入 |
| 慕兰区域底画 | [mulan-region-v1.webp](../apps/web/public/assets/maps/mulan-region-v1.webp) | `/assets/maps/mulan-region-v1.webp` | 1536×1024 | 720,578 bytes | 已接入 |
| 大晋皇朝区域底画（不含南疆、北境冰原） | [dajin-region-v1.webp](../apps/web/public/assets/maps/dajin-region-v1.webp) | `/assets/maps/dajin-region-v1.webp` | 1536×1024 | 782,562 bytes | 已接入 |
| 南疆区域底画 | [nanjiang-region-v1.webp](../apps/web/public/assets/maps/nanjiang-region-v1.webp) | `/assets/maps/nanjiang-region-v1.webp` | 1536×1024 | 760,402 bytes | 已接入 |
| 北境冰原区域底画 | [northland-region-v1.webp](../apps/web/public/assets/maps/northland-region-v1.webp) | `/assets/maps/northland-region-v1.webp` | 1536×1024 | 617,564 bytes | 已接入 |

上述七张均为不透明背景图，不是节点图集，已接入 `/game/map-v2`。入口、地点、文字与命中区由交互层独立提供，锚点按各自构图确定，新版不绘制节点连线。一级地图另标注天澜草原、天沙大陆、五龙海、无边海、极西之地、飓风沙漠，均显示“未开放”并禁用进入；这六区底画尚未制作，仅标注地理名称。现有规格不约束后续素材。

## 主节点子地图

| 用途 | 文件 | 静态 URL | 尺寸 | 大小 | 接入状态 |
| --- | --- | --- | ---: | ---: | --- |
| 太岳山脚至白水渡水路 | [taiyue-baishui-v1.webp](../apps/web/public/assets/maps/taiyue-baishui-v1.webp) | `/assets/maps/taiyue-baishui-v1.webp` | 1536×1024 | 514,998 bytes | 已接入 `/game/map-v2?area=TN_YUE_01`，三个地点热点由交互层叠加 |
| 开篇故乡与矿坡河谷 | [mine-valley-v1.webp](../apps/web/public/assets/maps/mine-valley-v1.webp) | `/assets/maps/mine-valley-v1.webp` | 1536×1024 | 650,852 bytes | 已接入 `/game/map-v2?area=TN_MINE_VALLEY`，矿棚、木桥、石滩、药婆家和村口渡口由交互层叠加 |

太岳底画可见山脚石亭、柳树、同岸芦苇渡埠和对岸白墙镇落。底画覆盖接引亭至白水渡水路，太岳山其余玩法在区域地点列表中。锚点见 [主节点区域内容](../packages/game-content/src/world/areas.ts)。

矿坡河谷用河分出矿坡和村岸。木桥表示平日的道路，桥下石滩和村岸之间保留河水。桥断、遇袭和御风分别在对应的演出及战斗中呈现。药婆家和村口渡口同在村岸。

## 宗门独立舆图

| 用途 | 文件 | 静态 URL | 尺寸 | 大小 | 接入状态 |
| --- | --- | --- | --- | ---: | --- |
| 白鹿书院宗门／访宗底画 | [bailu-academy-v1.webp](../apps/web/public/assets/maps/bailu-academy-v1.webp) | `/assets/maps/bailu-academy-v1.webp` | 1536×1024 | 683,964 bytes | 已接入，15个设施热点由交互层叠加 |

白鹿入宗演出另使用`/assets/sect/onboarding/bailu-v1.webp`（1536×1024，633,636 bytes）。验收与接入记录见[白鹿方案第14节](combat-v6-bailu-fangcun-sect-design.md#14-专属美术接入2026-10-27)。

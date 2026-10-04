# 御灵集货架

`beast-market.json` 配置天南·御灵集每次刷新的 8 个货格。`stock` 五项之和必须为 8；每个灵印货格从对应的 `books.normal` 或 `books.advanced` 池中不放回抽取。

每枚灵印的 `rarity` 可设为 `common`、`uncommon` 或 `rare`，抽取权重由 `rarityWeights` 控制。稀有度只影响上架概率，不参与定价。普通灵印统一使用 `prices.normalBook`；每枚上品灵印另有 `priceTier`，取 1–10 档，由 `prices.advancedBook.baseByTier` 提供基价，叠加 `fluctuation` 后按既有规则限制在 500000–5000000 灵石。两种灵露使用固定价格。新技能书须显式加入相应货池，且只能引用已注册的传承灵印。当前“高级定神”对应旧称“高级精神集中”，归低价档；“高级偷袭”归高价档。

化生果只在最高层货架出现，售价从 `prices.rejuvenationFruit` 区间抽取。

# 神秘储物袋奖池

在 `mystery-bags.json` 的 `pools` 中按 `common`（普通）、`fine`（精致）、`luxurious`（华贵）编辑。每条奖励的 `chanceBps` 是万分比，例如 `1250` 表示 12.5%。每档概率合计须为 `10000`，删除条目后需要重新分配概率。客户端预览与服务端抽奖共用配置，修改后需重新构建和发布。

| 类型 | 可配置字段 | 抽取方式 |
| --- | --- | --- |
| `spirit_stones` | `min`、`max` | 在包含上下限的整数区间内等概率抽取 |
| `item` | `item.definitionId`、`item.quantity`，可选 `maxQuantity`、`item.instanceData` | 发放指定的已注册奖励道具。配置 `maxQuantity` 时，在 `item.quantity` 至 `maxQuantity` 的含端点整数区间内等概率抽取数量 |
| `superior_book` | `quantity` | 在当前上品传承灵印中等概率抽取一种 |
| `blueprint` | `quantity`、`minRealm`、`maxRealm` | 在指定境界范围（含上下限）内的已注册道装图纸中等概率抽取一种 |
| `material` | `rank`、`quantity` | 从已发布的同品级草药、矿石、天材地宝、辅助材料和妖兽材料中抽取一种。该品级材料库为空时使用 `materialFallbacks` |

每次开袋只命中一条奖励，`quantity` 是命中后同一种道具的发放数量。

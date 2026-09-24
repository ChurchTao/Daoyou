# 宗门养成参数

`progression.json` 维护心法上限、人物等级余量、心法修炼费用和七层经脉解锁门槛／费用。保存后重新构建、启动生效；不是热更新。

- 心法修为 = expBase × expGrowth^(目标等级−1)，向上取整到 expRounding 的倍数。
- 心法灵石 = 已取整修为 × stonesPerExp，再向上取整到 stonesRounding 的倍数。
- 经脉修为 = expBase × expGrowth^min(层数−1, growthExponentCap)，灵石直接乘 stonesPerExp；不额外取整。
- insight 为道心感悟费用。经脉目前固定七层；修改层数属于玩法和模型变更。
- 全部等级费用在加载时计算校验，拒绝小数、溢出与过大费用；门槛必须递增。错误包含文件与字段。

修炼操作、战斗装配校验、前端上限与费用提示引用同一包。改变上限可能使已有心法等级不再满足装配条件，降低上限必须另行设计存量策略。本次仅等价迁移，无数据库或旧数据转换。

`formatVersion` 是配置结构格式，`contentRevision` 是内容修订记录；两者都不替代战斗、持久化或回放版本。

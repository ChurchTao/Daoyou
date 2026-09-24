# 通用掉落底座

此目录只依赖 Zod，不导入战斗、角色、物品、奖励适配器、数据库或运行时哈希 API。

`DropPoolSchema` 校验配置；`rollDrops(pool, stream)` 输出 `{ poolId, version, rewards }`。奖励仅包含不透明的 `rewardId`、数量和来源组 ID，底座不解释奖励含义。

每个组先以 `chance` 判定是否命中，再按 `weight` 从组内选择一个条目，最后在闭区间 `[min, max]` 中均匀抽取整数数量。组之间独立；固定奖励用单条目、`chance: 1`、相同的 min/max 表达。多个固定奖励使用多个组，不引入嵌套池或条件脚本。

```ts
const pool = DropPoolSchema.parse({
  id: 'example',
  version: 1,
  groups: [
    {
      id: 'supply',
      chance: 0.3,
      entries: [
        {
          rewardId: 'business.reward.a',
          weight: 3,
          quantity: { min: 1, max: 2 },
        },
        {
          rewardId: 'business.reward.b',
          weight: 1,
          quantity: { min: 1, max: 1 },
        },
      ],
    },
  ],
});
const result = rollDrops(pool, (groupId) => randomStreamFor(groupId));
```

`stream(groupId)` 返回取值范围 `[0, 1)` 的随机函数。需要重放的业务必须按事件身份、池版本、组 ID 创建确定性独立随机流；底座不创建随机种子，不调用全局随机数。修改一个组不应改变其他组的随机流。

业务方决定触发条件、池选择和调用次数，冻结本次配置与具体奖励结果；发放方负责解析奖励、生成个体、幂等与事务。不要在底座中添加胜负、人物等级、背包容量或发奖逻辑。

首个接入示例为 `src/shared/rewards/wild.ts`，属于业务适配层。它不是底座依赖，也不是其他业务接入时必须继承的基类。

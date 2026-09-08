# 测试规范

项目只维护两层测试，不增加第三套 `scripts/*smoke*`、`*e2e*` 或一次性测试框架。

## 1. 纯单元测试

- 仅放在 `src/shared`，验证确定性、可复用的引擎和领域逻辑。
- 使用 Vitest；先运行受影响的测试，再根据影响范围运行 `bun run test`。
- 不引入数据库、Redis、HTTP、认证或第三方服务模拟；不在 `src/server`、`src/react-app` 或 `scripts` 添加单元测试。

## 2. Codex 浏览器／Playwright 模拟

由 Codex 在当次开发任务中操作真实本地页面，不将操作固化为一次性仓库脚本。

1. 准备 `env/local.env`，执行 `bun run services up -d --wait` 和 `bun run db:migrate`。普通验证使用 `bun run dev`；长流程需关闭 watch 时，在两个终端执行 `APP_ENV=local NODE_ENV=development bun --env-file=env/local.env src/index.ts` 和 `bun run dev:web`。确认页面为 `127.0.0.1:5174`、服务指向专用本地数据；不得使用 `prd` 进行测试写入。
2. 列出本次改动需要验证的用户行为、预期结果和准备条件。通过页面注册／登录，邮件验证使用 Mailpit；优先复用已有测试角色。缺少 LLM 或角色构筑等条件时如实说明，不通过假成功继续。
3. 使用可用的 Codex 浏览器能力或 Playwright，按可访问名称和实际页面定位控件。操作后等待具体界面／网络状态，不依赖固定长时间 sleep。多人测试使用独立浏览器上下文或配置文件，每个角色有独立会话。
4. 同时观察界面、控制台和网络：检查请求次数、错误、权限边界、提交结果及恢复过程。涉及布局时检查桌面和 360px；涉及性能时使用网络面板／Profiler，不维护一次性基准脚本。
5. 多人战按本次改动选择场景：收令、重复点击、超时、断线重连、逐行动播放、终局和回放权限。故障恢复可在本地暂停／重启实际服务后观察，不添加模拟故障 Worker 或另一套接口测试程序。
6. 测试完成后退出或结束当次创建的活动状态，恢复暂停的服务；只清理本次测试数据，不重置整个环境。
7. 记录环境、验证步骤、实际结果和未验证项。截图、网络记录等留在当次任务产物中；不得把旧验证记录当成本轮通过证据。

Lint、TypeScript／构建、Prettier 是静态质量检查，不是额外一层集成测试。根据改动运行必要检查；不以新增脚本替代真实用户流程验证。

## 3. 本地测试账号与密码

- 本地测试账号统一密码：`LocalCombat123!`。仅用于 `env/local.env` 对应的纯本地环境，不适用于预发布或生产账号。
- 优先复用已有账号与角色。已知账号包括 `local1@daoyou.local` 至 `local8@daoyou.local`，实际是否存在、邮箱是否验证及角色状态以当前本地数据库为准，不假定环境重建后仍然保留。
- 需要选择账号时，可直接只读查询本地 PostgreSQL（`127.0.0.1:15432`，数据库 `daoyou_local`）的 `better_auth.user` 与角色表，读取邮箱、验证状态和所需角色信息；无需再次向用户索要已有测试账号或统一密码。不读取或输出密码哈希、会话令牌等无关认证数据。
- 使用真实页面和上述密码登录。邮箱未验证时，通过 Mailpit（`http://127.0.0.1:18025`）完成正常验证流程，不直接修改数据库中的验证标记或认证状态。
- 缺少账号时通过页面注册本地测试账号，并沿用统一密码；已有账号登录失败时先确认环境、账号存在性及邮箱验证状态，不擅自重置密码或修改认证配置。
- 多人测试使用独立浏览器上下文或配置文件，确认每个会话实际登录的角色，避免共享 Cookie 将多人测试变成同账号多标签页。

## 4. 本地物资发放与角色调整

`POST http://127.0.0.1:3001/api/dev/resources` 不要求登录，仅在显式 `APP_ENV=local` 且 `NODE_ENV` 非 production 时注册；缺省、预发布及生产不开启。不要将 local 配置用于外部可访问的部署。

先只读查询已有测试角色 ID，然后提交 JSON，例如：

```json
{
  "cultivatorId": "替换为已有本地角色的UUID",
  "grants": [
    {
      "type": "item",
      "item": { "definitionId": "blueprint.weapon.10", "quantity": 1 }
    },
    {
      "type": "vault-material",
      "facts": { "name": "验收玄铁", "type": "ore", "rank": "凡品" },
      "quantity": 1
    },
    { "type": "spirit-stones", "amount": 1000 },
    { "type": "qi", "amount": 20 }
  ]
}
```

新库存材料使用 `type: item`、`definitionId: material.v1`、`instanceData: { name, type, rank, element?, description? }`。兽诀使用注册的定义 ID；随机道装使用 `{ "type": "equipment", "slot": "weapon", "level": 10 }`。全部定义在 `src/shared/items/definitions`，参数边界见 `src/shared/contracts/forging.ts`。

发放遵循正式背包容量、材料校验、资源上限和战斗占用规则，整批事务成功或整体回滚。不支持修改任意字段、账号创建或整库清空。测试前记录物资与资源基准，完成后只清理本次发放和生成的测试物品；保留其他测试已产生的角色进度及历史记录。

灵兽可通过同一发放接口提交 `{ "type": "beast", "speciesId": "combat.wild.species.rock-boar" }`（speciesId 必须来自灵兽定义）。生成标准 10 级个体，遵循兽栏容量；不会自动携带或设为首发，随后使用正式阵容接口配置。

`PATCH http://127.0.0.1:3001/api/dev/cultivators/:id` 使用相同的纯本地环境限制，无需登录。只读查询已有角色 UUID 后，可按需提交以下白名单字段：

```json
{
  "realm": "金丹",
  "realmStage": "初期",
  "attributes": { "vitality": 1000, "strength": 1000 },
  "unallocatedAttributePoints": 0,
  "spiritStones": 10000,
  "reputation": 0,
  "resources": { "hp": 10000, "mp": 10000 }
}
```

所有数值为新绝对值，省略字段保持原值。基础属性支持 vitality、strength、spirit、endurance、speed、willpower（1–10000）；待分配属性点 0–100000、灵石 0–100000000、声望 0–1000000。resources 必须同时给出 hp、mp（0–10000000），按调整后 v6 构筑的资源上限裁剪。不自动分配属性、补满资源或迁移宗门深度。

空对象、未知字段、非法境界或越界值返回 400；不存在或非活跃角色、战斗占用返回 409。角色调整采用角色锁和数据库事务，提交后更新资源版本；脚本发起的变更后应刷新页面获取新数据。禁止修改用户归属、认证、角色状态等任意数据库字段。测试结束恢复事先记录的境界、属性和准备性资源改动，保留实际玩法奖励与战绩。

同一接口支持调整角色**当前已加入宗门**的数据，例如解锁长老试炼验收：

```json
{
  "sect": {
    "discipleRank": "inner",
    "contribution": 3000,
    "lifetimeContribution": 3000
  }
}
```

`sect` 至少填写一个字段；弟子身份为 `registered`、`outer`、`inner`、`true`，两类贡献为 0–100000000 的整数绝对值，省略保持原值。调整后的累计贡献不得小于可用贡献，否则返回 409；角色没有 active 宗门成员记录也返回 409。可与境界／属性调整放在一次请求中，整笔事务成功或回滚，并更新宗门成员、任务和角色资源版本。此能力只准备身份与贡献，不执行正式晋升、不生成晋升资格、不修改任务完成记录、职务或宗门归属。准备前记录基准，验收后恢复身份、贡献等准备字段，保留真实试炼战绩与资格记录。

突破试炼验收可使用同一 PATCH 接口补齐准备条件：

```json
{
  "realm": "元婴",
  "realmStage": "圆满",
  "cultivation": { "experience": 100000, "insight": 90 },
  "breakthroughPreparation": {
    "clearMind": true,
    "protectMeridians": true,
    "completedDungeonObjectiveIds": ["clear-archive"]
  }
}
```

`cultivation` 的 experience 为 0–1000000000000 整数修为绝对值，insight 为 0–100 整数感悟；修为上限仍按调整后的境界实时计算，不写入 exp_cap。两个准备对象均不能为空，省略字段不变。清心／护脉 true 添加带 devTools 标记的系统状态，false 只移除本接口添加的对应状态，保留正常玩法已有状态。

调整 realm、realmStage 或 breakthroughPreparation 时会同步当前破境任务，确保准备目标有对应任务。通过外部 dev 请求准备后应刷新浏览器再开始验收，避免页面沿用先前角色缓存。10F 实际运行记录及准备数据去向见 [阶段验收记录](./combat-v6-phase-10f-breakthrough-plan.md#73-解锁后的真实运行验收2026-09-08-至-09)。

`completedDungeonObjectiveIds` 只接受当前大境界破境任务中 kind 为 complete_dungeon 的目标 ID，用于跳过验收准备所需的长秘境流程，不创建秘境通关记录或奖励。未知目标及 win_task_challenge 战斗目标返回 409，整笔联合调整回滚；不能用本接口直接制造试炼胜利。真实试炼胜负、灵兽消耗、任务推进和最终突破必须通过正式页面完成。准备前记录境界、六属性、资源、修为、感悟及任务目标基准；验收记录须区分 dev 准备目标和真实战斗完成目标，结束后恢复临时角色字段并移除 dev 状态，不把准备数据记作真实验收证据。

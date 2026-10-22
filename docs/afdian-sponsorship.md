# 爱发电功德簿运行手册

## 能力边界

当前实现不依赖 OAuth2。爱发电 Webhook 负责低延迟通知，开放 API 负责二次核验、定时补单与私信认领码。功德谢信会写明当次入账的声望，也不会根据爱发电昵称猜测游戏账号。命中功德档位的订单在履约到角色时，按该档「每月声望 × 订单 `month`」直接增加角色声望；月数缺失或小于 1 时不发放，撤销订单不扣回。玩家在功德簿的「续添功德」里能看到各档每月声望，以及订阅的每日物资。`product_type = 0` 且命中订阅方案的订单，会按 `query-sponsor` 的 `expire_time` 维持订阅期限；角色上线时按上海日历日寄出一封感谢信，未上线的日子不补发。

`SponsorshipProvider` 是编译期接口，内置 `afdian` 适配器；开源部署者可以替换适配器代码，但服务端不会加载任意运行时 JavaScript。四个功德档位的名称和主题固定，管理端可调整其 `plan_id`、最低金额和每月声望，以及独立的订阅方案列表、等级和每日物资。每月声望默认依次为 50、200、400、900。

档位解析遵循爱发电官方订单字段语义：非空 `plan_id` 必须命中管理端映射，固定方案即使发生折扣也按映射档位；只有官方定义的空 `plan_id` 自选金额订单才按 `total_amount` 命中金额门槛。未映射的非空方案不会降级成自选金额订单。

## 订单与订阅归属

- 付款人只用于爱发电订单核验。游戏内订单按有效下单意图固化 `recipient_cultivator_id`；站外订单通过一次性私信认领码确定收件角色。同一付款人可以支持不同角色，不再检查或自动修改旧的 `sponsorship_provider_links`。
- 功德记录、当笔声望和谢信归订单收件角色。已经履约的订单不会因订阅转移、重试或后续付款改变归属。失效下单意图、已删除或非活跃收件角色进入人工核查，不回退发给历史绑定角色。
- 订阅权益按 `provider + provider_user_id + afdian_plan_id` 唯一，首次建立时使用该订单收件角色；续费只更新期限，保留原受益角色。旧绑定表留存，但不再作为履约或订阅归属依据。
- 管理端「人工处理 → 转移订阅受益角色」单独转移指定订阅，包含原归属校验与审计。跨游戏账号的转移由管理员核实后操作，不迁移历史功德、声望或谢信。
- 每个角色每天仍只收一份最高有效档位物资；同时以 `subscription_term_id + grant_date` 限制同一订阅每天一次。发放与转移锁定同一订阅行，转移当天已寄出的物资不再给新角色补寄；下一上海日历日寄给新受益角色。角色删除后保留订阅身份和每日发放记录，避免通过重新分配重复领取。
- 当前没有爱发电 OAuth，付款前无法识别浏览器实际使用的爱发电账号。入口显示本次功德收件角色及订阅沿用规则；付款后的订单详情展示该方案实际的订阅受益角色。

## 上线顺序

1. 停机维护并执行主库 Drizzle migration，确认新增的 `wanjiedaoyou_sponsorship_*` 表和唯一索引存在。`0067_sponsorship_order_recipients` 从原功德记录、已认领记录、已匹配下单意图回填订单收件角色，保留历史已履约状态和奖励；已有订阅保留其受益角色，能明确对应的历史每日发放关联到订阅身份。
   - 迁移前检查 `sponsorship_subscription_terms` 的 `provider + provider_user_id + afdian_plan_id` 是否重复。同一订阅有多个历史受益角色时需先人工核查；新唯一索引会拒绝歧义数据，不自动删除或合并权益。
   - API 与 SPA 配套更新后再启动。原「改绑爱发电用户」接口已替换为指定订阅转移，不能继续用旧前端执行管理操作。
2. 确认 Redis 与 NATS JetStream 健康；订单按 Redis 单订单锁串行，数据库唯一约束是最终幂等防线，不使用 PostgreSQL advisory/task lock。
3. 配置 `AFDIAN_USER_ID`、`AFDIAN_TOKEN`。
4. 先设置 `SPONSORSHIP_PROVIDER=afdian`、`SPONSORSHIP_FULFILLMENT_ENABLED=false` 启动应用，在 `/admin/sponsorship` 填写真实方案 ID 和金额并测试连接。首次保存有效方案时，服务端会自动固化“自动处理起始时间”；管理员不能改写它。
5. 在爱发电配置 Webhook 地址：`https://<API域名>/api/sponsorship/providers/afdian/webhook`。该入口限制 256 KiB，请勿经代理改写 JSON。
6. 观察签名校验、API 二次核验和 NATS consumer 正常后，将 `SPONSORSHIP_FULFILLMENT_ENABLED=true` 并重启。此前已核验订单会由十分钟补偿任务继续履约。

## 数据与任务

- 每个成功订单按 `provider + provider_order_id` 唯一；每个订单最多生成一条功德记录和一枚认领码。
- Webhook 和定时对账只会自动处理起始时间之后的订单；更早或缺少创建时间的订单不会生成认领码，历史订单继续由管理员手动发放。
- 原始 Webhook、查询和对账响应以 JSON 保存，默认两年清理；订单身份与金额字段同步脱敏。认领码保留哈希用于一次性校验，原码用于私信失败后的重试。
- NATS WorkQueue 每 10 分钟运行近期对账与失败补偿；每天运行深度对账和敏感数据清理。Nest cron 只发布命令，Redis job lock 防止多实例并发。
- Webhook、NATS 和 API 都可能重复到达；消费者、Redis 单订单锁、状态条件更新和数据库唯一约束共同保证幂等。

## 排障

管理端可查看订单校验/履约状态、订单收件角色及订阅受益角色，重试订单、轮换已有未使用认领码、撤销错误留名、手动发放历史功德或转移指定订阅。游戏内已确定收件角色的订单不开放认领码轮换。旧 `PROVIDER_LINK_CONFLICT` 订单由补偿任务按固化收件角色重新处理，其余需要人工核查的错误不会被一并放开。原始快照只通过带管理员鉴权的审计接口查看，每次查看都会写入 `sponsorship_admin_actions`。

若爱发电 API、Redis 或 NATS 不可用，保持 `SPONSORSHIP_FULFILLMENT_ENABLED=false`；恢复后先执行 `/internal/cron/sponsorship-deep-reconcile`（Bearer `CRON_SECRET`），核对订单再重新开启自动履约。

# 爱发电功德簿运行手册

## 能力边界

当前实现不依赖 OAuth2。爱发电 Webhook 负责低延迟通知，开放 API 负责二次核验、定时补单与私信认领码。游戏不会发放数值奖励，也不会根据爱发电昵称猜测游戏账号。

`SponsorshipProvider` 是编译期接口，内置 `afdian` 适配器；开源部署者可以替换适配器代码，但服务端不会加载任意运行时 JavaScript。四个档位、名称和主题固定，管理端只允许调整 `plan_id` 和按分计的最低金额。

档位解析遵循爱发电官方订单字段语义：非空 `plan_id` 必须命中管理端映射，固定方案即使发生折扣也按映射档位；只有官方定义的空 `plan_id` 自选金额订单才按 `total_amount` 命中金额门槛。未映射的非空方案不会降级成自选金额订单。

## 上线顺序

1. 执行主库 Drizzle migration，确认新增的 `wanjiedaoyou_sponsorship_*` 表和唯一索引存在。
2. 确认 Redis 与 NATS JetStream 健康；订单按 Redis 单订单锁串行，数据库唯一约束是最终幂等防线，不使用 PostgreSQL advisory/task lock。
3. 配置 `AFDIAN_USER_ID`、`AFDIAN_TOKEN`。
4. 先设置 `SPONSORSHIP_PROVIDER=afdian`、`SPONSORSHIP_FULFILLMENT_ENABLED=false` 启动应用，在 `/admin/sponsorship` 填写真实方案 ID 和金额并测试连接。首次保存有效方案时，服务端会自动固化“自动处理起始时间”；管理员不能改写它。
5. 在爱发电配置 Webhook 地址：`https://<API域名>/api/sponsorship/providers/afdian/webhook`。该入口限制 256 KiB，请勿经代理改写 JSON。
6. 观察签名校验、API 二次核验和 NATS consumer 正常后，将 `SPONSORSHIP_FULFILLMENT_ENABLED=true` 并重启。此前已核验订单会由十分钟补偿任务继续履约。

## 数据与任务

- 每个成功订单按 `provider + provider_order_id` 唯一；每个订单最多生成一条功德记录和一枚认领码。
- Webhook 和定时对账只会自动处理起始时间之后的订单；更早或缺少创建时间的订单不会生成认领码，历史订单继续由管理员手动发放。
- 原始 Webhook、查询和对账响应以 JSON 保存，默认两年清理；订单身份与金额字段同步脱敏。认领码保留哈希用于一次性校验，原码用于私信失败后的重试。
- NATS WorkQueue 每 10 分钟运行近期对账与失败补偿；每天运行深度对账和敏感数据清理。Bun cron 只发布命令，Redis job lock 防止多实例并发。
- Webhook、NATS 和 API 都可能重复到达；消费者、Redis 单订单锁、状态条件更新和数据库唯一约束共同保证幂等。

## 排障

管理端可查看订单校验/履约状态，重试订单、轮换并重发认领码、撤销错误留名、手动发放历史功德。原始快照只通过带管理员鉴权的审计接口查看，每次查看都会写入 `sponsorship_admin_actions`。

若爱发电 API、Redis 或 NATS 不可用，保持 `SPONSORSHIP_FULFILLMENT_ENABLED=false`；恢复后先执行 `/internal/cron/sponsorship-deep-reconcile`（Bearer `CRON_SECRET`），核对订单再重新开启自动履约。

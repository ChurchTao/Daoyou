# 洞府灵田迁移备注

执行 Drizzle 迁移 `0033_spirit_fields.sql`（或 `bunx drizzle-kit migrate`）。

PR #54 从未进入 `master`，因此本版本不提供旧灵田、旧地块或旧灵种的兼容与清理脚本。`0033_spirit_fields.sql` 仅负责创建全新的 `wanjiedaoyou_spirit_fields` 业务表。

# 灵田 V2 迁移备注

1. 执行 Drizzle 迁移 `0032_spirit_fields.sql`（或 `bunx drizzle-kit migrate`）。
2. 若环境曾跑过 PR54 V1（`game_settings.spiritField`），再执行 `legacy_pr54_state.sql`：
   - 保留等级 / 收获 / 照料累计
   - 清空在种地块与 V1 灵种
   - `starter_claimed=false`，可再领 V2 新手种
3. 切勿先删 `game_settings.spiritField` 再迁表。

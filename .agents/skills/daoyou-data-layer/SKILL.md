---
name: daoyou-data-layer
description: Daoyou Drizzle/PostgreSQL、事务、V6 角色与宗门归属、统一背包、Redis 战局和回放归档指南。Use when modifying schema, migrations, repositories, persistence mappers, resource commits or durable game models. Covers Better Auth's separate migration stream and legacy storage boundaries.
---

# Daoyou Data Layer

## Locate the Current Write Path

Read `drizzle.config.ts`, `drizzle.auth.config.ts`, `src/server/lib/drizzle/db.ts` and the relevant definitions in `src/server/lib/drizzle/schema.ts`. Follow the route → service → repository/SQL path before treating a table or DTO as authoritative. Historical migration/design files describe intent; they do not prove a deployed database has applied it.

## Database and Transactions

- Business tables use the main `wanjiedaoyou_*` migration stream in `drizzle/`. Better Auth uses `src/server/lib/auth/schema.ts`, `drizzle.auth.config.ts` and `drizzle-auth/`, with fixed `better_auth` schema and independent history.
- Runtime uses a module-level `pg.Pool` and `drizzle-orm/node-postgres`, not Bun SQL. `DATABASE_URL` supplies the connection; `DB_MAX_CONNECTIONS` controls pool size. Session settings live in `db.ts`.
- Reuse `db`, `getExecutor(tx?)`, `DbExecutor` and `DbTransaction`; do not create parallel DB layers or feature-local pools.
- Pass the executor through every nested write. `runDbTasks(executor, tasks)` serializes work on a transaction's single connection and permits parallel pool reads; do not replace it with unconditional `Promise.all`.
- Reuse the owning mutation flow (`CommandExecutors.ts`, `InventoryService.ts`, or the relevant V6 service). Preserve locks, ownership predicates, expected revisions, idempotency and resource event commits; raw SQL success alone does not complete a player mutation.
- `ResourceEventCommitter.ts` and `playerStateRepository.ts` maintain resource scopes/versions/events and request records. Publish updates only through the existing post-commit path.

## Authoritative Models

Table names below omit the `wanjiedaoyou_` prefix. The exact names and constraints are defined in `schema.ts`.

| Domain | Storage | Runtime entrypoints |
| --- | --- | --- |
| Character identity, permanent six attributes, condition | `cultivators` | `cultivatorRepository.ts`, `services/cultivator`, V6 condition services |
| Personal manuals and active slots | `cultivator_manual_states`, `cultivator_manual_slots` | `characterLoadoutRepository.ts`, `CombatV6ManualService.ts` |
| Bag/storage item instances | `inventory_items` | `InventoryService.ts`, `src/shared/inventory`, `src/shared/items` |
| Equipped V6 equipment | `cultivator_equipment_slots` | `characterLoadoutRepository.ts`, `InventoryService.ts` |
| Beasts and lineups | `cultivator_beasts`, `cultivator_beast_lineups` | `combatV6BeastRepository.ts`, `CombatV6BeastService.ts` |
| Sect progression | `sect_combat_states`, `sect_method_progress`, `sect_meridian_loadouts`, `sect_meridian_nodes` | `sectCombatRepository.ts` |
| V6 history/replays | `combat_replay_archives`, `combat_replay_participants` | `combatV6ReplayRepository.ts` |

Repository names resolve under `src/server/lib/repositories`; V6 service names resolve under `src/server/lib/services/combat-v6`.

### Ownership and JSON

- Personal assets belong directly to `cultivators.id`. Sect state, methods and loadouts belong to `sect_memberships.id`; nodes belong to a loadout. Do not recreate a shared build-profile parent or transfer personal assets with sect progression.
- Equipment slots reference inventory owner and item ID together. Preserve that composite FK and clear equipment references through the existing mutation flow when moving/removing items.
- Inventory stores definition, quantity, location, slot, revision and instance facts. Parse via `InventoryItemSchema`, definition-specific schemas and `inventoryItemOf`; use existing stack-key helpers. A domain `spec` field does not imply storage in the old `consumables` table.
- Current bag consumables use `inventory_items` with definition `consumable.v1`; `BagConsumables.ts` parses `instanceData` into consumable facts including `spec`.
- Beast row ID/owner are authoritative; use `beastIndividualData` / `beastFromRow` rather than duplicating identity in JSON. Starter claim time is independent of beast lifetime.
- Runtime combat assembly uses independent personal assets plus optional sect progress for display. Do not persist projected units/panels as the character build authority. See `docs/combat-domain-ownership.md`.
- `cultivators.condition` remains the persistent condition field. Do not restore `persistent_state` / `persistent_statuses` or old consumable `effects` / `use_spec` / `details` contracts.

### Redis, Messages and Replays

- Redis is authoritative for active V6 battle state, commands and RNG. Inspect `CombatV6RuntimeStore.ts` and the mode-specific stores for CAS revisions, occupancy, expiry and outboxes; do not substitute process-local sessions.
- Access Redis through `src/server/lib/redis`; NATS through `src/server/lib/nats`. `src/server/lib/mq/combatV6Messaging.ts` coordinates terminal/replay publication and archival.
- PostgreSQL V6 archives enforce source/idempotency uniqueness. Replay participants intentionally do not cascade from character deletion; the battle archive owns their lifecycle.
- Keep settlement, resource events and replay delivery idempotent across retries. Read `docs/nats-domain-events.md` together with the relevant consumer before changing message boundaries.

## Legacy Boundary

- `creation_products`, `materials` and `consumables` still have residual code paths. Inspect their actual callers before modifying or deleting them; they are not fallback sources for V6 equipment/manuals or the unified bag.
- Legacy product views use `src/shared/legacy/products.ts`. Do not restore creation-v2 rehydration / `battleProjection` or treat `creation_products.is_equipped` as current V6 equipment state.
- `/api/battle-records/*` returns 410. V6 history uses the combat replay repository, not `battle_records_v2`.
- `battle_records_v3`, `battle_replay_archives` and `bet_battles` are deprecated historical schema, with deletion deferred by release policy. Read `docs/combat-v6-legacy-table-retirement.md` for that policy, but verify exact table names against schema. Do not generate DROP migrations simply while cleaning up skills or legacy references.
- Do not infer that every older table is still present, or already physically deleted, from a DTO, directory or migration file alone.

## Verify

- Business schema changes: inspect generated SQL, snapshot and `drizzle/meta/_journal.json`; preserve published migrations. Apply only to the intended environment.
- Auth schema changes: use `auth:generate` / `auth:migrate` with explicit environment selection, and inspect `drizzle-auth/` independently.
- Persistence changes: inspect transaction propagation, JSON parsers, ownership and resource commits, then lint/build and focused local runtime checks per `docs/testing.md`.
- Do not add repository, service, Redis or database unit tests. Pure reusable shared parsers/rules may have focused shared tests.

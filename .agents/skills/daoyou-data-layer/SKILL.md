---
name: daoyou-data-layer
description: Daoyou Drizzle/PostgreSQL、事务、V6 角色与宗门归属、统一背包、Redis 战局和回放归档指南。Use when modifying schema, migrations, repositories, persistence mappers, resource commits or durable game models. Covers Better Auth's separate migration stream and legacy storage boundaries.
---

# Daoyou Data Layer

## Locate the Current Write Path

Follow the affected route through its service and repository to `apps/api/src/lib/drizzle/schema.ts` or the auth schema. Check the target database's migration history when its deployed shape matters. Follow the shared persistence and verification rules in [AGENTS.md](../../../AGENTS.md).

## Database and Transactions

- Business schema changes use `drizzle.config.ts` and `drizzle/`. Better Auth changes use `apps/api/src/lib/auth/schema.ts`, `drizzle.auth.config.ts` and the independent `drizzle-auth/` history for the fixed `better_auth` schema.
- Reuse the shared client and executor types from `apps/api/src/lib/drizzle/db.ts`. Pass the same executor through nested writes. Use `runDbTasks(executor, tasks)` to serialize queries on a transaction's single connection while allowing parallel pool reads.
- Reuse the owning mutation flow (`CommandExecutors.ts`, `InventoryService.ts`, or the relevant V6 service). Preserve locks, ownership predicates, expected revisions, idempotency and resource event commits.
- `ResourceEventCommitter.ts` and `playerStateRepository.ts` maintain resource scopes/versions/events and request records. Publish updates only through the existing post-commit path.

## Authoritative Models

Table names below omit the `wanjiedaoyou_` prefix. The exact names and constraints are defined in `schema.ts`.

| Domain | Storage | Runtime entrypoints |
| --- | --- | --- |
| Character identity, permanent six attributes, condition | `cultivators` | `cultivatorRepository.ts`, `cultivator/application/readers`, V6 condition services |
| Personal manuals and active slots | `cultivator_manual_states`, `cultivator_manual_slots` | `characterLoadoutRepository.ts`, `CombatV6ManualService.ts` |
| Bag/storage item instances | `inventory_items` | `InventoryService.ts`, `packages/game-rules/src/inventory`, `packages/game-domain/src/items` |
| Equipped V6 equipment | `cultivator_equipment_slots` | `characterLoadoutRepository.ts`, `InventoryService.ts` |
| Beasts and lineups | `cultivator_beasts`, `cultivator_beast_lineups` | `combatV6BeastRepository.ts`, `CombatV6BeastService.ts` |
| Sect progression | `sect_combat_states`, `sect_method_progress`, `sect_meridian_loadouts`, `sect_meridian_nodes` | `sectCombatRepository.ts` |
| V6 history/replays | `combat_replay_archives`, `combat_replay_participants` | `combatV6ReplayRepository.ts` |

Repository names resolve under `apps/api/src/lib/repositories`; V6 service names resolve under `apps/api/src/combat/application`.

### Ownership and JSON

- Personal assets belong directly to `cultivators.id`. Sect state, methods and loadouts belong to `sect_memberships.id`; nodes belong to a loadout. Do not recreate a shared build-profile parent or transfer personal assets with sect progression.
- Equipment slots reference inventory owner and item ID together. Preserve that composite FK and clear equipment references through the existing mutation flow when moving/removing items.
- Parse inventory rows via `InventoryItemSchema`, definition-specific schemas and `inventoryItemOf`. Use existing stack-key helpers.
- Current bag consumables use `inventory_items` with definition `consumable.v1`; `BagConsumables.ts` parses `instanceData` into consumable facts including `spec`.
- Beast row ID/owner are authoritative; use `beastIndividualData` / `beastFromRow` rather than duplicating identity in JSON. Starter claim time is independent of beast lifetime.
- Runtime combat assembly uses independent personal assets plus optional sect progress for display. Do not persist projected units/panels as the character build authority. See `docs/combat-domain-ownership.md`.
- `cultivators.condition` remains the persistent condition field. Do not restore `persistent_state` / `persistent_statuses` or old consumable `effects` / `use_spec` / `details` contracts.

### Redis, Messages and Replays

- Redis is authoritative for active V6 battle state, commands and RNG. Inspect `CombatV6RuntimeStore.ts` and the mode-specific stores for CAS revisions, occupancy, expiry and outboxes.
- PostgreSQL V6 archives enforce uniqueness on source and idempotency key. The battle archive owns participant rows, which survive character deletion.
- Keep settlement, resource events and replay delivery idempotent across retries. Read `docs/nats-domain-events.md` together with the relevant consumer before changing message boundaries.

## Legacy Boundary

Use the authorities above for V6 equipment, manuals and bag reads and writes. The legacy treasury and exchanges still consume older product, material and consumable records. Verify current callers before changing these tables. Check the [retirement policy](../../../docs/combat-v6-legacy-table-retirement.md) and the target database's migration history before removing any historical table.

## Verify

- For business schema changes, inspect generated SQL, snapshot and `drizzle/meta/_journal.json`. Preserve published migrations and apply changes only to the intended environment.
- For auth schema changes, select the environment explicitly when using `auth:generate` and `auth:migrate`. Inspect `drizzle-auth/` independently.
- For persistence changes, inspect transaction propagation, JSON parsers, ownership and resource commits. Follow [the local verification procedure](../../../docs/testing.md).

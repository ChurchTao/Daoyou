---
name: daoyou-game-core-domain
description: Daoyou combat-v6 战斗内核、规则、人物投影、宗门、道装、功法、召唤灵及共享物品规则指南。Use when modifying shared combat rules, character attributes, sect content, equipment, manuals, beasts, forging, inventory or reward domain logic. Persistence and server orchestration belong to the data-layer and backend skills.
---

# Daoyou Game Core Domain

## Locate the Owning Layer

Use the current modules and their callers for runtime behavior. See `docs/architecture-boundaries.md` for package ownership and `docs/combat-v6-engine-history.md` for earlier designs.

| Task | Code entrypoints |
| --- | --- |
| Turn pipeline, commands, effects, RNG, sessions | `packages/combat-core/src` |
| Daoyou combat formulas | `packages/game-rules/src/combat/daoyou` |
| Character panel and assembly | `packages/game-rules/src/combat/projection`, `packages/game-rules/src/character/display.ts` |
| Sect methods, skills, meridians | `packages/game-content/src/sects`, `packages/game-rules/src/sects`, `packages/game-rules/src/sects/progression` |
| Equipment compilation and generation | `packages/game-rules/src/equipment`, `packages/game-rules/src/forging` |
| Manual definitions and progression | Models/commands in `packages/game-domain/src/manuals`, numeric tables in `game-content/manuals`, calculations in `game-rules/manuals` |
| Beasts, encounter orchestration, wild encounters | `packages/game-rules/src/beasts`, `packages/game-rules/src/combat/encounter`, `packages/game-rules/src/combat/wild` |
| Tower, breakthrough, sect tasks and dungeon battles | `packages/game-rules/src/tower`, `packages/game-rules/src/combat/{breakthrough,sect,dungeon,ranking}`; models in game-domain and numeric presets in game-content |
| Hunts and world map | `packages/game-rules/src/hunts`, `packages/game-rules/src/world`, `packages/game-content/src/hunts`, `packages/game-content/src/world`; event/team/map models in game-domain |
| Inventory, item definitions, drops, rewards | `packages/game-rules/src/inventory`, `packages/game-content/src/items`, `packages/game-rules/src/drops`, `packages/game-rules/src/rewards`. Item library requests use `@daoyou/contracts/items/library`. |
| Inscriptions and dungeon exploration | Models in `game-domain/{inscriptions,dungeon}`, numeric tables in matching game-content directories, calculations in `game-rules/{inscriptions,dungeon}` |
| Divination, identity reshape and journals | Models in game-domain, question/omen/fortune content in game-content, selection/reward/journal calculations in game-rules; HTTP envelopes in contracts |
| Alchemy, condition, cultivation and spirit fields | `packages/game-rules/src/alchemy`, `condition`, `cultivation`, `spirit-field`; numeric tables in matching game-content directories |
| Qi vocabulary, balance and recovery | `packages/game-domain/src/qi`, `packages/game-content/src/qi/config.ts`, `packages/game-rules/src/qi`; wire types in `packages/contracts/src/qi.ts` |
| Sect organization, tasks and presentation | `packages/game-rules/src/sect-organization`; interfaces in `packages/game-domain/src/sects`, concrete themes/definitions in `packages/game-content/src/sect-organization` |
| Story, guides and performances | Models in `packages/game-domain/src/{story,guide,performance}`, catalogs/assets in game-content, progression/interpreters in game-rules |
| Battle presentation, auto commands and replay archives | `packages/game-rules/src/combat`; state/archive models in `game-domain/combat`; HTTP/MQ envelopes in contracts |

Content-dependent model validators are constructed in game-domain and bound to current registries/rules in game-rules. Preserve every validation when moving a schema; do not replace a complete validator with a structural-only schema.

Domain event payload constructors live in `game-domain/events/payloads` and receive content validators from `game-rules/events`. NATS subjects, versions and envelopes use `@daoyou/contracts/events`. The API binds the parser in `lib/mq/domainEventSchema.ts`. Mail attachments and dungeon settlements follow the same dependency direction. `ItemGrantSchema` checks quantity and nested facts. Catalog validation of the definition ID happens in `InventoryItemSchema`.

`createResourceSchemas` in contracts accepts the complete item-grant and sect-delivery validators. API and Web bind the authoritative rules in their respective `src/lib/resources/schemas.ts`. Protocol types and reducers import contracts directly; parsing uses the host binding. `InventoryItemStructureSchema` exists for the bag wire schema's existing field projection only; inventory writes still use the fully refined `InventoryItemSchema` from game-rules.

Arena rules project an `ArenaSnapshot`; the API's `combat/arena-view.ts` adds API/protocol versions and decorates cached round results through the rule callback. Preserve that wrapper for HTTP and WS delivery. Durable replay format/version and validation belong to `game-domain/combat/replay-archive`; NATS subjects and archive delivery messages remain in contracts. Keep spectator/participant filtering and frozen-timeline checks intact.

## Engine Boundary

- Keep Daoyou rules, projection and sect-specific behavior outside the pure we-go engine. Use the current V6 types and content pack validators for combat and items.
- Preserve seeded RNG and deterministic command/round behavior. Keep clocks, DB, Redis, network and LLM calls out of shared engine logic; pass required inputs from the host.
- Content packs have schemas, loaders and compilation tests. Update the owning pack and validator together; see `docs/sect-authoring-guide.md` when authoring sect content.

## Character and Build Boundary

- Read the permanent attribute model in `packages/game-domain/src/cultivator.ts` and its conversion in `packages/game-rules/src/combat/projection/character-panel-v1.ts` before changing formulas. Use `projectCharacterToCombatV6(CharacterCombatInput)` for the complete projection.
- `CharacterCombatInput.sect` is optional. Personal display applies equipment and manuals without sect membership. Reuse `projectCharacterDisplay` and resource helpers in `packages/game-rules/src/character/display.ts`.
- Battle admission is a separate server rule: `CombatV6BuildService.ts` assembles authoritative inputs and checks membership / selected path. Do not remove admission checks merely because pure projection permits a sectless character.
- Personal manuals, equipment and beasts belong to the character; sect methods and meridians belong to membership. Keep their revisions separate, and derive readiness from current membership/path. See `docs/combat-domain-ownership.md`.
- Respect projection diagnostics and `full` / `persistent` resource policies. Changing maximum HP/MP must not implicitly heal existing characters; recovery and rebasing use the shared display/condition helpers and server V6 condition authority.
- Compile runtime panels and combat units from owned state. Do not write derived attributes back into permanent six-attribute storage.

## Items and Progression

- For species design or changes to beast aptitudes, growth or birth skills, also read [daoyou-beast-design](../daoyou-beast-design/SKILL.md).
- New equipment uses V6 equipment instances; equipped slots are separate from inventory. Manual progression and active slots are separate from consumable manual jades.
- Use `packages/game-content/src/items/registry.ts` and domain definition schemas for item facts, and `packages/game-rules/src/inventory` for stack/capacity/action rules. Do not translate new items into legacy creation product models.
- Forge, manual, beast and reward rules have dedicated game-rules modules; reuse them instead of reproducing costs, eligibility or generation logic in routes/UI.

## Verify

Follow the repository verification rules in [AGENTS.md](../../../AGENTS.md). Focused test targets include `pnpm run test packages/game-rules/src/combat/projection`, `pnpm run test packages/game-rules/src/combat/daoyou` and `pnpm run test packages/game-rules/src/inventory`. Tests that combine rules and engine behavior belong in game-rules.

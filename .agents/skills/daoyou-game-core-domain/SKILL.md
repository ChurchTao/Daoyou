---
name: daoyou-game-core-domain
description: Daoyou combat-v6 战斗内核、规则、人物投影、宗门、道装、功法、召唤灵及共享物品规则指南。Use when modifying shared combat rules, character attributes, sect content, equipment, manuals, beasts, forging, inventory or reward domain logic. Persistence and server orchestration belong to the data-layer and backend skills.
---

# Daoyou Game Core Domain

## Locate the Owning Layer

Current combat is `src/shared/engine/combat-v6`. Read the affected module and its callers first; phase plans and the engine README contain historical milestones, not a reliable inventory of current runtime behavior.

| Task | Code entrypoints |
| --- | --- |
| Turn pipeline, commands, effects, RNG, sessions | `src/shared/engine/combat-v6/core` |
| Daoyou combat formulas | `src/shared/engine/combat-v6/rules-daoyou` |
| Character panel and assembly | `src/shared/engine/combat-v6/projection`, `src/shared/lib/cultivatorDisplay.ts` |
| Sect methods, skills, meridians | `src/shared/engine/combat-v6/content`, `src/shared/engine/combat-v6/sect-progression` |
| Equipment compilation and generation | `src/shared/engine/combat-v6/equipment`, `src/shared/forging` |
| Manual definitions and progression | `src/shared/engine/combat-v6/manuals`, `src/shared/manuals` |
| Beasts, encounter orchestration, wild encounters | `src/shared/engine/combat-v6/beasts`, `src/shared/engine/combat-v6/encounter`, `src/shared/engine/combat-v6/wild` |
| Inventory, item definitions, drops, rewards | `src/shared/inventory`, `src/shared/items`, `src/shared/drops`, `src/shared/rewards` |
| Battle presentation, auto commands and replay contracts | `src/shared/combat-v6`, `src/shared/contracts/combatV6Runtime.ts` |

## Engine Boundary

- `core` is a pure, rules-independent we-go engine. It must not import Daoyou rules, projection or sect content. Keep sect-specific behavior in content/rules rather than adding sect ID branches to core.
- V6 must not import `battle-v5` or `creation-v2`; inspect `eslint.config.js` for enforced dependency boundaries. Old directory names or residual legacy DTOs do not establish a supported engine API.
- V5 `AttributeSet`, `AbilityFactory`, `AbilityConfig`, `projectAbilityConfig` and `battleProjection` are not the V6 pipeline. Do not restore them to implement current combat or items.
- Use the V6 core types and existing content pack validators. `GameplayTags` / `CreationTags` in the old shared tag domain are not a universal V6 tag contract.
- Preserve seeded RNG and deterministic command/round behavior. Keep clocks, DB, Redis, network and LLM calls out of shared engine logic; pass required inputs from the host.
- Content packs have schemas, loaders and compilation tests. Update the owning pack and validator together; see `docs/sect-authoring-guide.md` when authoring sect content.

## Character and Build Boundary

- Current `Cultivator.attributes` still stores six permanent attributes: vitality, strength, spirit, endurance, speed, willpower. Read `src/shared/types/cultivator.ts` and `projection/character-panel-v1.ts` before changing formulas. Future numerical design does not establish an implemented five-attribute model.
- Current complete projection is `projectCharacterToCombatV6(CharacterCombatInput)`. Historical `projectCultivator*` phase entrypoints are adapters, not the default for new business code.
- `CharacterCombatInput.sect` is optional. Personal display applies equipment and manuals without sect membership. Reuse `projectCharacterDisplay` and resource helpers in `src/shared/lib/cultivatorDisplay.ts`.
- Battle admission is a separate server rule: `CombatV6BuildService.ts` assembles authoritative inputs and checks membership / selected path. Do not remove admission checks merely because pure projection permits a sectless character.
- Personal manuals, equipment and beasts belong to the character; sect methods and meridians belong to membership. Keep their revisions separate, and derive readiness from current membership/path. See `docs/combat-domain-ownership.md`.
- Respect projection diagnostics and `full` / `persistent` resource policies. Changing maximum HP/MP must not implicitly heal existing characters; recovery and rebasing use the shared display/condition helpers and server V6 condition authority.
- Compile runtime panels and combat units from owned state. Do not write derived attributes back into permanent six-attribute storage.

## Items and Progression

- For beast species design or content changes involving aptitudes, growth or birth skills, also read [daoyou-beast-design](../daoyou-beast-design/SKILL.md). Its confirmed design baseline is distinct from current runtime behavior; do not restore fixed species roles or complete four-skill templates from older content.
- New equipment uses V6 equipment instances; equipped slots are separate from inventory. Manual progression and active slots are separate from consumable manual jades.
- Use `src/shared/items/registry.ts` and definition schemas for item facts, and `src/shared/inventory` for stack/capacity/action rules. Do not translate new items into legacy creation product models.
- Forge, manual, beast and reward rules have dedicated shared modules; reuse them instead of reproducing costs, eligibility or generation logic in routes/UI.
- Existing condition, alchemy and spirit-field code remains outside the battle core. Follow its live callers; removal of the old combat engine does not imply removal of all noncombat systems.

## Verify

- For pure deterministic shared logic, add or update a focused reproducing/contract test beside the affected module.
- Examples: `bun run test src/shared/engine/combat-v6/projection`, `bun run test src/shared/engine/combat-v6/rules-daoyou`, or `bun run test src/shared/inventory` depending on scope.
- Broaden to `bun run test` for changes spanning core, content and projection; run lint/build when imports or shared contracts change.
- Server persistence and browser behavior use code inspection and focused runtime checks per `docs/testing.md`; do not add server, database or UI unit tests.

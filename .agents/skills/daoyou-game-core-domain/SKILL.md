---
name: daoyou-game-core-domain
description: Daoyou shared game engine domain guide for battle-v5, creation-v2, cultivator attributes, AbilityConfig, affixes, GameplayTags, CreationTags, productModel, battleProjection, manual draw, and core balance rules. Use when modifying combat, creation/crafting products, attributes, tags, ability effects, buffs, affix registries, product persistence/rehydration, or shared engine tests.
---

# Daoyou Game Core Domain

## Read First

- `src/shared/types/cultivator.ts`
- `src/shared/engine/battle-v5`
- `src/shared/engine/creation-v2`
- `src/shared/engine/shared/tag-domain`
- `src/shared/engine/cultivator/index.ts`
- `src/shared/config/manualDrawConfig.ts`
- Relevant tests under `src/shared/engine/**/tests`

## Attribute Boundary

- Current V6 personal display projects `CharacterCombatInput`: character attributes, equipment and personal manuals work with optional sect progress. Do not require a sect profile to apply personal effects.
- Sect progress contains shared meridian depth, per-path node selections and method levels. Personal manuals and equipment are separate character-owned inputs; see `docs/combat-domain-ownership.md`.
- `buildRevision` and stored general build readiness were removed. Keep domain revisions separate and derive sect readiness from membership / selected path.

- `Cultivator.attributes` stores only six base attributes: vitality, strength, spirit, endurance, speed, willpower.
- Derived attributes, hp/mp max, and combat display stats are computed through battle-v5 `AttributeSet` and adapters.
- `src/shared/engine/cultivator/index.ts` is a migration placeholder. Do not rebuild old cultivator attribute logic there.
- Display attributes should use `createDisplayUnitFromCultivator` / `getCultivatorDisplayAttributes` patterns; combat should use `createCombatUnitFromCultivator`.

## Battle And Creation Boundary

- creation-v2 product to battle-v5 projection goes through `projectAbilityConfig(productModel)`.
- `CreationProductModel.battleProjection` is runtime authority but not persisted.
- Persistence removes `battleProjection`; read paths must rehydrate through existing persistence/registry code.
- `AbilityFactory` enforces tag contracts. Damage/heal/control abilities must carry matching `Ability.Function.*` and channel tags.

## Tag Boundary

- Runtime battle tags come from `GameplayTags`.
- Creation/process tags come from `CreationTags`.
- Do not handwrite runtime tag strings.
- Do not consume `CreationTags` directly as battle runtime tags.
- Affix match data must not include runtime-derived tags unless existing validation allows it.

## Existing Rules To Reuse

- Manual draw rules live in `src/shared/config/manualDrawConfig.ts`; tests cover minimum quality and five-draw guarantee.
- Starter products are normalized by existing starter/preset helpers; do not construct old `tags: ["attack", element]` skill configs by hand.
- Energy budget consistency is tested in creation-v2 closed-loop tests.
- Artifact realm decay exists in combat/display adapters and affects main-panel fixed modifiers, not every functional modifier.

## Workflow

1. Identify whether the task touches battle runtime, creation authoring, persistence, or presentation.
2. Check existing config/registry/tests before adding a new rule.
3. Keep six-attribute storage and derived-attribute calculation separate.
4. Use existing tag constants and mapping helpers.
5. Add or update focused tests for the affected contract.

## Do Not

- Do not add derived fields to `Cultivator.attributes` or DB models.
- Do not persist `battleProjection`.
- Do not bypass `AbilityFactory` validation.
- Do not mix `GameplayTags` and `CreationTags`.
- Do not copy manual draw guarantee logic into UI/API.

## Verify

- Battle/adapter changes: run battle-v5 adapter and integration tests.
- Creation/affix changes: run creation-v2 affix/config/contracts tests.
- Manual draw changes: run `src/shared/config/manualDrawConfig.test.ts`.
- Broad domain changes: run `bun run test` when practical.

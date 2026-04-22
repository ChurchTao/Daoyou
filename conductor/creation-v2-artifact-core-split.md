# Implementation Plan: Creation V2 Artifact Core Split

## Objective
Fix the issue where artifact slot-bound core affixes (e.g., `artifact-panel-accessory-utility`) fail to roll because they are grouped in the same category (`artifact_panel`) as general stat panel affixes (e.g., `artifact-panel-atk`). The Creation V2 engine's Stage A only picks one affix from the core category, causing severe competition and preventing the slot-bound core from consistently rolling. The solution is to introduce an `artifact_core` category for slot-bound bases and keep `artifact_panel` for general, stackable stat bonuses.

## Key Files & Context
- `engine/creation-v2/types.ts`
- `engine/creation-v2/config/CreationBalance.ts`
- `engine/creation-v2/config/AffixSelectionConstraints.ts`
- `engine/creation-v2/affixes/AffixSelector.ts`
- `engine/creation-v2/affixes/AffixPoolBuilder.ts`
- `engine/creation-v2/rules/affix/AffixEligibilityRules.ts`
- `engine/creation-v2/rules/recipe/RecipeValidationRuleSet.ts`
- `engine/creation-v2/balancing/PBU.ts`
- `engine/creation-v2/CreationOrchestrator.ts`
- `engine/creation-v2/composers/shared.ts`
- `engine/creation-v2/affixes/definitions/artifactAffixes.ts`
- `engine/creation-v2/affixes/exclusiveGroups.ts`
- `engine/creation-v2/tests/**/*`

## Implementation Steps

### 1. Define `artifact_core` Category
- **`types.ts`**: Add `'artifact_core'` to the `AffixCategory` type union and `AFFIX_CATEGORIES` constant.

### 2. Update Balance & Configurations
- **`CreationBalance.ts`**:
  - Add `artifact_core: 0` to `CREATION_AFFIX_UNLOCK_THRESHOLDS` (alongside `artifact_panel: 0`).
  - Add `artifact_core: 0` to `CREATION_AFFIX_POOL_SCORING.minimumScoreByCategory`.
  - Update `CREATION_AFFIX_CATEGORY_PLAN.priorityOrder` to include `artifact_core` before `artifact_panel`.
  - Adjust `targetShare` (e.g., `artifact_core: 0.03`, `artifact_panel: 0.05`).
- **`AffixSelectionConstraints.ts`**:
  - Add `artifact_core: 1` to limits.
- **`PBU.ts`**:
  - Add `artifact_core` to base energy weights (same value as `artifact_panel`).

### 3. Replace `artifact_panel` with `artifact_core` in Core Logic
In the following files, update any hardcoded arrays `['skill_core', 'gongfa_foundation', 'artifact_panel']` to replace `artifact_panel` with `artifact_core` so that the engine treats `artifact_core` as the true structural base:
- `AffixSelector.ts` (Stage A / Stage B filtering)
- `AffixPoolBuilder.ts`
- `AffixEligibilityRules.ts`
- `RecipeValidationRuleSet.ts` (unlocked categories default)
- `CreationOrchestrator.ts` (hasCore check)
- `composers/shared.ts` (finding the core affix)

### 4. Update Artifact Affix Definitions
- **`artifactAffixes.ts`**:
  - Change the `category` of `weapon-dual-atk`, `armor-dual-def`, and `accessory-utility` to `'artifact_core'`.
  - For the 15 general panel affixes (keep `category: 'artifact_panel'`):
    - **Remove** their `exclusiveGroup` property to allow multiple panel stats to be rolled.
    - Update `applicableArtifactSlots` based on the rule:
      - **Offensive** (`atk`, `magic-atk`, `crit-rate`, `crit-dmg`, `accuracy`, `control-hit`): `['weapon', 'accessory']`
      - **Defensive** (`def`, `magic-def`, `dodge`, `control-resistance`, `vitality`): `['armor', 'accessory']`
      - **Universal** (`speed`, `spirit`, `wisdom`, `willpower`): `['weapon', 'armor', 'accessory']`

### 5. Clean Up Exclusive Groups
- **`exclusiveGroups.ts`**:
  - Remove unused panel stat groups (`PANEL_STAT`, `PANEL_CRIT_RATE`, `PANEL_CRIT_DMG`, `PANEL_MOBILITY`).

### 6. Update Tests
- Search and replace `artifact_panel` with `artifact_core` in test setups where a core affix is expected (e.g., `BattleRegressionHarness.ts`, `AffixSystem.test.ts`).

## Verification & Testing
- Run all unit tests (`npm test`) to ensure no regressions.
- Specifically verify that an accessory creation correctly yields the `artifact-panel-accessory-utility` core affix and can concurrently roll general panel stats without mutual exclusion.
import { AUTO_POLICY_VERSION } from './auto-policy.js';
import type { CombatV6VersionStamp } from '@daoyou/combat-core/types';

/** Base projection stamp; copy values into snapshots rather than mutating it. */
export const COMBAT_V6_BASE_PROJECTION_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: 'combat-v6',
  rulesetVersion: 'daoyou_rules_v1',
  contentVersion: 'empty_content_v1',
  projectionVersion: 'character_panel_v1',
});

/** Current character build stamp. Persisted version strings remain stable. */
export const COMBAT_V6_CHARACTER_BUILD_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: 'combat-v6',
  rulesetVersion: 'daoyou_rules_v5',
  contentVersion: 'daoyou_character_build_content_v5',
  projectionVersion: 'character_build_v5',
});

export const COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: 'combat-v6',
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v11',
  contentVersion: 'daoyou_arena_beast_content_v1',
  projectionVersion: 'arena_beast_v2',
});
export const COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS: CombatV6VersionStamp = Object.freeze({
  ...COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS,
  contentVersion: 'daoyou_training_beast_content_v1',
  projectionVersion: 'training_beast_v2',
});
export const COMBAT_V6_SEAL_CURVE_WILD_VERSIONS: CombatV6VersionStamp = Object.freeze({
  ...COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS,
  contentVersion: 'daoyou_wild_seeking_content_v2',
  projectionVersion: 'wild_individual_v3',
});

import type { CombatV6BuildViewV1 } from '@shared/contracts/combatV6';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '../content/index.ts';

export const COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1 = Object.freeze({
  lingxiao: ['lingxiao-canon', 'edge-cleansing', 'sword-guidance', 'void-step', 'origin-returning', 'sword-nurturing'],
  youdu: ['youdu-canon', 'three-souls-separation', 'forgetful-river-record', 'seven-souls-seizure', 'soul-pinning-ironbook', 'dead-heart-living-spirit'],
  wuxiang: ['wuxiang-canon', 'blood-lotus', 'white-bone', 'wrathful-ming', 'six-senses', 'reed-crossing-method'],
  tianyan: ['tianyan-canon', 'wood-vitality', 'fire-illumination', 'earth-bearing', 'metal-severing', 'water-flowing'],
  jiujie: ['jiujie-canon', 'calamity-eye', 'heavenly-record', 'thunder-prison', 'cause-judgment', 'crossing-calamity'],
} satisfies Record<CombatV6SectId, readonly string[]>);

export type CombatV6MethodLevelsBySlot = readonly [number, number, number, number, number, number];

export function normalizeCombatV6MigratedMethodLevels(
  sectId: CombatV6SectId,
  legacyLevelsById: Readonly<Record<string, number | undefined>>,
  characterLevel: number,
): Record<string, number> {
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[sectId];
  const legacyIds = COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1[sectId];
  const cap = Math.min(180, Math.max(0, Math.floor(characterLevel)) + 10);
  const primary = clampLevel(legacyLevelsById[legacyIds[0]], cap);
  return Object.fromEntries(
    definition.methods
      .slice()
      .sort((left, right) => left.slot - right.slot)
      .map((method, index) => [
        method.id,
        index === 0
          ? primary
          : Math.min(primary, clampLevel(legacyLevelsById[legacyIds[index]], cap)),
      ]),
  );
}

export function createFreshCombatV6MethodLevels(
  sectId: CombatV6SectId,
): Record<string, number> {
  return Object.fromEntries(
    COMBAT_V6_SECT_DEFINITIONS_V4[sectId].methods.map((method) => [method.id, 1]),
  );
}

export function createEmptySectCombatProgressV6(
  sectId: CombatV6SectId,
  activePathId: string,
  methods: Readonly<Record<string, number>>,
): SectCombatProgressV6 {
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[sectId];
  if (!definition.paths.some((path) => path.id === activePathId)) {
    throw new Error(`COMBAT_V6_PATH_INVALID: ${activePathId}`);
  }
  const [firstPath, secondPath] = definition.paths;
  if (!firstPath || !secondPath || definition.paths.length !== 2) {
    throw new Error(`COMBAT_V6_BUILD_INVALID: ${sectId} must define exactly two paths`);
  }
  return {
    version: 1,
    sectId,
    methods: Object.fromEntries(definition.methods.map((method) => [method.id, methods[method.id] ?? 0])),
    meridianDepth: 0,
    activePathId,
    meridianLoadouts: [
      { pathId: firstPath.id, nodeIds: [], revision: 0 },
      { pathId: secondPath.id, nodeIds: [], revision: 0 },
    ],
  };
}

export function createCombatV6BuildView(input: {
  status: CombatV6BuildViewV1['status'];
  revision?: number;
  membershipId?: string;
  sectId?: CombatV6SectId;
  activePathId?: string;
  methodLevels?: Readonly<Record<string, number>>;
}): CombatV6BuildViewV1 {
  const definition = input.sectId
    ? COMBAT_V6_SECT_DEFINITIONS_V4[input.sectId]
    : undefined;
  return structuredClone({
    schemaVersion: 1,
    status: input.status,
    revision: input.revision ?? 0,
    ...(input.membershipId ? { membershipId: input.membershipId } : {}),
    ...(definition
      ? {
          sectId: definition.id,
          sectName: definition.name,
          paths: definition.paths.map((path) => ({ id: path.id, name: path.name })),
          methods: definition.methods
            .slice()
            .sort((left, right) => left.slot - right.slot)
            .map((method) => ({
              id: method.id,
              name: method.name,
              slot: method.slot,
              level: input.methodLevels?.[method.id] ?? 0,
              isPrimary: method.isPrimary,
            })),
        }
      : { paths: [], methods: [] }),
    ...(input.activePathId ? { activePathId: input.activePathId } : {}),
    meridianDepth: 0,
  });
}

function clampLevel(value: number | undefined, cap: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(cap, Math.max(0, Math.floor(value!)));
}

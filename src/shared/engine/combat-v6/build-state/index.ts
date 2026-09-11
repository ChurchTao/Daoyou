import type { SectCombatView } from '@shared/contracts/combatV6';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '../content/index.ts';

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

export function createSectCombatView(input: {
  status: SectCombatView['status'];
  revision?: number;
  membershipId?: string;
  sectId?: CombatV6SectId;
  activePathId?: string;
  methodLevels?: Readonly<Record<string, number>>;
}): SectCombatView {
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

import {
  SeededRng,
  UnitKind,
  type CreateBattleInput,
  type LineupUnit,
} from '../core/index.ts';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host.ts';
import type {
  CombatV6TrainingPlayerInput,
  PveCommandStrategyV1,
} from '../encounter/types.ts';
import { projectCultivatorMultiSectV5ToCombatV6 } from '../projection/index.ts';
import { daoyouRulesetV5 } from '../rules-daoyou/index.ts';
import {
  COMBAT_V6_PHASE_6D_VERSIONS,
  COMBAT_V6_PHASE_7D_VERSIONS,
} from '../version.ts';
import {
  WILD_CONTENT_VERSION,
  WILD_REGION,
  WILD_SKILLS,
  WILD_SPECIES,
  validateWildContent,
  wildPanel,
} from './content.ts';

export const WILD_VERSIONS = COMBAT_V6_PHASE_7D_VERSIONS;
export type WildCombatant = {
  unitId: string;
  speciesId: string;
  level: number;
};
export function generateWildEncounter(
  nodeId: string,
  seed: number,
): WildCombatant[] {
  if (nodeId !== WILD_REGION.nodeId) throw new Error('UNKNOWN_WILD_REGION');
  const rng = new SeededRng(seed);
  const count = 1 + Math.floor(rng.next() * 3);
  return Array.from({ length: count }, (_, slot) => ({
    unitId: `combat.wild.enemy.${slot}`,
    speciesId: WILD_SPECIES[Math.floor(rng.next() * 3)]!.id,
    level: 5 + Math.floor(rng.next() * 11),
  }));
}
export interface WildRuntimeSnapshot extends PveRestoredState {
  schemaVersion: 1;
  hostVersion: 'combat_v6_wild_runtime_v1';
  nodeId: string;
  playerId: string;
  input: Omit<CreateBattleInput, 'ruleset'>;
  npcStrategies: Record<string, PveCommandStrategyV1>;
  combatants: WildCombatant[];
}

export class WildHost extends CombatV6PveHostSession {
  constructor(
    private readonly compiled: Omit<
      WildRuntimeSnapshot,
      keyof PveRestoredState
    >,
    restored?: PveRestoredState,
  ) {
    if (compiled.input.versions?.contentVersion !== WILD_CONTENT_VERSION)
      throw new Error('WILD_RUNTIME_VERSION_MISMATCH');
    super(
      {
        playerId: compiled.playerId,
        battleInput: {
          ...structuredClone(compiled.input),
          ruleset: daoyouRulesetV5,
        },
        npcStrategies: compiled.npcStrategies,
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
      },
      restored,
    );
  }
  runtimeSnapshot(): WildRuntimeSnapshot {
    return structuredClone({ ...this.compiled, ...this.recordedState() });
  }
  trace() {
    return {
      ...this.traceData(),
      schemaVersion: 1 as const,
      hostVersion: 'combat_v6_wild_encounter_host_v1' as const,
      nodeId: this.compiled.nodeId,
    };
  }
}

export function createWildHost(
  nodeId: string,
  seed: number,
  player: CombatV6TrainingPlayerInput,
): WildHost {
  const diagnostics = validateWildContent();
  if (diagnostics.length) throw new Error(diagnostics.join(';'));
  const projected = projectCultivatorMultiSectV5ToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'persistent',
  });
  if (!projected.ok)
    throw new Error(
      projected.diagnostics.map((d) => `${d.code}: ${d.message}`).join(';'),
    );
  const combatants = generateWildEncounter(nodeId, seed);
  const strategies: Record<string, PveCommandStrategyV1> = {};
  const units: LineupUnit[] = [projected.unit];
  for (const [slot, c] of combatants.entries()) {
    const species = WILD_SPECIES.find((s) => s.id === c.speciesId)!;
    const skills = [...species.skillIds];
    units.push({
      id: c.unitId,
      name: species.name,
      side: 1,
      slot,
      kind: UnitKind.Npc,
      level: c.level,
      attrs: wildPanel(c.speciesId, c.level),
      skills,
      skillLevels: Object.fromEntries(skills.map((id) => [id, c.level])),
      passives: [],
      tags: [],
    });
    strategies[c.unitId] = skills.length
      ? { type: 'skill-rotation', skillIds: skills }
      : { type: 'attack' };
  }
  const ids = [
    ...projected.skills,
    ...projected.statusDefs,
    ...WILD_SKILLS,
  ].map((x) => x.id);
  if (
    new Set(ids).size !== ids.length ||
    new Set(units.map((u) => u.id)).size !== units.length
  )
    throw new Error('WILD_CONTENT_ID_CONFLICT');
  return new WildHost({
    schemaVersion: 1,
    hostVersion: 'combat_v6_wild_runtime_v1',
    nodeId,
    playerId: projected.unit.id!,
    combatants,
    npcStrategies: strategies,
    input: {
      seed,
      versions: WILD_VERSIONS,
      units,
      skills: [...projected.skills, ...WILD_SKILLS],
      statusDefs: projected.statusDefs,
    },
  });
}

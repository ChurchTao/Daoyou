import {
  beastAppearance,
  playerAppearances,
  type PresentedBattleInput,
} from '../../../combat-v6/unit-appearance';
import { BEAST_SKILLS, BEAST_STATUS_DEFS, projectBeastRoster } from '../beasts';
import { captureSkill } from '../beasts/progression';
import { activeBeastSkills, beastPanel } from '../beasts/projection';
import { SkillTag, UnitKind, type LineupUnit } from '../core/index.ts';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host.ts';
import type {
  CombatV6TrainingPlayerInput,
  PveCommandStrategyV1,
} from '../encounter/types.ts';
import { projectCharacterToCombatV6 } from '../projection/index.ts';
import { daoyouRulesetV6 } from '../rules-daoyou/index.ts';
import {
  COMBAT_V6_PHASE_6D_VERSIONS,
  COMBAT_V6_WILD_SEEKING_VERSIONS,
} from '../version.ts';
import { WildIndividualSchema, type WildIndividual } from './generator';
export { generateWildEncounter, type WildCombatant } from './generator';

export const WILD_VERSIONS = COMBAT_V6_WILD_SEEKING_VERSIONS;
export interface WildRuntimeSnapshot extends PveRestoredState {
  schemaVersion: 1;
  hostVersion: 'combat_v6_wild_runtime_v1';
  nodeId: string;
  playerId: string;
  input: PresentedBattleInput;
  npcStrategies: Record<string, PveCommandStrategyV1>;
  combatants: WildIndividual[];
}

export class WildHost extends CombatV6PveHostSession {
  constructor(
    private readonly compiled: Omit<
      WildRuntimeSnapshot,
      keyof PveRestoredState
    >,
    restored?: PveRestoredState,
  ) {
    if (
      compiled.input.versions?.contentVersion !== WILD_VERSIONS.contentVersion
    )
      throw new Error('WILD_RUNTIME_VERSION_MISMATCH');
    super(
      {
        playerId: compiled.playerId,
        battleInput: {
          ...structuredClone(compiled.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: compiled.npcStrategies,
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
      },
      restored,
      compiled.input.unitAppearances,
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
  individuals: readonly WildIndividual[],
): WildHost {
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'persistent',
  });
  if (!projected.ok)
    throw new Error(
      projected.diagnostics.map((d) => `${d.code}: ${d.message}`).join(';'),
    );
  const combatants = individuals.map((c) => WildIndividualSchema.parse(c));
  if (
    combatants.some((c) => c.beast.ownerCultivatorId !== player.cultivator.id)
  )
    throw new Error('WILD_OWNER_MISMATCH');
  const strategies: Record<string, PveCommandStrategyV1> = {};
  const units: LineupUnit[] = [
    projected.unit,
    ...projectBeastRoster(
      player.beasts,
      projected.unit.id!,
      0,
      0,
      projected.unit.level,
    ),
  ];
  for (const [slot, c] of combatants.entries()) {
    const active = activeBeastSkills(c.beast);
    const isPassive = (id: string) =>
      BEAST_SKILLS.find((s) => s.id === id)!.tags.includes(SkillTag.Passive);
    const skills = active.filter((id) => !isPassive(id));
    units.push({
      id: c.unitId,
      name: c.beast.name,
      side: 1,
      slot,
      kind: UnitKind.Npc,
      level: c.level,
      attrs: beastPanel(c.beast),
      skills,
      skillLevels: Object.fromEntries(
        c.beast.skills.map((id) => [id, c.level]),
      ),
      passives: active.filter(isPassive),
      tags: [],
    });
    strategies[c.unitId] = skills.length
      ? { type: 'skill-rotation', skillIds: skills }
      : { type: 'attack' };
  }
  const ids = [...projected.skills, ...projected.statusDefs].map((x) => x.id);
  if (
    new Set(ids).size !== ids.length ||
    new Set(units.map((u) => u.id)).size !== units.length
  )
    throw new Error('WILD_CONTENT_ID_CONFLICT');
  const capture = captureSkill(
    combatants,
    projected.unit.level!,
    player.beasts?.beasts.length ?? 0,
  );
  projected.unit.skills = [...(projected.unit.skills ?? []), capture.id];
  return new WildHost({
    schemaVersion: 1,
    hostVersion: 'combat_v6_wild_runtime_v1',
    nodeId,
    playerId: projected.unit.id!,
    combatants,
    npcStrategies: strategies,
    input: {
      unitAppearances: {
        ...playerAppearances(player),
        ...Object.fromEntries(
          combatants.map((c) => [c.unitId, beastAppearance(c.speciesId)]),
        ),
      },
      seed,
      versions: WILD_VERSIONS,
      units,
      skills: [...projected.skills, ...BEAST_SKILLS, capture],
      statusDefs: [...projected.statusDefs, ...BEAST_STATUS_DEFS],
    },
  });
}

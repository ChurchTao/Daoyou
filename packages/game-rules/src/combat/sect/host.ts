import { SECT_NPC_TEMPLATES } from '@daoyou/game-content/combat/sect-npc';
import type { SectBattleResourcePolicy, SectBattleOpponent, SectBattleSnapshot } from '@daoyou/game-domain/combat/challenges';

import { playerAppearances } from '../unit-appearance.js';

import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';

import { canonicalizeResourceParams } from '@daoyou/game-domain/resources';

import { BEAST_STATUS_DEFS, BEAST_SKILLS } from '@daoyou/game-content/beasts';

import { projectBeastRoster } from '../../beasts/projection.js';

import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';

import {
  type PveRestoredState,
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
} from '@daoyou/game-domain/combat';

import { CombatV6PveHostSession } from '../encounter/host.js';

import { projectCharacterToCombatV6 } from '../projection/project-character.js';

import { characterBattleSkills } from '../projection/character-battle-skills.js';

import { daoyouRulesetV6 } from '../daoyou/index.js';


import { presetEnemyAttrs } from '../encounter/preset-enemy.js';

export const SECT_BATTLE_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v11' as const,
  contentVersion: 'combat-v6-sect-task-v1' as const,
};

export function freezeSectNpcOpponent(
  template: keyof typeof SECT_NPC_TEMPLATES,
  level: number,
): SectBattleOpponent {
  if (!Number.isInteger(level) || level < 1 || level > 180)
    throw new Error('宗门试炼等级无效');
  const spec = SECT_NPC_TEMPLATES[template];
  const attrs = presetEnemyAttrs(level, spec.kind);
  const skills = BEAST_SKILLS.filter((skill) =>
    template !== 'mine_patrol' && skill.id === 'beast.spirit-flame',
  );
  return {
    version: 'sect-v6-opponent-v1',
    units: [
      {
        id: `sect.enemy.${template}`,
        name: spec.name,
        kind: 'npc',
        side: 1,
        slot: 0,
        level,
        attrs,
        combatFacts: { isCharacter: template === 'elder_trial' ? 1 : 0 },
        skills: skills.map((skill) => skill.id),
        skillLevels: Object.fromEntries(
          skills.map((skill) => [skill.id, level]),
        ),
      },
    ],
    skills: structuredClone(skills),
    statusDefs: [],
  };
}

export function freezeSectBattleOpponent(
  player: CombatV6TrainingPlayerInput,
): SectBattleOpponent {
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 1,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('宗门战斗目标缺少有效的新版构筑');
  return structuredClone({
    unitAppearances: playerAppearances(player),
    version: 'sect-v6-opponent-v1',
    units: [
      projected.unit,
      ...projectBeastRoster(
        player.beasts,
        projected.unit.id!,
        1,
        0,
        projected.unit.level,
      ).filter((unit) => !unit.benched),
    ],
    skills: projected.skills,
    statusDefs: [...projected.statusDefs, ...BEAST_STATUS_DEFS],
  });
}

export class SectBattleHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      SectBattleSnapshot,
      'version' | 'playerId' | 'resourcePolicy' | 'input'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'sect-v6-battle-v1' ||
      source.input.versions?.contentVersion !==
        SECT_BATTLE_VERSIONS.contentVersion
    )
      throw new Error('宗门战斗版本无法恢复');
    super(
      {
        playerId: source.playerId,
        battleInput: {
          ...structuredClone(source.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: Object.fromEntries(
          source.input.units
            .filter((unit) => unit.side === 1)
            .map((unit) => [unit.id!, { type: 'automatic' as const }]),
        ),
        sourceProjectionVersions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
        playerAutoStrategy: source.input.autoStrategy,
      },
      restored,
      source.input.unitAppearances,
    );
  }

  runtimeSnapshot(): SectBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }

  trace() {
    return this.traceData();
  }
}

export function createSectBattleHost(
  player: CombatV6TrainingPlayerInput,
  opponent: SectBattleOpponent,
  resourcePolicy: SectBattleResourcePolicy,
  seed: number,
): SectBattleHost {
  if (opponent.version !== 'sect-v6-opponent-v1')
    throw new Error('宗门战斗目标版本无效');
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy,
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑并恢复气血');
  const battleSkills = new Map(BEAST_SKILLS.map((skill) => [skill.id, skill]));
  const units = [
    characterBattleSkills(projected.unit, projected.skills, battleSkills),
    ...projectBeastRoster(
      player.beasts,
      projected.unit.id!,
      0,
      0,
      projected.unit.level,
    ),
    ...opponent.units.map((unit) =>
      unit.kind === 'player'
        ? characterBattleSkills(unit, opponent.skills, battleSkills)
        : unit,
    ),
  ];
  if (
    opponent.units.some((unit) => unit.side !== 1 || unit.benched) ||
    new Set(units.map((unit) => unit.id)).size !== units.length
  )
    throw new Error('宗门战斗目标阵容无效');
  function merge<T extends { id: string }>(values: T[]): T[] {
    const result = new Map<string, T>();
    for (const value of values) {
      const previous = result.get(value.id);
      if (
        previous &&
        canonicalizeResourceParams(previous) !==
          canonicalizeResourceParams(value)
      )
        throw new Error(`宗门战斗定义冲突：${value.id}`);
      result.set(value.id, value);
    }
    return [...result.values()];
  }
  return new SectBattleHost({
    version: 'sect-v6-battle-v1',
    playerId: projected.unit.id!,
    resourcePolicy,
    input: structuredClone({
      autoStrategy: player.autoStrategy,
      unitAppearances: { ...playerAppearances(player), ...opponent.unitAppearances },
      seed,
      versions: SECT_BATTLE_VERSIONS,
      units,
      skills: merge([
        ...battleSkills.values(),
        ...(opponent.units[0]?.kind === 'player' ? [] : opponent.skills),
      ]),
      statusDefs: merge([...projected.statusDefs, ...opponent.statusDefs, ...BEAST_STATUS_DEFS]),
    }),
  });
}

import { DUNGEON_TEMPLATES, MAP_DIFFICULTY_SCALE } from '@daoyou/game-content/combat/dungeon';
import type { DungeonTemplate, DungeonBattleSnapshot } from '@daoyou/game-domain/combat/challenges';

import { playerAppearances } from '../unit-appearance.js';

import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';

import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';

import { BEAST_STATUS_DEFS, BEAST_SKILLS } from '@daoyou/game-content/beasts';

import { projectBeastRoster } from '../../beasts/projection.js';

import { UnitKind } from '@daoyou/combat-core/enums';

import { type CreateBattleInput } from '@daoyou/combat-core/types';

import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';

import {
  type PveRestoredState,
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
} from '@daoyou/game-domain/combat';

import { CombatV6PveHostSession } from '../encounter/host.js';

import { projectCharacterToCombatV6 } from '../projection/project-character.js';

import { daoyouRulesetV6 } from '../daoyou/index.js';


import { presetEnemyAttrs } from '../encounter/preset-enemy.js';

export const DUNGEON_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v11' as const,
  contentVersion: 'combat-v6-dungeon-v1' as const,
};

export function carryDungeonBeastResources(
  units: CreateBattleInput['units'],
  ownerId: string,
  resources: Record<string, { hp: number; mp: number }> = {},
): CreateBattleInput['units'] {
  return units.flatMap((unit) => {
    const previous = unit.ownerId === ownerId ? resources[unit.id!] : undefined;
    if (!previous) return [unit];
    // A beast lost earlier in this run must not reappear or become summonable.
    if (previous.hp <= 0) return [];
    return [
      {
        ...unit,
        attrs: {
          ...unit.attrs,
          hp: Math.min(unit.attrs?.maxHp ?? previous.hp, previous.hp),
          mp: Math.min(unit.attrs?.maxMp ?? previous.mp, previous.mp),
        },
      },
    ];
  });
}

export class DungeonHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      DungeonBattleSnapshot,
      'version' | 'playerId' | 'input'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'dungeon-v6-v1' ||
      source.input.versions?.contentVersion !== DUNGEON_VERSIONS.contentVersion
    )
      throw new Error('秘境战斗版本无法恢复');
    super(
      {
        playerId: source.playerId,
        battleInput: {
          ...structuredClone(source.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: Object.fromEntries(
          source.input.units
            .filter((u) => u.side === 1)
            .map((u) => [u.id!, { type: 'attack' as const }]),
        ),
        sourceProjectionVersions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
        playerAutoStrategy: source.input.autoStrategy,
      },
      restored,
      source.input.unitAppearances,
    );
  }
  runtimeSnapshot(): DungeonBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }
  trace() {
    return this.traceData();
  }
}

export function createDungeonHost(
  player: CombatV6TrainingPlayerInput,
  level: number,
  template: DungeonTemplate,
  seed: number,
  mapDifficulty: DungeonDifficultyTier = 'normal',
) {
  if (!Number.isInteger(level) || level < 1 || level > 180)
    throw new Error('秘境等级无效');
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'persistent',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  const spec = DUNGEON_TEMPLATES[template];
  const enemyAttrs = presetEnemyAttrs(level, template, spec.count);
  const difficultyScale = MAP_DIFFICULTY_SCALE[mapDifficulty];
  enemyAttrs.hp = enemyAttrs.maxHp = Math.round(enemyAttrs.maxHp * difficultyScale);
  enemyAttrs.physicalAtk = Math.round(enemyAttrs.physicalAtk * difficultyScale);
  enemyAttrs.magicAtk = Math.round(enemyAttrs.magicAtk * difficultyScale);
  return new DungeonHost({
    version: 'dungeon-v6-v1',
    playerId: projected.unit.id!,
    input: {
      autoStrategy: player.autoStrategy,
      unitAppearances: playerAppearances(player),
      seed,
      versions: DUNGEON_VERSIONS,
      units: [
        projected.unit,
        ...projectBeastRoster(
          player.beasts,
          projected.unit.id!,
          0,
          0,
          projected.unit.level,
        ),
        ...Array.from({ length: spec.count }, (_, slot) => ({
          id: `dungeon.enemy.${slot}`,
          name: spec.name,
          side: 1 as const,
          slot,
          kind: UnitKind.Npc,
          level,
          attrs: {
            ...enemyAttrs,
            healPower: 0,
            critRate: 0,
            spellCritRate: 0,
            physicalFuryRate: 0,
            sealHit: 0,
            sealResist: 0,
            attackCultivate: 0,
            defenseCultivate: 0,
            spellCultivate: 0,
            resistSpellCultivate: 0,
          },
          skills: [],
          passives: [],
          tags: [],
        })),
      ],
      skills: [...projected.skills, ...BEAST_SKILLS],
      statusDefs: [...projected.statusDefs, ...BEAST_STATUS_DEFS],
    },
  });
}

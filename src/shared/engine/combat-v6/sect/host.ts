import { BEAST_SKILLS, projectBeastRoster } from '../beasts';
import type { CreateBattleInput, SkillDef, StatusDef } from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host';
import { projectCultivatorMultiSectV5ToCombatV6 } from '../projection';
import { daoyouRulesetV6 } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

export const SECT_BATTLE_VERSIONS = {
  ...COMBAT_V6_PHASE_6D_VERSIONS,
  rulesetVersion: 'daoyou_rules_v8' as const,
  contentVersion: 'combat-v6-sect-task-v1' as const,
};
export type SectBattleResourcePolicy = 'full' | 'persistent';

/** Enrollment freezes native enemy units, including only the eligible lead pet. */
export interface SectBattleOpponent {
  version: 'sect-v6-opponent-v1';
  units: CreateBattleInput['units'];
  skills: SkillDef[];
  statusDefs: StatusDef[];
}

export const SECT_NPC_TEMPLATES = {
  mine_patrol: { name: '岩牙矿兽', hp: 0.75, attack: 0.75 },
  elder_trial: { name: '长老试炼化身', hp: 2.5, attack: 1.3 },
} as const;

export function freezeSectNpcOpponent(
  template: keyof typeof SECT_NPC_TEMPLATES,
  level: number,
): SectBattleOpponent {
  if (!Number.isInteger(level) || level < 1 || level > 180)
    throw new Error('宗门试炼等级无效');
  const spec = SECT_NPC_TEMPLATES[template];
  const hp = Math.round((100 + level * 20) * spec.hp);
  const attack = Math.round((15 + level * 5) * spec.attack);
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
        attrs: {
          hp,
          maxHp: hp,
          mp: 100,
          maxMp: 100,
          physicalAtk: attack,
          magicAtk: attack,
          physicalDef: 10 + level * 3,
          magicDef: 10 + level * 3,
          speed: 10 + level * 3,
        },
        skills: [],
      },
    ],
    skills: [],
    statusDefs: [],
  };
}

export function freezeSectBattleOpponent(
  player: CombatV6TrainingPlayerInput,
): SectBattleOpponent {
  const projected = projectCultivatorMultiSectV5ToCombatV6({
    ...player,
    side: 1,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('宗门战斗目标缺少有效的新版构筑');
  return structuredClone({
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
    statusDefs: projected.statusDefs,
  });
}

export interface SectBattleSnapshot extends PveRestoredState {
  version: 'sect-v6-battle-v1';
  playerId: string;
  resourcePolicy: SectBattleResourcePolicy;
  input: Omit<CreateBattleInput, 'ruleset'>;
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
            .map((unit) => [unit.id!, { type: 'ruleset' as const }]),
        ),
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
      },
      restored,
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
  const projected = projectCultivatorMultiSectV5ToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy,
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑并恢复气血');
  const units = [
    projected.unit,
    ...projectBeastRoster(
      player.beasts,
      projected.unit.id!,
      0,
      0,
      projected.unit.level,
    ),
    ...opponent.units,
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
      if (previous && JSON.stringify(previous) !== JSON.stringify(value))
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
      seed,
      versions: SECT_BATTLE_VERSIONS,
      units,
      skills: merge([...BEAST_SKILLS, ...projected.skills, ...opponent.skills]),
      statusDefs: merge([...projected.statusDefs, ...opponent.statusDefs]),
    }),
  });
}

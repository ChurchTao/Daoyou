import { BEAST_SKILLS, projectBeastRoster } from '../beasts';
import { UnitKind, type CreateBattleInput } from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host';
import { projectCultivatorMultiSectV5ToCombatV6 } from '../projection';
import { daoyouRulesetV6 } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

export const DUNGEON_VERSIONS = {
  ...COMBAT_V6_PHASE_6D_VERSIONS,
  rulesetVersion: 'daoyou_rules_v8' as const,
  contentVersion: 'combat-v6-dungeon-v1' as const,
};
export const DUNGEON_TEMPLATES = {
  normal: { name: '秘境守卫', count: 1, hp: 1, attack: 1 },
  elite: { name: '秘境精锐', count: 2, hp: 1.2, attack: 1.1 },
  boss: { name: '秘境镇守', count: 1, hp: 2.5, attack: 1.3 },
} as const;
export type DungeonTemplate = keyof typeof DUNGEON_TEMPLATES;
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
export interface DungeonBattleSnapshot extends PveRestoredState {
  version: 'dungeon-v6-v1';
  playerId: string;
  input: Omit<CreateBattleInput, 'ruleset'>;
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
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
      },
      restored,
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
) {
  if (!Number.isInteger(level) || level < 1 || level > 180)
    throw new Error('秘境等级无效');
  const projected = projectCultivatorMultiSectV5ToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'persistent',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  const spec = DUNGEON_TEMPLATES[template];
  const maxHp = Math.round((100 + level * 20) * spec.hp);
  const attack = Math.round((15 + level * 5) * spec.attack);
  return new DungeonHost({
    version: 'dungeon-v6-v1',
    playerId: projected.unit.id!,
    input: {
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
            hp: maxHp,
            maxHp,
            mp: 100,
            maxMp: 100,
            physicalAtk: attack,
            magicAtk: attack,
            physicalDef: 10 + level * 3,
            magicDef: 10 + level * 3,
            speed: 10 + level * 3,
            healPower: 0,
            hit: 100,
            dodge: 10,
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
      statusDefs: projected.statusDefs,
    },
  });
}

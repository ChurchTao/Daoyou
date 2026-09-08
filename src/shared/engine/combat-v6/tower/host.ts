import type { TowerBlessingId } from '../../../lib/tower/blessings';
import {
  resolveTowerFloorKind,
  resolveTowerRealmStage,
} from '../../../lib/tower/helpers';
import type { RealmType } from '../../../types/constants';
import { BEAST_SKILLS, projectBeastRoster } from '../beasts';
import { UnitKind, type CreateBattleInput } from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host';
import { projectCultivatorMultiSectV5ToCombatV6 } from '../projection';
import { combatCharacterLevel } from '../projection/character-level';
import { daoyouRulesetV6 } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

export type TowerBlessings = Partial<Record<TowerBlessingId, number>>;
export type TowerResources = Record<string, { hp: number; mp: number }>;
export const TOWER_V6_VERSIONS = {
  ...COMBAT_V6_PHASE_6D_VERSIONS,
  rulesetVersion: 'daoyou_rules_v8',
  contentVersion: 'combat-v6-tower-v1',
} as const;
export const TOWER_ENEMY_CONFIG = {
  floorGrowth: 0.06,
  hpBase: 200,
  hpPerLevel: 30,
  attackBase: 30,
  attackPerLevel: 8,
  defensePerLevel: 4,
  speedPerLevel: 3,
  templates: {
    normal: { name: '蜃影守卫', count: 1, hpScale: 1 },
    elite: { name: '幻境精锐', count: 2, hpScale: 1 },
    boss: { name: '蜃楼镇守', count: 1, hpScale: 2 },
  },
} as const;

export function projectTowerPlayer(
  player: CombatV6TrainingPlayerInput,
  blessings: TowerBlessings,
) {
  const input = structuredClone(player);
  const keys = [
    'vitality',
    'strength',
    'spirit',
    'endurance',
    'speed',
    'willpower',
  ] as const;
  const ids = [
    'vitality_surge',
    'strength_surge',
    'spirit_surge',
    'endurance_surge',
    'swift_step',
    'mind_focus',
  ] as const;
  keys.forEach((key, i) => {
    input.cultivator.attributes[key] *=
      1 +
      (blessings[ids[i]] ?? 0) * 0.08 +
      (blessings.balanced_dao ?? 0) * 0.05;
  });
  const projected = projectCultivatorMultiSectV5ToCombatV6({
    ...input,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  const attrs = projected.unit.attrs!;
  attrs.maxHp = attrs.hp = Math.floor(
    attrs.maxHp! * (1 + (blessings.jade_bones ?? 0) * 0.1),
  );
  attrs.maxMp = attrs.mp = Math.floor(
    attrs.maxMp! * (1 + (blessings.sea_of_qi ?? 0) * 0.12),
  );
  return projected;
}

export function towerResourceRatio(
  current: number,
  oldMax: number,
  newMax: number,
) {
  return Math.max(
    0,
    Math.min(newMax, Math.floor(oldMax > 0 ? (current / oldMax) * newMax : 0)),
  );
}
export function towerRecovery(current: number, max: number, fraction: number) {
  return Math.min(
    max,
    Math.max(0, current) + Math.floor(Math.max(0, max - current) * fraction),
  );
}

export interface TowerBattleSnapshot extends PveRestoredState {
  version: 'tower-v6-v1';
  playerId: string;
  input: Omit<CreateBattleInput, 'ruleset'>;
}
export class TowerHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      TowerBattleSnapshot,
      'version' | 'playerId' | 'input'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'tower-v6-v1' ||
      source.input.versions?.contentVersion !== TOWER_V6_VERSIONS.contentVersion
    )
      throw new Error('幻境战斗版本无法恢复');
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
  runtimeSnapshot(): TowerBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }
  trace() {
    return this.traceData();
  }
}

export function createTowerHost(
  player: CombatV6TrainingPlayerInput,
  realm: RealmType,
  floor: number,
  blessings: TowerBlessings,
  resources: TowerResources,
  seed: number,
) {
  if (!Number.isInteger(floor) || floor < 1 || floor > 20)
    throw new Error('幻境层数无效');
  const projected = projectTowerPlayer(player, blessings);
  const unit = projected.unit;
  const attrs = unit.attrs!;
  const previous = resources[unit.id!];
  if (previous) {
    attrs.hp = towerRecovery(
      previous.hp,
      attrs.maxHp!,
      (blessings.breathing_technique ?? 0) * 0.1,
    );
    attrs.mp = towerRecovery(
      previous.mp,
      attrs.maxMp!,
      (blessings.meridian_cycle ?? 0) * 0.15,
    );
  }
  const beasts = projectBeastRoster(
    player.beasts,
    unit.id!,
    0,
    0,
    unit.level,
  ).flatMap((beast) => {
    const resource = resources[beast.id!];
    if (resource?.hp === 0) return [];
    if (resource)
      beast.attrs = {
        ...beast.attrs,
        hp: Math.min(beast.attrs!.maxHp!, resource.hp),
        mp: Math.min(beast.attrs!.maxMp!, resource.mp),
      };
    return [beast];
  });
  const kind = resolveTowerFloorKind(floor);
  const level = combatCharacterLevel(realm, resolveTowerRealmStage(floor));
  const config = TOWER_ENEMY_CONFIG;
  const template = config.templates[kind];
  const scale = 1 + (floor - 1) * config.floorGrowth;
  const count = template.count;
  const hp = Math.round(
    (config.hpBase + level * config.hpPerLevel) * scale * template.hpScale,
  );
  const attack = Math.round(
    (config.attackBase + level * config.attackPerLevel) * scale,
  );
  const enemies: CreateBattleInput['units'] = Array.from(
    { length: count },
    (_, slot) => ({
      id: `tower.enemy.${slot}`,
      name: template.name,
      side: 1,
      slot,
      kind: UnitKind.Npc,
      level,
      attrs: {
        hp,
        maxHp: hp,
        mp: 100,
        maxMp: 100,
        physicalAtk: attack,
        magicAtk: attack,
        physicalDef: level * config.defensePerLevel,
        magicDef: level * config.defensePerLevel,
        speed: level * config.speedPerLevel,
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
    }),
  );
  return new TowerHost({
    version: 'tower-v6-v1',
    playerId: unit.id!,
    input: {
      seed,
      versions: TOWER_V6_VERSIONS,
      units: [unit, ...beasts, ...enemies],
      skills: [...projected.skills, ...BEAST_SKILLS],
      statusDefs: projected.statusDefs,
    },
  });
}

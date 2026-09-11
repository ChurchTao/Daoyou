import { TOWER_ENCOUNTER_PACK } from '../../../lib/tower/encounter-pack';
import type { RealmType } from '../../../types/constants';
import { UnitKind, type CreateBattleInput } from '../core';
import { combatCharacterLevel } from '../projection/character-level';

export const TOWER_ENEMY_CONFIG = TOWER_ENCOUNTER_PACK.enemies;

export function compileTowerEnemies(realm: RealmType, floor: number, pack = TOWER_ENCOUNTER_PACK): CreateBattleInput['units'] {
  const floorRule = pack.floors.find(row => row.floor === floor);
  if (!floorRule) throw new Error('tower/data/encounters.json: floors.' + floor + ': 楼层不存在');
  const kind = floorRule.kind;
  const level = combatCharacterLevel(realm, floorRule.realmStage);
  const config = pack.enemies;
  const template = config.templates[kind];
  const scale = 1 + (floor - 1) * config.floorGrowth;
  const hp = Math.round((config.hpBase + level * config.hpPerLevel) * scale * template.hpScale);
  const attack = Math.round((config.attackBase + level * config.attackPerLevel) * scale);
  return Array.from({ length: template.count }, (_, slot) => ({
    id: `tower.enemy.${slot}`, name: template.name, side: 1, slot, kind: UnitKind.Npc, level,
    attrs: {
      ...config.baseAttrs, hp, maxHp: hp, physicalAtk: attack, magicAtk: attack,
      physicalDef: level * config.defensePerLevel, magicDef: level * config.defensePerLevel, speed: level * config.speedPerLevel,
    },
    skills: [], passives: [], tags: [],
  }));
}

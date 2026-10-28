import type { RealmType } from '@daoyou/constants/realms';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { BODY_CULTIVATION_PACK } from '@daoyou/game-content/body-cultivation';
import { DAO_EQUIPMENT_TEMPLATES_V1 } from '@daoyou/game-content/equipment/base';
import {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  OPEN_EQUIPMENT_LEVELS,
} from '@daoyou/game-domain/equipment';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { describe, expect, it } from 'vitest';
import { generateCapturedBeast } from '../beasts/generator.js';
import { allocateBeast, gainBeastExp } from '../beasts/progression.js';
import { automaticCommands } from '../combat/auto.js';
import { daoyouFormulas } from '../combat/daoyou/formulas.js';
import { generateDaoEquipmentV1 } from '../equipment/generator.js';
import { equipmentRealm } from '../equipment/realm.js';
import { compileTowerEncounter } from './content.js';
import { TOWER_ELIGIBLE_REALMS } from './helpers.js';
import { createTowerHost } from './host.js';
import { towerReferenceBuild } from './reference-fixtures.js';
import { getTowerSeasonMeta } from './season.js';
import { createTowerWeek, type TowerWeek } from './weekly.js';

const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-23')));

function withFloor(
  floor: number,
  combinationId: string,
  formationId: TowerWeek['floors'][number]['formationId'],
): TowerWeek {
  return {
    ...week,
    floors: week.floors.map((row) =>
      row.floor === floor ? { ...row, combinationId, formationId } : row,
    ),
  };
}

/** 圆满、本境满品阶道装、炼体软顶、高资质法术灵兽。不是稀有功法或经脉极限。 */
function highSpellBuild(realm: RealmType) {
  const player = towerReferenceBuild('jiujie', realm, '圆满');
  const level = getRealmStageLevel(realm, '圆满');
  const cap = BODY_CULTIVATION_PACK.realms.find(
    (row) =>
      row.realm === player.cultivator.condition.tracks.bodyCultivation.realm,
  )!.softTrackCap;
  for (const track of Object.values(
    player.cultivator.condition.tracks.bodyCultivation.tracks,
  ))
    track.level = cap;
  const equipmentLevel = [...OPEN_EQUIPMENT_LEVELS]
    .reverse()
    .find((n) => equipmentRealm(n).requiredLevel <= level)!;
  player.equipment = Object.fromEntries(
    DAO_EQUIPMENT_TEMPLATES_V1.map((template, index) => {
      const result = generateDaoEquipmentV1({
        id: `pressure-${index}`,
        templateId: template.id,
        equipmentLevel,
        baseQuality: 1,
        seed: 100 + index,
        createdAt: '2026-09-19T00:00:00Z',
        generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
      });
      if (!result.ok) throw new Error('高练度道装生成失败');
      return [template.slot, result.instance];
    }),
  );
  const species = [...BEAST_SPECIES]
    .filter((row) => row.carryLevel <= level)
    .sort((a, b) => b.aptitudes.mana.max - a.aptitudes.mana.max)[0]!;
  const grown = gainBeastExp(
    generateCapturedBeast(
      '00000000-0000-4000-8000-000000000002',
      player.cultivator.id,
      species.id,
      1,
      7,
    ),
    100000000,
    level,
  );
  grown.aptitudes = {
    attack: species.aptitudes.attack.max,
    defense: species.aptitudes.defense.max,
    health: species.aptitudes.health.max,
    mana: species.aptitudes.mana.max,
    speed: species.aptitudes.speed.max,
  };
  grown.growth = species.growthMilli.max / 1000;
  grown.skills = [
    'beast.thunder',
    'beast.advanced-spell-mastery',
    'beast.spell-critical',
    'beast.thunderstorm',
  ];
  grown.skillSlotCapacity = grown.skills.length;
  const pet = allocateBeast(
    grown,
    {
      constitution: level,
      strength: 0,
      magic: grown.unallocatedPoints - level,
      endurance: 0,
      agility: 0,
    },
    level,
  );
  player.beasts = {
    beasts: [pet],
    lineup: { carriedBeastIds: [pet.id], leadBeastId: pet.id, revision: 0 },
  };
  return player;
}

describe('蜃楼高练度法术与封印特色', () => {
  it('缚梦幻师对圆满法术构筑的封印命中落在可感知区间', () => {
    for (const realm of TOWER_ELIGIBLE_REALMS) {
      const selected = withFloor(5, 'binder-vital-swift', 'solo');
      const enemy = compileTowerEncounter(realm, 5, selected).units[0]!;
      const others = compileTowerEncounter(
        realm,
        5,
        withFloor(5, 'warrior-armor-charge', 'solo'),
      ).units[0]!;
      expect(others.attrs.sealHit, realm).toBe(45);
      const player = highSpellBuild(realm);
      const projected = createTowerHost(player, realm, 5, {}, selected, 7);
      const actor = projected.state.units.find(
        (unit) => unit.side === 0 && unit.kind === 'player',
      )!;
      const chance = daoyouFormulas.sealHitChance(
        enemy,
        actor,
        enemy.level,
        55,
      );
      expect(chance, realm).toBeGreaterThanOrEqual(0.62);
      expect(chance, realm).toBeLessThanOrEqual(0.7);
    }
  });

  it('金丹与渡劫的治疗阵容不会被高练度法术加灵兽一轮清掉', () => {
    for (const realm of ['金丹', '渡劫'] as const) {
      const selected = withFloor(5, 'mage-vital-swift', 'healer');
      const player = highSpellBuild(realm);
      const alive = [7, 42, 101].map((seed) => {
        const host = createTowerHost(player, realm, 1, {}, selected, seed);
        const input = host.runtimeSnapshot().input;
        const commands = automaticCommands(
          host.state,
          host.playerId,
          input.skills ?? [],
          (id) => host.queryCommands(id),
          { statusDefs: input.statusDefs },
        );
        const command = commands.find(
          (entry) => entry.unitId === host.playerId,
        );
        const choice = host
          .queryCommands(host.playerId)
          .skills.find(
            (skill) =>
              skill.skillId === 'jiujie.skill.thunderstorm' && skill.ready,
          );
        if (command && choice?.selectableTargetIds.length)
          command.command = {
            type: 'skill',
            skillId: choice.skillId,
            targets: choice.selectableTargetIds.slice(0, choice.targetCount),
          };
        host.submitGroup(commands);
        host.resolveRound();
        const enemies = host.state.units.filter((unit) => unit.side === 1);
        return enemies.every((unit) => unit.attrs.hp > 0);
      });
      expect(alive.filter(Boolean).length, realm).toBeGreaterThanOrEqual(2);
    }
  });
});

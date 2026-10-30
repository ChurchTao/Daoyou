import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { BODY_CULTIVATION_PACK } from '@daoyou/game-content/body-cultivation';
import { DAO_EQUIPMENT_TEMPLATES_V1 } from '@daoyou/game-content/equipment/base';
import {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  OPEN_EQUIPMENT_LEVELS,
} from '@daoyou/game-domain/equipment';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { describe, expect, it } from 'vitest';
import { generateCapturedBeast } from '../../beasts/generator.js';
import { allocateBeast, gainBeastExp } from '../../beasts/progression.js';
import { automaticCommands } from '../auto.js';
import { generateDaoEquipmentV1 } from '../../equipment/generator.js';
import { equipmentRealm } from '../../equipment/realm.js';
import { towerReferenceBuild } from '../../tower/reference-fixtures.js';
import { createDungeonHost, DungeonHost } from './host.js';

/**
 * 渡劫圆满、炼体软顶、170 满品阶六件套、本境最高资质灵兽。
 * 不含经脉和稀有功法。绝境前三场按回合模板：小怪、小怪、精英。
 */
function highBuild(sect: 'jiujie' | 'lingxiao') {
  const player = towerReferenceBuild(sect, '渡劫', '圆满');
  const level = getRealmStageLevel('渡劫', '圆满');
  const cap = BODY_CULTIVATION_PACK.realms.find(
    (row) =>
      row.realm === player.cultivator.condition!.tracks.bodyCultivation.realm,
  )!.softTrackCap;
  for (const track of Object.values(
    player.cultivator.condition!.tracks.bodyCultivation.tracks,
  ))
    track.level = cap;
  const equipmentLevel = [...OPEN_EQUIPMENT_LEVELS]
    .reverse()
    .find((n) => equipmentRealm(n).requiredLevel <= level)!;
  player.equipment = Object.fromEntries(
    DAO_EQUIPMENT_TEMPLATES_V1.map((template, index) => {
      const result = generateDaoEquipmentV1({
        id: `late-curve-${sect}-${index}`,
        templateId: template.id,
        equipmentLevel,
        baseQuality: 1,
        seed: 100 + index,
        createdAt: '2026-09-19T00:00:00Z',
        generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
      });
      if (!result.ok) throw new Error('道装生成失败');
      return [template.slot, result.instance];
    }),
  );
  const spell = sect === 'jiujie';
  const species = [...BEAST_SPECIES]
    .filter((row) => row.carryLevel <= level)
    .sort(
      (a, b) =>
        b.aptitudes[spell ? 'mana' : 'attack'].max -
        a.aptitudes[spell ? 'mana' : 'attack'].max,
    )[0]!;
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
  grown.skills = spell
    ? [
        'beast.thunder',
        'beast.advanced-spell-mastery',
        'beast.spell-critical',
        'beast.thunderstorm',
      ]
    : [
        'beast.strength',
        'beast.advanced-strength',
        'beast.critical',
        'beast.advanced-critical',
      ];
  grown.skillSlotCapacity = grown.skills.length;
  const spare = grown.unallocatedPoints - level;
  const pet = allocateBeast(
    grown,
    spell
      ? { constitution: level, strength: 0, magic: spare, endurance: 0, agility: 0 }
      : { constitution: level, strength: spare, magic: 0, endurance: 0, agility: 0 },
    level,
  );
  player.beasts = {
    beasts: [pet],
    lineup: { carriedBeastIds: [pet.id], leadBeastId: pet.id, revision: 0 },
  };
  player.cultivator.condition!.resources.hp.current = 1_000_000;
  player.cultivator.condition!.resources.mp.current = 1_000_000;
  return player;
}

function fight(
  player: ReturnType<typeof highBuild>,
  template: 'normal' | 'elite',
  seed: number,
  carry?: { hp: number; mp: number; beasts: Record<string, { hp: number; mp: number }> },
) {
  if (carry) {
    player.cultivator.condition!.resources.hp.current = carry.hp;
    player.cultivator.condition!.resources.mp.current = carry.mp;
  }
  let host = createDungeonHost(
    player,
    { realm: '渡劫', stage: '圆满', tier: 'boss', template },
    seed,
  );
  if (carry) {
    const snapshot = host.runtimeSnapshot();
    snapshot.input.units = snapshot.input.units.flatMap((unit) => {
      const previous =
        unit.ownerId === snapshot.playerId ? carry.beasts[unit.id!] : undefined;
      if (!previous) return [unit];
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
    host = new DungeonHost({
      version: snapshot.version,
      playerId: snapshot.playerId,
      input: snapshot.input,
    });
  }
  let rounds = 0;
  while (!host.finished && rounds < 40) {
    const input = host.runtimeSnapshot().input;
    host.submitGroup(
      automaticCommands(
        host.state,
        host.playerId,
        input.skills ?? [],
        (id) => host.queryCommands(id),
        { statusDefs: input.statusDefs },
      ),
    );
    host.resolveRound();
    rounds += 1;
  }
  const playerUnit = host.state.units.find((unit) => unit.id === host.playerId)!;
  return {
    ratio: (playerUnit.attrs.hp ?? 0) / (playerUnit.attrs.maxHp ?? 1),
    carry: {
      hp: playerUnit.attrs.hp ?? 0,
      mp: playerUnit.attrs.mp ?? 0,
      beasts: Object.fromEntries(
        host.state.units
          .filter((unit) => unit.ownerId === host.playerId)
          .map((unit) => [
            unit.id,
            { hp: unit.attrs.hp ?? 0, mp: unit.attrs.mp ?? 0 },
          ]),
      ),
    },
  };
}

describe('渡劫绝境续航', () => {
  it.each(['jiujie', 'lingxiao'] as const)(
    '%s 圆满高练度连打三场后仍留三成血',
    (sect) => {
      const player = highBuild(sect);
      for (const start of [1, 3, 7, 11, 42, 99, 123, 256, 1000, 2024]) {
        let carry: ReturnType<typeof fight>['carry'] | undefined;
        let ratio = 0;
        let seed = start;
        for (const template of ['normal', 'normal', 'elite'] as const) {
          const result = fight(structuredClone(player), template, seed, carry);
          ratio = result.ratio;
          carry = result.carry;
          seed += 1;
        }
        expect(ratio).toBeGreaterThanOrEqual(0.3);
      }
    },
  );
});

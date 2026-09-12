import { expect, it } from 'vitest';
import {
  CommandType,
  EffectType,
  EventType,
  SkillTag,
  StatusCategory,
  TargetSide,
  createBattle,
  type SkillDef,
  type StatusDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_4B_VERSIONS } from '../version';
import { compileDaoEquipmentSpecialLoadoutV1 } from './compiler';
import before from './fixtures/special-before-g2.json';
import { generateDaoEquipmentV2 } from './generator';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
  DAO_RAGE_RESOURCE_ID,
  createDaoRageGainPassive,
} from './special-content';
import type { DaoEquipmentArtDefV1, DaoEquipmentSlot } from './types';

const ruleset = createDaoyouRuleset({
  formulas: {
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
  },
});

function runArt(art: DaoEquipmentArtDefV1) {
  const seedStatus: StatusDef = {
    id: 'test.status',
    name: 'test',
    kind: 'test',
    category:
      art.skill.targeting.side === TargetSide.Ally
        ? StatusCategory.Control
        : StatusCategory.Buff,
  };
  const battle = createBattle({
    seed: 123,
    versions: COMBAT_V6_PHASE_4B_VERSIONS,
    ruleset,
    skills: [art.skill],
    statusDefs: [...(art.statusDefs ?? []), seedStatus],
    units: ['source', 'ally', 'enemy', 'enemy2', 'enemy3'].map((id, i) => ({
      id,
      name: id,
      side: i < 2 ? 0 : 1,
      kind: 'player',
      skills: i === 0 ? [art.skill.id] : [],
      resources: [
        { id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 150, max: 150 },
      ],
      attrs: {
        hp: 400,
        maxHp: 1000,
        mp: 10,
        maxMp: 200,
        speed: 100 - i * 10,
        physicalAtk: 100,
        physicalDef: 40,
        magicAtk: 100,
        magicDef: 40,
      },
    })),
  });
  const targetId =
    art.skill.targeting.side === TargetSide.Ally ? 'ally' : 'enemy';
  const target = battle.unit(targetId);
  if (art.skill.effects[0].type === EffectType.Revive) {
    target.attrs.hp = 0;
    target.flags.downed = true;
  }
  if (art.skill.effects[0].type === EffectType.Dispel)
    target.statuses.push({
      id: seedStatus.id,
      kind: seedStatus.kind,
      remainingRounds: 3,
      sourceId: 'source',
      appliedRound: 0,
      speedMod: 0,
      attrMods: {},
      damageTakenPhysical: 1,
      damageTakenSpell: 1,
      healTaken: 1,
      healDealt: 1,
      stacks: 1,
    });
  battle.submit('source', {
    type: CommandType.Skill,
    skillId: art.skill.id,
    targets: [targetId],
  });
  for (const id of ['ally', 'enemy', 'enemy2', 'enemy3'])
    if (!battle.unit(id).flags.downed)
      battle.submit(id, { type: CommandType.Defend });
  battle.lockAndResolve();
  return { state: battle.snapshot(), events: battle.log() };
}

it.each(DAO_EQUIPMENT_ARTS_V1)(
  'preserves $name resolution and pays its configured rage cost',
  (art) => {
    const result = runArt(art);
    expect(result).toEqual(
      runArt(
        before.arts.find(
          (entry) => entry.id === art.id,
        ) as unknown as DaoEquipmentArtDefV1,
      ),
    );
    expect(
      result.events.some((event) => event.type === EventType.ActionFailed),
    ).toBe(false);
    expect(result.state.units[0].resources[0].current).toBe(150 - art.rageCost);
    const ally = result.state.units[1];
    switch (art.skill.effects[0].type) {
      case EffectType.Heal:
        expect(ally.attrs.hp).toBe(650);
        break;
      case EffectType.RestoreMp:
        expect(ally.attrs.mp).toBe(60);
        break;
      case EffectType.Revive:
        expect(ally.attrs.hp).toBe(200);
        expect(ally.flags.downed).toBe(false);
        break;
      case EffectType.Dispel:
        expect(
          result.state.units.every(
            (unit) =>
              !unit.statuses.some((status) => status.id === 'test.status'),
          ),
        ).toBe(true);
        break;
      case EffectType.ApplyStatus:
        expect(
          ally.statuses.some((status) => status.id === art.statusDefs?.[0].id),
        ).toBe(true);
        break;
      case EffectType.PhysicalHit:
        expect(result.state.units[2].attrs.hp).toBeLessThan(400);
        break;
      case EffectType.SpellHit:
        expect(
          result.state.units.slice(2).every((unit) => unit.attrs.hp < 400),
        ).toBe(true);
        break;
    }
  },
);

it('preserves the existing source-side rage trigger and per-action cap', () => {
  // Existing content uses sourceIsSelf on OnBeHit. Preserve this behavior in G2;
  // changing it to targetIsSelf is a separate gameplay fix, not configuration migration.
  function resolve(passive: SkillDef) {
    const attack: SkillDef = {
      id: 'test.multi',
      name: 'multi',
      tags: [SkillTag.Physical],
      targeting: { side: TargetSide.Enemy, count: 1 },
      effects: Array.from({ length: 3 }, () => ({
        type: EffectType.PhysicalHit,
        coeff: 1,
      })),
    };
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_4B_VERSIONS,
      ruleset,
      skills: [attack, passive],
      units: [
        {
          id: 'attacker',
          name: 'attacker',
          side: 0,
          kind: 'player',
          skills: [attack.id],
          passives: [passive.id],
          resources: [
            { id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 0, max: 150 },
          ],
          attrs: { hp: 1000, speed: 100, physicalAtk: 300, physicalDef: 0 },
        },
        {
          id: 'defender',
          name: 'defender',
          side: 1,
          kind: 'player',
          passives: [passive.id],
          resources: [
            { id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 0, max: 150 },
          ],
          attrs: { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 0 },
        },
      ],
    });
    battle.submit('attacker', {
      type: CommandType.Skill,
      skillId: attack.id,
      targets: ['defender'],
    });
    battle.submit('defender', { type: CommandType.Defend });
    battle.lockAndResolve();
    return battle.snapshot();
  }
  const state = resolve(createDaoRageGainPassive(1.2));
  expect(state).toEqual(resolve(before.passives[1] as unknown as SkillDef));
  expect(state.units[0].resources[0].current).toBe(30);
  expect(state.units[1].resources[0].current).toBe(0);
});

function equipment(
  slot: DaoEquipmentSlot,
  essenceIds: string[],
  artId?: string,
) {
  const result = generateDaoEquipmentV2({
    id: slot,
    templateId: `dao_equipment.standard.${slot}.v1`,
    equipmentLevel: 90,
    seed: 1,
    createdAt: 'test',
    generatorVersion: 'dao_equipment_generator_v2',
  });
  if (!result.ok) throw new Error('generation failed');
  return { ...result.instance, essenceIds, artId };
}

it('preserves stacked panels, highest factors, cost rounding and conflict rejection', () => {
  const loadout = {
    weapon: equipment(
      'weapon',
      [DAO_EQUIPMENT_ESSENCES_V1[0].id, DAO_EQUIPMENT_ESSENCES_V1[5].id],
      DAO_EQUIPMENT_ARTS_V1[0].id,
    ),
    head: equipment('head', [
      DAO_EQUIPMENT_ESSENCES_V1[0].id,
      DAO_EQUIPMENT_ESSENCES_V1[5].id,
    ]),
    armor: equipment('armor', [DAO_EQUIPMENT_ESSENCES_V1[6].id]),
  };
  const result = compileDaoEquipmentSpecialLoadoutV1(loadout, 180);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.projection.panel).toContainEqual({
    attr: 'critRate',
    value: 0.06,
  });
  expect(result.projection.rageGainFactor).toBe(1.2);
  expect(result.projection.rageCostFactor).toBe(0.8);
  expect(result.projection.skillOverrides[0].resourceCosts?.[0].amount).toBe(
    32,
  );
  const conflict = DAO_EQUIPMENT_ESSENCES_V1.map((entry) => ({
    ...entry,
    conflictGroup: 'exclusive',
  }));
  expect(
    compileDaoEquipmentSpecialLoadoutV1(loadout, 180, { essenceDefs: conflict })
      .ok,
  ).toBe(false);
});

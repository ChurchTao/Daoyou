import { describe, expect, it } from 'vitest';
import {
  CommandType,
  createBattle,
  DamageKind,
  EffectType,
  EventType,
  HookName,
  SkillTag,
  StatusCategory,
  TargetSide,
  type SkillDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_4B_VERSIONS } from '../version';
import {
  compileDaoEquipmentSpecialLoadoutV1,
  daoEquipmentRequiredLevel,
} from './compiler';
import data from './data/equipment-special.json';
import { generateDaoEquipmentV2 } from './generator';
import { compileEquipmentEssence } from './special-compiler';
import {
  createDaoRageGainPassive,
  DAO_EQUIPMENT_ESSENCES_V1,
} from './special-content';
import { loadEquipmentSpecialPack } from './special-pack';
import type { DaoEquipmentSlot } from './types';

const pack = loadEquipmentSpecialPack(data);
const id = (key: string) => `dao_equipment.essence.${key}`;
function item(slot: DaoEquipmentSlot, keys: string[], level = 30) {
  const result = generateDaoEquipmentV2({
    id: slot,
    templateId: `dao_equipment.standard.${slot}.v1`,
    equipmentLevel: level,
    seed: 10,
    createdAt: 'test',
    generatorVersion: 'dao_equipment_generator_v2',
  });
  if (!result.ok) throw new Error('generation');
  return { ...result.instance, essenceIds: keys.map(id), artId: undefined };
}
function passive(key: string, chance?: number): SkillDef {
  const entry = structuredClone(
    pack.essences.find((entry) => entry.id === id(key))!,
  );
  if (chance !== undefined && 'chance' in entry.effect)
    entry.effect.chance = chance;
  const compiled = compileEquipmentEssence(entry).passive;
  if (!compiled) throw new Error('passive');
  return compiled;
}
function battleWith(
  skills: SkillDef[],
  playerPassives: string[],
  attack?: SkillDef,
  seed = 5,
) {
  return createBattle({
    seed,
    versions: COMBAT_V6_PHASE_4B_VERSIONS,
    ruleset: createDaoyouRuleset({
      formulas: {
        physicalHitChance: () => 1,
        physicalFluctuationMin: 1,
        physicalFluctuationMax: 1,
        fluctuationMin: 1,
        fluctuationMax: 1,
      },
    }),
    skills: [...skills, ...(attack ? [attack] : [])],
    statusDefs: [
      {
        id: 'ban',
        name: '禁复起',
        kind: 'ban',
        category: StatusCategory.Debuff,
        blocksRevive: true,
      },
    ],
    units: [
      {
        id: 'self',
        name: 'self',
        side: 0,
        kind: 'player',
        level: 45,
        passives: playerPassives,
        skills: attack ? [attack.id] : [],
        attrs: {
          hp: 400,
          maxHp: 1000,
          mp: 100,
          maxMp: 100,
          healPower: 500,
          speed: 100,
          physicalAtk: 100,
          magicAtk: 100,
          physicalDef: 0,
          magicDef: 0,
          critRate: 0,
          spellCritRate: 0,
        },
      },
      {
        id: 'foe',
        name: 'foe',
        side: 1,
        kind: 'player',
        attrs: {
          hp: 10000,
          maxHp: 10000,
          speed: 1,
          physicalAtk: 100,
          critRate: 0,
        },
      },
    ],
  });
}
function resolve(battle: ReturnType<typeof battleWith>, skill?: SkillDef) {
  battle.submit(
    'self',
    skill
      ? { type: CommandType.Skill, skillId: skill.id, targets: ['foe'] }
      : { type: CommandType.Defend },
  );
  battle.submit('foe', { type: CommandType.Defend });
  battle.lockAndResolve();
}

describe('器蕴精修', () => {
  it('仅开放14种并由参数渲染说明', () => {
    expect(pack.essences).toHaveLength(14);
    expect(
      DAO_EQUIPMENT_ESSENCES_V1.every(
        (entry) => entry.description && !entry.description.includes('{'),
      ),
    ).toBe(true);
    const entry = structuredClone(
      pack.essences.find((entry) => entry.id === id('huming'))!,
    );
    if (entry.effect.type !== 'revival') throw new Error('type');
    entry.effect.chance = 0.4;
    expect(compileEquipmentEssence(entry).description).toContain('40%');
    expect(entry.effect.hpRatio).toBe(0.3);
  });
  it('轻灵仅让自身提前一个小境界，最低炼气初期', () => {
    const weapon = item('weapon', ['qingling']);
    const head = item('head', []);
    expect(daoEquipmentRequiredLevel(weapon)).toBe(20);
    expect(daoEquipmentRequiredLevel(head)).toBe(25);
    expect(compileDaoEquipmentSpecialLoadoutV1({ weapon }, 20).ok).toBe(true);
    expect(compileDaoEquipmentSpecialLoadoutV1({ weapon, head }, 20).ok).toBe(
      false,
    );
    expect(daoEquipmentRequiredLevel(item('weapon', ['qingling'], 10))).toBe(5);
  });
  it('双器蕴不重复，腰带归元激昂共存，部位限制生效', () => {
    expect(
      compileDaoEquipmentSpecialLoadoutV1(
        { belt: item('belt', ['guiyuan', 'jiangang']) },
        100,
      ).ok,
    ).toBe(true);
    expect(
      compileDaoEquipmentSpecialLoadoutV1(
        { weapon: item('weapon', ['guiyuan']) },
        100,
      ).ok,
    ).toBe(false);
    expect(
      compileDaoEquipmentSpecialLoadoutV1(
        { head: item('head', ['huming']) },
        100,
      ).ok,
    ).toBe(false);
    expect(
      compileDaoEquipmentSpecialLoadoutV1(
        { necklace: item('necklace', ['chengnian', 'chengnian']) },
        100,
      ).ok,
    ).toBe(false);
  });
  it('同名回春只生效一次，按人物等级恢复且不受治疗强度放大', () => {
    const result = compileDaoEquipmentSpecialLoadoutV1(
      {
        head: item('head', ['huichun']),
        footwear: item('footwear', ['huichun']),
      },
      100,
    );
    if (!result.ok) throw new Error('compile');
    const battle = battleWith(
      result.projection.skills,
      result.projection.passiveSkillIds,
    );
    resolve(battle);
    expect(battle.unit('self').attrs.hp).toBe(422);
    battle.unit('self').attrs.hp = 995;
    resolve(battle);
    expect(battle.unit('self').attrs.hp).toBe(1000);
  });
  it('回春不能复起倒地者', () => {
    const p = passive('huichun');
    const battle = battleWith([p], [p.id]);
    battle.unit('self').attrs.hp = 0;
    battle.unit('self').flags.downed = true;
    battle.hooks.emit(HookName.OnRoundEnd);
    expect(battle.unit('self').attrs.hp).toBe(0);
  });
  it('护命恢复30%最大气血，独立死亡可再次触发，同一次不重复回复', () => {
    const p = passive('huming', 1);
    const battle = battleWith([p], [p.id]);
    for (let i = 0; i < 2; i++) {
      battle.unit('self').attrs.hp = 0;
      battle.hooks.emit(HookName.OnFatal, {
        target: battle.unit('self'),
        source: battle.unit('foe'),
      });
      expect(battle.unit('self').attrs.hp).toBe(300);
      battle.hooks.emit(HookName.OnFatal, { target: battle.unit('self') });
      expect(battle.unit('self').attrs.hp).toBe(300);
    }
    expect(
      battle.log().filter((event) => event.type === EventType.UnitRevived),
    ).toHaveLength(2);
  });
  it('禁复活阻断护命，零概率不会触发', () => {
    for (const chance of [0, 1]) {
      const p = passive('huming', chance);
      const battle = battleWith([p], [p.id]);
      if (chance === 1) battle.applyStatus('self', 'ban', 3);
      battle.unit('self').attrs.hp = 0;
      battle.hooks.emit(HookName.OnFatal, { target: battle.unit('self') });
      expect(battle.unit('self').attrs.hp).toBe(0);
    }
  });
  it('抗暴与忽防跨装备加算，各自只影响对应伤害类型', () => {
    const result = compileDaoEquipmentSpecialLoadoutV1(
      {
        head: item('head', ['zhenyue', 'pojia']),
        armor: item('armor', ['zhenyue', 'pojia']),
      },
      100,
    );
    if (!result.ok) throw new Error('compile');
    const battle = battleWith(
      result.projection.skills,
      result.projection.passiveSkillIds,
    );
    expect(
      battle.hooks.emit(HookName.OnCritRoll, {
        source: battle.unit('foe'),
        target: battle.unit('self'),
        kind: DamageKind.Physical,
        chance: 0.1,
      }).chance,
    ).toBeCloseTo(0.08);
    expect(
      battle.hooks.emit(HookName.OnCritRoll, {
        source: battle.unit('foe'),
        target: battle.unit('self'),
        kind: DamageKind.Spell,
        chance: 0.1,
      }).chance,
    ).toBe(0.1);
    expect(
      battle.hooks.emit(HookName.OnDefenseIgnoreCalc, {
        source: battle.unit('self'),
        target: battle.unit('foe'),
        kind: DamageKind.Physical,
        defenseIgnore: 0.1,
      }).defenseIgnore,
    ).toBeCloseTo(0.14);
    expect(
      battle.hooks.emit(HookName.OnDefenseIgnoreCalc, {
        source: battle.unit('self'),
        target: battle.unit('foe'),
        kind: DamageKind.Fixed,
        defenseIgnore: 0,
      }).defenseIgnore,
    ).toBe(0);
  });
  it('封禁器蕴贡献一个百分点且仍遵守封印公式上下限', () => {
    const battle = battleWith([], []);
    const source = battle.unit('self');
    const target = battle.unit('foe');
    source.level = target.level = 45;
    const formula = createDaoyouRuleset().formulas.sealHitChance;
    const baseline = formula(source, target, 45);
    const entry = DAO_EQUIPMENT_ESSENCES_V1.find(
      (entry) => entry.id === id('pojin'),
    )!;
    source.attrs.sealHit += entry.panel![0].value;
    expect(formula(source, target, 45) - baseline).toBeCloseTo(0.01);
    source.attrs.sealHit = 10000;
    expect(formula(source, target, 45)).toBe(0.9);
  });
  it('激昂在基础单次战意封顶后提高25%，由受击者获得', () => {
    const p = createDaoRageGainPassive(1.25);
    const battle = battleWith([p], [p.id]);
    battle
      .unit('self')
      .resources.push({
        id: 'combat.resource.rage',
        name: '战意',
        current: 0,
        max: 150,
      });
    battle.hooks.emit(HookName.OnBeHit, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      hpDamage: 300,
    });
    expect(battle.unit('self').resources[0].current).toBe(25);
    battle.hooks.emit(HookName.OnBeHit, {
      source: battle.unit('self'),
      target: battle.unit('foe'),
      hpDamage: 300,
    });
    expect(battle.unit('self').resources[0].current).toBe(25);
  });
  it('澄念整次施法仅判定一次，法力不足仍无法施法', () => {
    const attack: SkillDef = {
      id: 'spell',
      name: '术',
      tags: [SkillTag.Spell],
      costMp: 20,
      targeting: { side: TargetSide.Enemy },
      effects: [
        { type: EffectType.SpellHit, coeff: 1 },
        { type: EffectType.SpellHit, coeff: 1 },
      ],
    };
    for (const chance of [0, 1]) {
      const p = passive('chengnian', chance);
      const battle = battleWith([p], [p.id], attack);
      resolve(battle, attack);
      expect(battle.unit('self').attrs.mp).toBe(chance === 1 ? 100 : 80);
      expect(
        battle.log().filter((event) => event.type === EventType.MpCost),
      ).toHaveLength(chance === 1 ? 0 : 1);
    }
    const p = passive('chengnian', 1);
    const battle = battleWith([p], [p.id], attack);
    battle.unit('self').attrs.mp = 0;
    resolve(battle, attack);
    expect(
      battle
        .log()
        .some(
          (event) =>
            event.type === EventType.Hit && event.kind === DamageKind.Spell,
        ),
    ).toBe(false);
  });
});

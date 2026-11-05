import { describe, expect, it } from 'vitest';
import { CommandType, DamageKind, EffectType, EventType, HookName, SkillTag, StatusCategory, StatusHit, TargetSide } from '@daoyou/combat-core/enums';
import { createBattle } from '@daoyou/combat-core/session';
import { type SkillDef, type StatusDef } from '@daoyou/combat-core/types';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS } from '@daoyou/game-domain/combat';
import {
  compileDaoEquipmentSpecialLoadoutV1,
  daoEquipmentRequiredLevel,
} from './compiler.js';
import {
  EQUIPMENT_EQUIPMENT_SPECIAL_DATA as data,
  compileEquipmentEssence,
} from '@daoyou/game-content/authoring/equipment';
import { generateDaoEquipmentV2 } from './generator.js';
import {
  createDaoRageGainPassive,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@daoyou/game-content/equipment/special';
import { DAO_RAGE_RESOURCE_ID } from '@daoyou/game-domain/equipment';
import { loadEquipmentSpecialPack } from '@daoyou/game-domain/equipment/authoring/special';
import type { DaoEquipmentSlot } from '@daoyou/game-domain/equipment';

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
  extraStatuses: StatusDef[] = [],
) {
  return createBattle({
    seed,
    versions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
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
      ...extraStatuses,
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
  it('从护命参数生成说明', () => {
    const entry = structuredClone(
      pack.essences.find((entry) => entry.id === id('huming'))!,
    );
    if (entry.effect.type !== 'revival') throw new Error('type');
    entry.effect.chance = 0.4;
    expect(compileEquipmentEssence(entry).description).toContain('40%');
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
  it('同类面板叠加，战意折扣作用于器诀，并拒绝互斥器蕴', () => {
    const loadout = {
      weapon: { ...item('weapon', ['cangfeng'], 90), artId: 'dao_equipment.art.huiyuan' },
      head: item('head', ['cangfeng'], 90),
      belt: item('belt', ['jiangang', 'guiyuan'], 90),
    };
    const result = compileDaoEquipmentSpecialLoadoutV1(loadout, 180);
    if (!result.ok) throw new Error('道装编译失败');
    expect(result.projection.panel).toContainEqual({ attr: 'critRate', value: 0.06 });
    expect(result.projection.rageGainFactor).toBe(1.25);
    expect(result.projection.skillOverrides[0].resourceCosts?.[0].amount).toBe(24);

    const essenceDefs = DAO_EQUIPMENT_ESSENCES_V1.map((entry) => ({
      ...entry,
      conflictGroup: 'exclusive',
    }));
    expect(compileDaoEquipmentSpecialLoadoutV1(loadout, 180, { essenceDefs }).ok).toBe(false);
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
    ).toBeCloseTo(0.06);
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
  it('封禁器蕴贡献固定3个百分点且仍遵守封印公式上下限', () => {
    const battle = battleWith([], []);
    const source = battle.unit('self');
    const target = battle.unit('foe');
    const formula = createDaoyouRuleset().formulas.sealHitChance;
    const pojing = DAO_EQUIPMENT_ESSENCES_V1.find(
      (entry) => entry.id === id('pojin'),
    )!;
    const dinghun = DAO_EQUIPMENT_ESSENCES_V1.find(
      (entry) => entry.id === id('dinghun'),
    )!;
    expect(pojing.passive?.modifiers?.[0].sealChanceAdd).toBe(0.03);
    expect(dinghun.passive?.modifiers?.[0].sealResistanceAdd).toBe(0.03);
    for (const level of [45, 150]) {
      source.level = target.level = level;
      const baseline = formula(source, target, level);
      expect(formula(source, target, level, undefined, 0.03) - baseline).toBeCloseTo(0.03);
      expect(baseline - formula(source, target, level, undefined, -0.03)).toBeCloseTo(0.03);
    }
    source.level = target.level = 45;
    expect(formula(source, target, 45, undefined, 1)).toBeGreaterThan(0.94);
    expect(formula(source, target, 45, undefined, 1)).toBeLessThanOrEqual(0.95);
  });
  it('激昂按失血比例提高受击战意，单次获得最多100', () => {
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
      hpDamage: 5,
    });
    expect(battle.unit('self').resources[0].current).toBe(0);
    battle.hooks.emit(HookName.OnBeHit, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      hpDamage: 300,
    });
    expect(battle.unit('self').resources[0].current).toBe(37);
    battle.hooks.emit(HookName.OnBeHit, {
      source: battle.unit('self'),
      target: battle.unit('foe'),
      hpDamage: 300,
    });
    expect(battle.unit('self').resources[0].current).toBe(37);
    battle.hooks.emit(HookName.OnBeHit, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      hpDamage: 1000,
    });
    expect(battle.unit('self').resources[0].current).toBe(137);
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

describe('新增器蕴', () => {
  const essence = (key: string) =>
    DAO_EQUIPMENT_ESSENCES_V1.find((entry) => entry.id === id(key))!;
  const hitsOf = (battle: ReturnType<typeof battleWith>) =>
    battle.log().filter((event) => event.type === EventType.Hit && event.sourceId === 'self');

  it('噬灵按普攻实际扣血恢复法力', () => {
    const skill = essence('shiling').passive!;
    const battle = battleWith([skill], [skill.id]);
    battle.unit('self').attrs.mp = 0;
    battle.submit('self', { type: CommandType.Attack, target: 'foe' });
    battle.submit('foe', { type: CommandType.Defend });
    battle.lockAndResolve();
    const lost = 10000 - battle.unit('foe').attrs.hp;
    expect(battle.unit('self').attrs.mp).toBe(Math.floor(lost * 0.08));
    const mp = battle.unit('self').attrs.mp;
    battle.hooks.emit(HookName.AfterHit, {
      source: battle.unit('self'),
      target: battle.unit('foe'),
      skillId: 'dao_equipment.skill.other',
      kind: DamageKind.Physical,
      hpDamage: 100,
    });
    expect(battle.unit('self').attrs.mp).toBe(mp);
  });

  it('连珠每回合至多追加一次50%强度的物理攻击', () => {
    const entry = structuredClone(pack.essences.find((item) => item.id === id('lianzhu'))!);
    if (entry.effect.type !== 'attackFollowUp') throw new Error('type');
    entry.effect.chance = 1;
    const skill = compileEquipmentEssence(entry).passive!;
    const battle = battleWith([skill], [skill.id]);
    battle.submit('self', { type: CommandType.Attack, target: 'foe' });
    battle.submit('foe', { type: CommandType.Defend });
    battle.lockAndResolve();
    expect(hitsOf(battle)).toHaveLength(2);
    const again = battleWith([skill], [skill.id]);
    const strike = {
      source: again.unit('self'),
      target: again.unit('foe'),
      skillId: 'attack',
      kind: DamageKind.Physical,
      hpDamage: 20,
      isPrimary: true,
    };
    again.hooks.emit(HookName.AfterHit, strike);
    again.hooks.emit(HookName.AfterHit, strike);
    expect(hitsOf(again)).toHaveLength(1);
  });

  it('定神以6%概率在回合开始解除一个可解除控制', () => {
    expect(essence('dingshen').passive?.hooks?.[0].chance).toBe(0.06);
    const entry = structuredClone(pack.essences.find((item) => item.id === id('dingshen'))!);
    if (entry.effect.type !== 'roundStartCleanse') throw new Error('type');
    entry.effect.chance = 1;
    const skill = compileEquipmentEssence(entry).passive!;
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
      ruleset: createDaoyouRuleset(),
      skills: [skill],
      statusDefs: [{ id: 'lock', name: '定身', kind: 'lock', category: StatusCategory.Control, blocksAction: true }],
      units: [{
        id: 'self', name: 'self', side: 0, kind: 'player', level: 10, passives: [skill.id],
        attrs: { hp: 100, maxHp: 100, speed: 10 },
      }, {
        id: 'foe', name: 'foe', side: 1, kind: 'player', level: 10,
        attrs: { hp: 100, maxHp: 100, speed: 1 },
      }],
    });
    battle.applyStatus('self', 'lock', 3, 'foe');
    battle.hooks.emit(HookName.OnRoundStart);
    expect(battle.unit('self').statuses.some((status) => status.id === 'lock')).toBe(false);
  });

  it('镜心在封印落空时获得10点战意', () => {
    const skill = essence('jingxin').passive!;
    const battle = battleWith([skill], [skill.id]);
    battle.unit('self').resources.push({ id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 0, max: 150 });
    battle.hooks.emit(HookName.OnStatusResolved, {
      source: battle.unit('self'),
      target: battle.unit('foe'),
      statusHit: StatusHit.Seal,
      statusResult: 'applied',
    });
    expect(battle.unit('self').resources[0].current).toBe(0);
    battle.hooks.emit(HookName.OnStatusResolved, {
      source: battle.unit('self'),
      target: battle.unit('foe'),
      statusHit: StatusHit.Seal,
      statusResult: 'miss',
    });
    expect(battle.unit('self').resources[0].current).toBe(10);
  });

  it('不屈在气血低于35%时把受到的伤害结果降低5%', () => {
    const skill = essence('buqu').passive!;
    expect(skill.modifiers?.[0]).toMatchObject({
      allDamageTakenBonus: -0.05,
      when: { sourceHpRatioBelow: 0.35 },
    });
    const battle = battleWith([skill], [skill.id]);
    battle.unit('self').attrs.hp = 300;
    battle.unit('self').attrs.speed = 1;
    battle.unit('foe').attrs.speed = 100;
    battle.unit('foe').attrs.physicalAtk = 100;
    const bare = battleWith([], []);
    bare.unit('self').attrs.hp = 300;
    bare.unit('self').attrs.speed = 1;
    bare.unit('foe').attrs.speed = 100;
    bare.unit('foe').attrs.physicalAtk = 100;
    for (const current of [battle, bare]) {
      current.submit('foe', { type: CommandType.Attack, target: 'self' });
      current.submit('self', { type: CommandType.Defend });
      current.lockAndResolve();
    }
    const wounded = 300 - battle.unit('self').attrs.hp;
    const plain = 300 - bare.unit('self').attrs.hp;
    expect(wounded).toBe(Math.floor(plain * 0.95));
  });

  it('金身把获得的护盾提高12%', () => {
    const skill = essence('jinshen').passive!;
    const battle = battleWith([skill], [skill.id]);
    const shielded = battle.hooks.emit(HookName.OnBarrierCalc, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      barrier: 100,
    });
    expect(shielded.barrier).toBeCloseTo(112);
  });

  it('纳灵在回合结束恢复最大法力的5%', () => {
    const skill = essence('naling').passive!;
    const battle = battleWith([skill], [skill.id]);
    battle.unit('self').attrs.mp = 0;
    battle.hooks.emit(HookName.OnRoundEnd);
    expect(battle.unit('self').attrs.mp).toBe(5);
    battle.unit('self').attrs.mp = 0;
    battle.unit('self').flags.downed = true;
    battle.hooks.emit(HookName.OnRoundEnd);
    expect(battle.unit('self').attrs.mp).toBe(0);
  });

  it('余温先提高治疗基数，同泽按基数的20%回哺并受减疗约束', () => {
    const heal: SkillDef = {
      id: 'heal',
      name: '疗',
      tags: [SkillTag.Spell],
      targeting: { side: TargetSide.Ally, count: 1 },
      effects: [{ type: EffectType.Heal, power: '100', fixedBase: true }],
    };
    const fight = (keys: string[], reduced?: 'ally' | 'self') => {
      const skills = keys.map((key) => essence(key).passive!);
      const battle = createBattle({
        seed: 1,
        versions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
        ruleset: createDaoyouRuleset(),
        skills: [...skills, heal],
        statusDefs: [{ id: 'less', name: '减疗', kind: 'less', category: StatusCategory.Debuff, healTaken: 0.5 }],
        units: [
          {
            id: 'self', name: 'self', side: 0, kind: 'player', level: 20,
            passives: skills.map((skill) => skill.id), skills: ['heal'],
            attrs: { hp: 100, maxHp: 1000, speed: 20, healPower: 0 },
          },
          {
            id: 'ally', name: 'ally', side: 0, kind: 'player', level: 20,
            attrs: { hp: 100, maxHp: 1000, speed: 1 },
          },
          {
            id: 'foe', name: 'foe', side: 1, kind: 'player', level: 20,
            attrs: { hp: 100, maxHp: 100, speed: 1 },
          },
        ],
      });
      if (reduced) battle.applyStatus(reduced, 'less', 3, 'foe');
      battle.submit('self', { type: CommandType.Skill, skillId: 'heal', targets: ['ally'] });
      battle.submit('ally', { type: CommandType.Defend });
      battle.submit('foe', { type: CommandType.Defend });
      battle.lockAndResolve();
      return battle;
    };
    expect(fight(['yuwen']).unit('ally').attrs.hp).toBe(210);
    expect(fight(['yuwen'], 'ally').unit('ally').attrs.hp).toBe(155);
    const echoed = fight(['yuwen', 'tongze']);
    expect(echoed.unit('ally').attrs.hp).toBe(210);
    expect(echoed.unit('self').attrs.hp).toBe(122);
    expect(fight(['tongze'], 'self').unit('self').attrs.hp).toBe(110);
  });

  it('止戈、余怒和蓄势按确认数值处理战意', () => {
    const guard = essence('zhige').passive!;
    const guarded = battleWith([guard], [guard.id]);
    guarded.unit('self').resources.push({ id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 0, max: 150 });
    guarded.hooks.emit(HookName.AfterDefend, { source: guarded.unit('self'), target: guarded.unit('self') });
    expect(guarded.unit('self').resources[0].current).toBe(5);

    const refund = essence('yunu').passive!;
    const art: SkillDef = {
      id: 'art',
      name: '诀',
      tags: [SkillTag.Art],
      resourceCosts: [{ resourceId: DAO_RAGE_RESOURCE_ID, amount: 40 }],
      originalResourceCosts: [{ resourceId: DAO_RAGE_RESOURCE_ID, amount: 100 }],
      targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{ type: EffectType.FixedHit, power: '1' }],
    };
    const battle = battleWith([refund], [refund.id], art);
    battle.unit('self').resources.push({ id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 40, max: 150 });
    battle.submit('self', { type: CommandType.Skill, skillId: 'art', targets: ['foe'] });
    battle.submit('foe', { type: CommandType.Defend });
    battle.lockAndResolve();
    expect(battle.unit('self').resources[0].current).toBe(6);

    const opened = compileDaoEquipmentSpecialLoadoutV1(
      { belt: item('belt', ['xushi']) },
      100,
    );
    if (!opened.ok) throw new Error('compile');
    expect(opened.projection.rageInitialAdd).toBe(10);
    expect(essence('xushi').description).toContain('10');
  });

  it('踏虚只提高对较慢主目标的伤害结果4%', () => {
    const skill = essence('taxu').passive!;
    expect(skill.modifiers?.every((modifier) => modifier.damageResultFactor === 1.04 && modifier.when?.targetSlot === 'primary')).toBe(true);
    const battle = battleWith([skill], [skill.id]);
    const bare = battleWith([], []);
    for (const current of [battle, bare]) {
      current.submit('self', { type: CommandType.Attack, target: 'foe' });
      current.submit('foe', { type: CommandType.Defend });
      current.lockAndResolve();
    }
    const boosted = 10000 - battle.unit('foe').attrs.hp;
    const plain = 10000 - bare.unit('foe').attrs.hp;
    expect(boosted).toBe(Math.floor(plain * 1.04));
  });

  it('避锋把受到的物理命中率降低4个百分点', () => {
    const skill = essence('bifeng').passive!;
    const battle = battleWith([skill], [skill.id]);
    const rolled = battle.hooks.emit(HookName.OnHitRoll, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      kind: DamageKind.Physical,
      chance: 0.8,
    });
    expect(rolled.chance).toBeCloseTo(0.76);
    const spell = battle.hooks.emit(HookName.OnHitRoll, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      kind: DamageKind.Spell,
      chance: 0.8,
    });
    expect(spell.chance).toBe(0.8);
  });

  it('绝尘在气血首次低于30%时提高速度，本场只触发一次', () => {
    const skill = essence('juechen').passive!;
    const result = compileDaoEquipmentSpecialLoadoutV1(
      { footwear: item('footwear', ['juechen']) },
      100,
    );
    if (!result.ok) throw new Error('compile');
    const battle = battleWith(
      result.projection.skills,
      result.projection.passiveSkillIds.filter((skillId) => skillId.includes('juechen')),
      undefined,
      5,
      result.projection.statusDefs,
    );
    battle.unit('self').attrs.hp = 400;
    battle.hooks.emit(HookName.AfterDamage, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      hpDamage: 50,
    });
    expect(battle.unit('self').statuses.some((status) => status.id === 'dao_equipment.status.juechen')).toBe(false);
    battle.unit('self').attrs.hp = 250;
    battle.hooks.emit(HookName.AfterDamage, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      hpDamage: 200,
    });
    const applied = () => battle.log().filter((event) => event.type === EventType.StatusApplied && event.statusId === 'dao_equipment.status.juechen');
    expect(applied()).toHaveLength(1);
    battle.unit('self').attrs.hp = 200;
    battle.hooks.emit(HookName.AfterDamage, {
      source: battle.unit('foe'),
      target: battle.unit('self'),
      hpDamage: 100,
    });
    expect(applied()).toHaveLength(1);
    expect(result.projection.statusDefs.some((status) => status.id === 'dao_equipment.status.juechen')).toBe(true);
  });
});

it('grants rage to the damaged target across multiple hits without an action cap', () => {
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
      versions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
      ruleset: createDaoyouRuleset({
        formulas: {
          fluctuationMin: 1,
          fluctuationMax: 1,
          physicalHitChance: () => 1,
          spellHitChance: () => 1,
        },
      }),
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
  expect(state.units[0].resources[0].current).toBe(0);
  expect(state.units[1].resources[0].current).toBeGreaterThan(30);
});

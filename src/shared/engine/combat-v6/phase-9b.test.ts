import { describe, expect, it } from 'vitest';
import { arenaEvents } from '../../combat-v6/arena';
import { applyUnitDelta } from '../../combat-v6/playback';
import {
  combatV6DisplayEvent,
  combatV6Playback,
  combatV6Units,
} from '../../combat-v6/presentation';
import {
  BEAST_SPECIES,
  canDeployBeast,
  generateStarterBeast,
  projectBeastRoster,
} from './beasts';
import {
  allocateBeast,
  beastRestCost,
  beastVictoryExperience,
  captureSkill,
  gainBeastExp,
  generateCapturedBeast,
  nextBeastExp,
} from './beasts/progression';
import { createBattle, restoreBattle, type CreateBattleInput } from './core';
import { daoyouRulesetV6 } from './rules-daoyou';

const id = '00000000-0000-4000-8000-000000000001';
const owner = '00000000-0000-4000-8000-000000000002';
const speciesId = BEAST_SPECIES[0].id;
function captureFixture(chance = 1, capacity = 24): CreateBattleInput {
  const skill = captureSkill(
    [
      { unitId: 'first', speciesId },
      { unitId: 'second', speciesId },
    ],
    10,
    24 - capacity,
  );
  skill.capture!.chance = chance;
  return {
    seed: 42,
    ruleset: daoyouRulesetV6,
    skills: [skill],
    units: [
      {
        id: owner,
        name: '主人',
        kind: 'player',
        side: 0,
        level: 10,
        skills: [skill.id],
        attrs: { hp: 1000, mp: 100, speed: 100 },
      },
      {
        id: 'beast:' + id,
        ownerId: owner,
        name: '宠物',
        kind: 'pet',
        side: 0,
        level: 10,
        attrs: { hp: 100, speed: 1 },
      },
      {
        id: 'first',
        name: '甲',
        kind: 'npc',
        side: 1,
        slot: 0,
        level: 10,
        attrs: { hp: 1000, speed: 5 },
      },
      {
        id: 'second',
        name: '乙',
        kind: 'npc',
        side: 1,
        slot: 1,
        level: 10,
        attrs: { hp: 1000, speed: 5 },
      },
    ],
  };
}
function cast(battle: ReturnType<typeof createBattle>) {
  battle.submit(owner, {
    type: 'skill',
    skillId: 'beast.capture',
    targets: ['first'],
  });
  for (const unit of battle.state.units)
    if (unit.id !== owner && !unit.flags.dead && !unit.flags.benched)
      battle.submit(unit.id, { type: 'defend' });
}
describe('9B 捕捉施法', () => {
  it('失效目标转向，支付实际费用，捕获不等于死亡，差量和恢复一致', () => {
    const input = captureFixture();
    const battle = createBattle(input);
    battle.unit('first').flags.dead = true;
    battle.unit('first').attrs.hp = 0;
    cast(battle);
    const initial = battle.snapshot();
    const restored = restoreBattle(input, initial, [...battle.log()]);
    const tape = combatV6Playback(battle.log().length - 1, [], initial);
    battle.lockAndResolve(tape.capture);
    restored.lockAndResolve();
    expect(battle.unit(owner).attrs.mp).toBe(85);
    expect(battle.unit('second').flags).toMatchObject({
      capturedBy: owner,
      benched: true,
      dead: false,
    });
    expect(
      battle
        .log()
        .some((e) => e.type === 'unitCaptured' && e.targetId === 'second'),
    ).toBe(true);
    expect(battle.snapshot()).toEqual(restored.snapshot());
    expect(battle.log()).toEqual(restored.log());
    const publicCapture = arenaEvents(battle.log()).find(
      (e) => e.event.type === 'unitCaptured',
    );
    expect(publicCapture?.event).not.toHaveProperty('generationSeed');
    expect(
      battle
        .log()
        .map(combatV6DisplayEvent)
        .find((e) => e.type === 'unitCaptured'),
    ).not.toHaveProperty('generationSeed');
    let units = combatV6Units(initial, []);
    for (const frame of tape.playback.frames)
      units = applyUnitDelta(units, frame);
    expect(units).toEqual(combatV6Units(battle.snapshot(), []));
    expect(beastVictoryExperience(battle.state, owner)).toEqual({
      beastId: id,
      amount: 100,
    });
  });
  it('概率失败仍扣 MP；无名额、无目标和 MP 不足不扣费也不转普攻', () => {
    for (const mode of ['failure', 'full', 'no-target', 'no-mp'] as const) {
      const battle = createBattle(captureFixture(0, mode === 'full' ? 0 : 24));
      if (mode === 'no-target')
        for (const target of ['first', 'second'])
          battle.unit(target).flags.benched = true;
      if (mode === 'no-mp') battle.unit(owner).attrs.mp = 14;
      const before = battle.unit(owner).attrs.mp;
      cast(battle);
      battle.lockAndResolve();
      expect(battle.unit(owner).attrs.mp).toBe(
        before - (mode === 'failure' ? 15 : 0),
      );
      expect(battle.log().some((e) => e.type === 'unitCaptured')).toBe(false);
      if (mode === 'failure')
        expect(
          arenaEvents(battle.log()).some(
            (e) =>
              e.event.type === 'actionFailed' &&
              e.event.reason === 'capture-failed',
          ),
        ).toBe(true);
      expect(
        battle
          .log()
          .some(
            (e) =>
              e.type === 'actionStart' &&
              e.unitId === owner &&
              e.command.type === 'attack',
          ),
      ).toBe(false);
    }
  });
  it('携带门槛筛选、容量包含本场成功捕获、不为更便宜目标额外转向', () => {
    expect(
      captureSkill([{ unitId: 'first', speciesId }], 4, 0).capture!
        .targetMpCosts,
    ).toEqual({});
    const input = captureFixture(1, 1);
    const battle = createBattle(input);
    cast(battle);
    battle.lockAndResolve();
    expect(battle.queryCommands(owner).skills[0].selectableTargetIds).toEqual(
      [],
    );
    const expensive = captureFixture();
    expensive.skills![0].capture!.targetMpCosts.first = 101;
    const second = createBattle(expensive);
    cast(second);
    second.lockAndResolve();
    expect(second.unit(owner).attrs.mp).toBe(100);
    expect(second.unit('second').flags.capturedBy).toBeUndefined();
  });
});

describe('9B 个体成长与终局经验', () => {
  const beast = () => generateStarterBeast(id, owner, speciesId, 42);
  it('捕获按野怪等级生成，出生技能永久固定，旧个体不重新生成', () => {
    const generated = generateCapturedBeast(id, owner, speciesId, 15, 42);
    expect(generated).toEqual(
      generateCapturedBeast(id, owner, speciesId, 15, 42),
    );
    expect(generated.allocatedAttributes.magic).toBe(75);
    expect(generated.skills.length).toBe(generated.skillSlotCapacity);
    const grown = gainBeastExp(generated, 1000, 30);
    expect(grown.skills).toEqual(generated.skills);
    expect(grown.aptitudes).toEqual(generated.aptitudes);
    expect(grown.growth).toBe(generated.growth);
    expect(beast().generationVersion).toBe('summoned_beast_v1');
  });
  it('跨级成长点数守恒，达到主人等级丢弃剩余经验，超等级不能加点或出战', () => {
    const initial = beast();
    const grown = gainBeastExp(initial, nextBeastExp(10) + 999, 11);
    expect(grown).toMatchObject({ level: 11, exp: 0, unallocatedPoints: 5 });
    expect(gainBeastExp(grown, 100, 11)).toBe(grown);
    expect(canDeployBeast(grown, 10)).toBe(false);
    expect(
      projectBeastRoster(
        {
          beasts: [grown],
          lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
        },
        owner,
        0,
        0,
        10,
      ),
    ).toEqual([]);
    const points = {
      constitution: 0,
      strength: 0,
      magic: 5,
      endurance: 0,
      agility: 0,
    };
    expect(() => allocateBeast(grown, points, 10)).toThrow();
    const allocated = allocateBeast(grown, points, 11);
    expect(allocated.allocatedAttributes.magic).toBe(55);
    expect(allocated.unallocatedPoints).toBe(0);
    expect(() => allocateBeast(allocated, points, 11)).toThrow();
    expect(beastRestCost({ ...initial, currentLifespan: 950 })).toBe(5);
    expect(beastRestCost({ ...initial, currentLifespan: 999 })).toBe(1);
  });
  it('经验只归终局在场且存活的旧宠，死亡、召回、无胜利皆无经验', () => {
    const battle = createBattle(captureFixture());
    const state = battle.snapshot();
    state.result = { winner: 0, reason: 'wipe' };
    state.units.find((u) => u.id === 'first')!.flags.dead = true;
    expect(beastVictoryExperience(state, owner)).toEqual({
      beastId: id,
      amount: 100,
    });
    const pet = state.units.find((u) => u.id === 'beast:' + id)!;
    pet.flags.dead = true;
    expect(beastVictoryExperience(state, owner)).toBeUndefined();
    pet.flags.dead = false;
    pet.flags.benched = true;
    expect(beastVictoryExperience(state, owner)).toBeUndefined();
    pet.flags.benched = false;
    state.result.winner = 1;
    expect(beastVictoryExperience(state, owner)).toBeUndefined();
  });
});

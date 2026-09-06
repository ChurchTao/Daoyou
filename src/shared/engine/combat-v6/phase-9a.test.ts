import { describe, expect, it } from 'vitest';
import {
  controlledUnits,
  validateCommandGroup,
  validatePetCommand,
} from '../../combat-v6/controlled-commands';
import { applyUnitDelta } from '../../combat-v6/playback';
import { combatV6Playback, combatV6Units } from '../../combat-v6/presentation';
import { createBattle, restoreBattle, type CreateBattleInput } from './core';
import { CombatV6PveHostSession } from './encounter/host';
import { daoyouRulesetV6 } from './rules-daoyou';
import { COMBAT_V6_PHASE_9A_ARENA_VERSIONS } from './version';

function fixture(ownerSpeed = 100): CreateBattleInput {
  return {
    seed: 42,
    ruleset: daoyouRulesetV6,
    versions: COMBAT_V6_PHASE_9A_ARENA_VERSIONS,
    units: [
      {
        id: 'owner',
        name: '主人',
        side: 0,
        kind: 'player',
        slot: 0,
        attrs: { hp: 1000, speed: ownerSpeed },
      },
      {
        id: 'old',
        name: '首发',
        side: 0,
        kind: 'pet',
        ownerId: 'owner',
        slot: 0,
        attrs: { hp: 500, speed: 50, physicalAtk: 20 },
      },
      {
        id: 'new',
        name: '替补',
        side: 0,
        kind: 'pet',
        ownerId: 'owner',
        slot: 0,
        benched: true,
        attrs: { hp: 500, speed: 200 },
      },
      {
        id: 'foe',
        name: '敌人',
        side: 1,
        kind: 'player',
        slot: 0,
        attrs: { hp: 10000, speed: 1, physicalDef: 1000 },
      },
    ],
    statusDefs: [
      { id: 'temporary', name: '在场状态', kind: 'temporary', speedMod: 1 },
      {
        id: 'retained',
        name: '保留状态',
        kind: 'retained',
        persistWhenBenched: true,
        speedMod: 1,
      },
    ],
  };
}

describe('Phase 9A 控制与上下场', () => {
  it.each([
    [100, false],
    [10, true],
  ])('主人速度 %s，旧宠先行动 %s', (speed, oldActs) => {
    const input = fixture(speed);
    const battle = createBattle(input);
    battle.applyStatus('old', 'temporary', 5);
    battle.applyStatus('old', 'retained', 5);
    battle.unit('old').attrs.hp = 321;
    battle.unit('old').attrs.mp = 7;
    battle.submit('owner', { type: 'summon', petId: 'new' });
    battle.submit('old', { type: 'attack', target: 'foe' });
    battle.submit('foe', { type: 'defend' });
    const restored = restoreBattle(input, battle.snapshot(), [...battle.log()]);
    const initial = battle.snapshot();
    const tape = combatV6Playback(
      battle.log().length - 1,
      input.statusDefs!,
      initial,
    );
    battle.lockAndResolve(tape.capture);
    tape.capture(battle.snapshot(), battle.log().length - 1);
    restored.lockAndResolve();
    expect(
      battle.log().some((e) => e.type === 'actionStart' && e.unitId === 'old'),
    ).toBe(oldActs);
    expect(
      battle.log().some((e) => e.type === 'actionStart' && e.unitId === 'new'),
    ).toBe(false);
    expect(battle.unit('old').statuses.map((s) => s.id)).toEqual(['retained']);
    expect(battle.unit('old').statuses[0].remainingRounds).toBe(5);
    expect(battle.unit('old').attrs.hp).toBe(321);
    expect(battle.unit('old').attrs.mp).toBe(7);
    expect(battle.snapshot()).toEqual(restored.snapshot());
    expect(battle.log()).toEqual(restored.log());
    let units = combatV6Units(initial, input.statusDefs!);
    for (const frame of tape.playback.frames)
      units = applyUnitDelta(units, frame);
    expect(units).toEqual(combatV6Units(battle.snapshot(), input.statusDefs!));
    expect(controlledUnits(battle.state, 'owner').map((u) => u.id)).toEqual([
      'owner',
      'new',
    ]);
  });
  it('倒地主人仍收令并控制宠物，但不能预选换宠；禁止越权和漏交', () => {
    const battle = createBattle(fixture());
    battle.unit('owner').flags.downed = true;
    battle.unit('owner').attrs.hp = 0;
    expect(controlledUnits(battle.state, 'owner').map((u) => u.id)).toEqual([
      'owner',
      'old',
    ]);
    expect(battle.queryCommands('owner').canSubmit).toBe(true);
    expect(() =>
      validatePetCommand(battle.queryCommands('owner'), {
        type: 'summon',
        petId: 'new',
      }),
    ).toThrow();
    expect(() =>
      validateCommandGroup(battle.state, 'owner', [
        { unitId: 'owner', command: { type: 'defend' } },
      ]),
    ).toThrow();
    expect(() =>
      validateCommandGroup(battle.state, 'owner', [
        { unitId: 'owner', command: { type: 'defend' } },
        { unitId: 'new', command: { type: 'defend' } },
      ]),
    ).toThrow();
  });
  it('PvE要求整组指令，不能把可控宠物交给NPC策略', () => {
    const host = new CombatV6PveHostSession({
      playerId: 'owner',
      battleInput: fixture(),
      npcStrategies: { foe: { type: 'defend' } },
      sourceProjectionVersions: COMBAT_V6_PHASE_9A_ARENA_VERSIONS,
    });
    host.submit('owner', { type: 'defend' });
    expect(() => host.resolveRound()).toThrow('尚未提交');
    host.submitGroup([
      { unitId: 'owner', command: { type: 'defend' } },
      { unitId: 'old', command: { type: 'attack', target: 'foe' } },
    ]);
    host.resolveRound();
    expect(host.state.round).toBe(2);
  });
  it('死亡宠物不可重召，换宠后不占额外场上行', () => {
    const battle = createBattle(fixture());
    battle.unit('old').flags.dead = true;
    battle.unit('old').attrs.hp = 0;
    battle.submit('owner', { type: 'summon', petId: 'new' });
    battle.submit('foe', { type: 'defend' });
    battle.lockAndResolve();
    expect(battle.unit('old').flags.benched).toBe(true);
    expect(battle.queryCommands('owner').summonablePets).toEqual([]);
    expect(
      combatV6Units(battle.state, []).filter((u) => u.kind === 'pet'),
    ).toHaveLength(1);
  });
  it('场上全灭时替补不能阻止战败', () => {
    const input = fixture();
    input.units[1].benched = true;
    input.units[0].attrs.hp = 1;
    input.units[3].attrs.physicalAtk = 1000;
    const battle = createBattle(input);
    battle.submit('owner', { type: 'defend' });
    battle.submit('foe', { type: 'attack', target: 'owner' });
    battle.lockAndResolve();
    expect(battle.state.result?.winner).toBe(1);
  });
});

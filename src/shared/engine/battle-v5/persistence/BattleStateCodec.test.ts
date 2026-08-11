import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import type { AbilityConfig, BuffConfig } from '../core/configs';
import {
  AbilityType,
  AttributeType,
  BuffType,
  ModifierType,
} from '../core/types';
import { writeRuntimeCounter } from '../core/runtimeState';
import { AbilityFactory } from '../factories/AbilityFactory';
import { BuffFactory } from '../factories/BuffFactory';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { Unit } from '../units/Unit';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
  decodeBattleSave,
  encodeBattleSave,
  restoreBattleSave,
} from './BattleStateCodec';
import type { BattleSaveV1 } from './types';

const abilityConfig: AbilityConfig = {
  slug: 'checkpoint-strike',
  name: '存档一击',
  type: AbilityType.ACTIVE_SKILL,
  tags: [
    GameplayTags.ABILITY.KIND.SKILL,
    GameplayTags.ABILITY.FUNCTION.DAMAGE,
    GameplayTags.ABILITY.CHANNEL.PHYSICAL,
  ],
  cooldown: 4,
  effects: [],
};

const buffConfig: BuffConfig = {
  id: 'checkpoint-buff',
  name: '存档增益',
  type: BuffType.BUFF,
  duration: 3,
  stackRule: 'stack_layer',
  maxLayers: 3,
  statusTags: [GameplayTags.STATUS.STATE.BLESSED],
  modifiers: [
    {
      attrType: AttributeType.ATK,
      type: ModifierType.FIXED,
      value: 12,
      scaleByLayer: true,
    },
  ],
};

function createSave(): BattleSaveV1 {
  const runtime = new BattleRuntime();
  const left = new Unit(
    'left',
    'left',
    { [AttributeType.VITALITY]: 20 },
    { runtime, teamId: 'alpha', slot: 0 },
  );
  const right = new Unit(
    'right',
    'right',
    { [AttributeType.VITALITY]: 20 },
    { runtime, teamId: 'beta', slot: 0 },
  );
  left.abilities.addAbility(AbilityFactory.create(abilityConfig));
  left.abilities.setDefaultAttack(AbilityFactory.create({
    ...abilityConfig,
    slug: 'checkpoint-basic',
    name: '存档普攻',
    cooldown: 0,
  }));
  left.combatResources.define({
    id: 'focus',
    name: '专注',
    initial: 2,
    max: 5,
  });
  const buff = BuffFactory.create(buffConfig);
  left.buffs.initializeBuff(buff, left);
  const roster = BattleRoster.fromDuel(left, right);
  const blueprint = createBattleBlueprint('battle-checkpoint', roster);

  left.setHp(left.getCurrentHp() - 37);
  left.setMp(left.getCurrentMp() - 11);
  left.setShield(9);
  left.combatResources.set('focus', 4);
  buff.setLayer(2);
  buff.tickDuration();
  const ability = left.abilities.getAbility('checkpoint-strike');
  if (!(ability instanceof ActiveSkill)) throw new Error('missing skill');
  ability.startCooldown();
  writeRuntimeCounter(left, 'combo', 3);
  runtime.random.next();

  return {
    version: 'battle_save_v1',
    blueprint,
    checkpoint: captureBattleCheckpoint({
      blueprint,
      roster,
      runtime,
      round: 2,
      checkpointRevision: 7,
    }),
  };
}

describe('BattleStateCodec', () => {
  it('round-trips a checkpoint and restores deterministic runtime state', () => {
    const save = createSave();
    const decoded = decodeBattleSave(encodeBattleSave(save));
    const restored = restoreBattleSave(decoded);
    const left = restored.roster.getUnit('left');
    const restoredAbility = left.abilities.getAbility('checkpoint-strike');

    expect(left.getCurrentHp()).toBe(save.checkpoint.units.left.hp);
    expect(left.getCurrentMp()).toBe(save.checkpoint.units.left.mp);
    expect(left.getCurrentShield()).toBe(9);
    expect(left.combatResources.getCurrent('focus')).toBe(4);
    const restoredBuff = left.buffs
      .getAllBuffs()
      .find((candidate) => candidate.id === 'checkpoint-buff');
    expect(restoredBuff?.getLayer()).toBe(2);
    expect(restoredBuff?.getDuration()).toBe(2);
    expect(restoredAbility).toBeInstanceOf(ActiveSkill);
    expect((restoredAbility as ActiveSkill).currentCooldown).toBe(4);
    expect(left.abilities.getDefaultAttack().id).toBe('checkpoint-basic');
    expect(restored.runtime.exportCursor()).toEqual(save.checkpoint.runtime);

    const recaptured = captureBattleCheckpoint({
      blueprint: restored.blueprint,
      roster: restored.roster,
      runtime: restored.runtime,
      round: restored.checkpoint.round,
      checkpointRevision: restored.checkpoint.checkpointRevision,
    });
    expect(recaptured).toEqual(save.checkpoint);
  });

  it('rejects checkpoints outside the global planning boundary', () => {
    const save = createSave();
    const invalid = JSON.parse(JSON.stringify(save)) as BattleSaveV1;
    (invalid.checkpoint as { phase: string }).phase = 'resolving';
    expect(() => decodeBattleSave(JSON.stringify(invalid))).toThrow(
      'Invalid battle checkpoint',
    );
  });
});

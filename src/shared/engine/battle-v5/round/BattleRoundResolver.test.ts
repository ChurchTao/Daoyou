import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import type { AbilityConfig } from '../core/configs';
import {
  AbilityType,
  AttributeType,
  DamageType,
} from '../core/types';
import { AbilityFactory } from '../factories/AbilityFactory';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
  restoreBattleSave,
} from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import {
  resolveBattleRound,
  sealRoundCommandSet,
} from './BattleRoundResolver';
import type { RoundCommandSetV1 } from './types';
import { createBattlePlanningView } from './BattlePlanningView';

const aoeAbility: AbilityConfig = {
  slug: 'team-flame',
  name: '焚阵',
  type: AbilityType.ACTIVE_SKILL,
  tags: [
    GameplayTags.ABILITY.KIND.SKILL,
    GameplayTags.ABILITY.FUNCTION.DAMAGE,
    GameplayTags.ABILITY.CHANNEL.TRUE,
  ],
  mpCost: 10,
  hitPolicy: 'guaranteed',
  targetPolicy: { team: 'enemy', scope: 'aoe', maxTargets: 4 },
  effects: [
    {
      type: 'damage',
      params: {
        value: { base: 40, coefficient: 0 },
        damageType: DamageType.TRUE,
        canCrit: false,
      },
    },
  ],
};

function initialSave(): BattleSaveV1 {
  const runtime = new BattleRuntime();
  const units = [
    new Unit(
      'a0',
      'a0',
      { [AttributeType.SPIRIT]: 20 },
      { runtime, teamId: 'alpha', slot: 0 },
    ),
    new Unit('a1', 'a1', {}, { runtime, teamId: 'alpha', slot: 1 }),
    new Unit('b0', 'b0', {}, { runtime, teamId: 'beta', slot: 0 }),
    new Unit('b1', 'b1', {}, { runtime, teamId: 'beta', slot: 1 }),
  ];
  units[0].abilities.addAbility(AbilityFactory.create(aoeAbility));
  const roster = new BattleRoster(units);
  const blueprint = createBattleBlueprint('team-round', roster);
  return {
    version: 'battle_save_v1',
    blueprint,
    checkpoint: captureBattleCheckpoint({
      blueprint,
      roster,
      runtime,
      round: 0,
      checkpointRevision: 0,
    }),
  };
}

function commands(): RoundCommandSetV1 {
  return {
    version: 'round_command_set_v1',
    commandSetId: 'round-1-sealed',
    round: 1,
    checkpointRevision: 0,
    intents: {
      a0: {
        kind: 'ability',
        abilityId: 'team-flame',
        submittedBy: 'player',
      },
      a1: { kind: 'pass', submittedBy: 'timeout' },
      b0: { kind: 'pass', submittedBy: 'player' },
      b1: { kind: 'pass', submittedBy: 'timeout' },
    },
  };
}

describe('BattleRoundResolver', () => {
  it('resolves one sealed 2v2 round atomically and charges AOE once', () => {
    const save = initialSave();
    const commandSet = sealRoundCommandSet(save, commands());
    const result = resolveBattleRound(save, commandSet);
    const restored = restoreBattleSave(result.save);
    const a0 = restored.roster.getUnit('a0');

    expect(result.round).toBe(1);
    expect(result.checkpoint.checkpointRevision).toBe(1);
    expect(restored.roster.getUnit('b0').getHpPercent()).toBeLessThan(1);
    expect(restored.roster.getUnit('b1').getHpPercent()).toBeLessThan(1);
    expect(a0.getMaxMp() - a0.getCurrentMp()).toBe(10);
    expect(result.nextPlanningView?.units).toHaveLength(4);
    expect(JSON.stringify(result.nextPlanningView)).not.toContain('intents');
  });

  it('is deterministic for the same checkpoint and sealed command set', () => {
    const save = initialSave();
    const commandSet = commands();
    const left = resolveBattleRound(save, commandSet);
    const right = resolveBattleRound(save, commandSet);

    expect(left.checkpoint).toEqual(right.checkpoint);
    expect(left.sequences).toEqual(right.sequences);
    expect(left.stateTimeline).toEqual(right.stateTimeline);
  });

  it('rejects incomplete command sets without mutating the input save', () => {
    const save = initialSave();
    const before = JSON.stringify(save);
    const incomplete = commands();
    delete incomplete.intents.b1;

    expect(() => resolveBattleRound(save, incomplete)).toThrow(
      'every living unit exactly once',
    );
    expect(JSON.stringify(save)).toBe(before);
  });

  it('accepts a complete 4v4 simultaneous planning set', () => {
    const runtime = new BattleRuntime();
    const units = Array.from({ length: 8 }, (_, index) => {
      const teamIndex = index < 4 ? index : index - 4;
      const teamId = index < 4 ? 'alpha' : 'beta';
      return new Unit(`${teamId}-${teamIndex}`, `${teamId}-${teamIndex}`, {}, {
        runtime,
        teamId,
        slot: teamIndex as 0 | 1 | 2 | 3,
      });
    });
    const roster = new BattleRoster(units);
    const blueprint = createBattleBlueprint('four-v-four', roster);
    const save: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 0,
        checkpointRevision: 0,
      }),
    };
    const intents = Object.fromEntries(
      units.map((unit) => [
        unit.id,
        { kind: 'pass' as const, submittedBy: 'timeout' as const },
      ]),
    );
    const commandSet: RoundCommandSetV1 = {
      version: 'round_command_set_v1',
      commandSetId: '4v4-round-1',
      round: 1,
      checkpointRevision: 0,
      intents,
    };

    const teamView = createBattlePlanningView({
      roster,
      round: 1,
      checkpointRevision: 0,
      teamId: 'alpha',
    });
    const result = resolveBattleRound(save, sealRoundCommandSet(save, commandSet));

    expect(teamView.units).toHaveLength(4);
    expect(result.nextPlanningView?.units).toHaveLength(8);
    expect(result.checkpoint.units).toHaveProperty('beta-3');
  });
});

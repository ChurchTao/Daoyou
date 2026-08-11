import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import type { BuffConfig } from '../core/configs';
import { AttributeType, BuffType } from '../core/types';
import { queueSkippedActions } from '../core/runtimeState';
import { BuffFactory } from '../factories/BuffFactory';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '../persistence/BattleStateCodec';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import { createBattlePublicSnapshot } from './BattlePublicSnapshot';

function buffConfig(
  id: string,
  statusVisibility: 'player' | 'hidden',
): BuffConfig {
  return {
    id,
    name: id === 'visible' ? '明示状态' : '内部状态',
    type: BuffType.BUFF,
    duration: 3,
    stackRule: 'stack_layer',
    maxLayers: 3,
    statusVisibility,
    statusTags: [GameplayTags.STATUS.STATE.BLESSED],
    effects: [],
  };
}

describe('BattlePublicSnapshot', () => {
  it('projects only player-visible status and safe runtime presentation state', () => {
    const runtime = new BattleRuntime();
    const left = new Unit(
      'left',
      '甲',
      { [AttributeType.VITALITY]: 20 },
      { runtime, teamId: 'alpha', slot: 0 },
    );
    const right = new Unit(
      'right',
      '乙',
      { [AttributeType.VITALITY]: 20 },
      { runtime, teamId: 'beta', slot: 0 },
    );
    left.combatResources.define({
      id: 'focus',
      name: '专注',
      icon: '◆',
      initial: 2,
      max: 5,
    });
    left.combatResources.set('focus', 4);
    const visible = BuffFactory.create(buffConfig('visible', 'player'));
    visible.setLayer(2);
    left.buffs.initializeBuff(visible, left);
    left.buffs.initializeBuff(
      BuffFactory.create(buffConfig('hidden', 'hidden')),
      left,
    );
    queueSkippedActions(left, 2, 'test', '调息');

    const roster = BattleRoster.fromDuel(left, right);
    const blueprint = createBattleBlueprint('public-snapshot', roster);
    const snapshot = createBattlePublicSnapshot({
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 1,
        checkpointRevision: 2,
      }),
    });
    const unit = snapshot.units.find((entry) => entry.unitId === 'left');

    expect(unit?.effects).toEqual([
      expect.objectContaining({ id: 'visible', label: '明示状态', layers: 2 }),
    ]);
    expect(unit?.combatResources).toEqual([
      { id: 'focus', name: '专注', icon: '◆', current: 4, max: 5 },
    ]);
    expect(unit?.actionStates).toEqual([
      expect.objectContaining({ type: 'rest', label: '调息', remainingActions: 2 }),
    ]);
    expect(JSON.stringify(snapshot)).not.toContain('内部状态');
    expect(JSON.stringify(snapshot)).not.toContain('battle_save_v1');
  });
});

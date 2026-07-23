import { describe, expect, it } from 'vitest';
import { reduceActionLog } from '../../../systems/log/ActionLogReducer';
import type {
  LogEntry,
  LogEntryType,
  LogSpan,
} from '../../../systems/log/types';

let entrySequence = 0;

function entry<T extends LogEntryType>(
  type: T,
  data: LogEntry<T>['data'],
): LogEntry<T> {
  entrySequence += 1;
  return {
    id: `${type}-${entrySequence}`,
    type,
    data,
    timestamp: entrySequence,
  };
}

function action(entries: LogEntry[]): LogSpan {
  return {
    id: 'action',
    type: 'action',
    turn: 1,
    actor: { id: 'actor', name: '施法者' },
    ability: { id: 'active-ability', name: '主动技能' },
    entries,
    timestamp: 1,
  };
}

describe('ActionLogReducer', () => {
  it('同一目标上的同一状态只保留最后一次应用', () => {
    const first = entry('buff_apply', {
      buffId: 'stacking-status',
      buffName: '叠层状态',
      buffType: 'buff',
      targetId: 'target',
      targetName: '目标',
      layers: 1,
      duration: 3,
      durationUnit: 'owner_action',
    });
    const final = entry('buff_apply', {
      ...first.data,
      layers: 3,
    });

    expect(reduceActionLog(action([first, final])).primaryEntries).toEqual([
      final,
    ]);
  });

  it('显示名相同但状态 ID 不同的应用保持独立', () => {
    const first = entry('buff_apply', {
      buffId: 'status-a',
      buffName: '同名状态',
      buffType: 'buff',
      targetId: 'target',
      targetName: '目标',
      layers: 1,
      duration: 3,
      durationUnit: 'owner_action',
    });
    const second = entry('buff_apply', {
      ...first.data,
      buffId: 'status-b',
    });

    expect(reduceActionLog(action([first, second])).primaryEntries).toEqual([
      first,
      second,
    ]);
  });

  it('隐藏纯层数变化，普通强化机制仍作为技能结果', () => {
    const layerChange = entry('mechanic', {
      mechanic: 'buff_layer',
      targetName: '目标',
      name: '叠层状态',
      visibility: 'player',
    });
    const transform = entry('mechanic', {
      mechanic: 'ability_transform',
      targetName: '施法者',
      name: '强化效果',
      displayName: '强化效果',
      detail: 'set',
      visibility: 'player',
    });
    const reduced = reduceActionLog(action([layerChange, transform]));

    expect(reduced.primaryEntries).toEqual([transform]);
    expect(reduced.abilityModeStates).toEqual([]);
  });

  it('形态事件与延后展示的行动状态按结构类型分组', () => {
    const mode = entry('action_state', {
      unitId: 'actor',
      unitName: '施法者',
      stateType: 'ability_mode',
      phase: 'entered',
      name: '战斗形态',
      remainingActions: 2,
    });
    const rest = entry('action_state', {
      unitId: 'actor',
      unitName: '施法者',
      stateType: 'rest',
      phase: 'entered',
      name: '调息',
      remainingActions: 1,
    });
    const reduced = reduceActionLog(action([mode, rest]));

    expect(reduced.abilityModeStates).toEqual([mode]);
    expect(reduced.deferredActionStates).toEqual([rest]);
  });

  it('过滤零收益结果', () => {
    const zeroHeal = entry('heal', {
      value: 0,
      remainHp: 100,
      targetName: '施法者',
    });
    const damage = entry('damage', {
      value: 10,
      beforeHp: 100,
      remainHp: 90,
      isCritical: false,
      targetName: '目标',
    });

    expect(reduceActionLog(action([zeroHeal, damage])).primaryEntries).toEqual([
      damage,
    ]);
  });
});

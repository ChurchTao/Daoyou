import {
  LogEntryType,
  EntryDataMap,
  LogEntry,
  LogSpan,
  LogSpanType,
  DamageEntryData,
  HealEntryData,
} from '../../../systems/log/types';

describe('LogEntryType', () => {
  it('should define all 18 entry types', () => {
    const types: LogEntryType[] = [
      'damage',
      'heal',
      'shield',
      'buff_apply',
      'buff_remove',
      'buff_immune',
      'dodge',
      'resist',
      'death',
      'mana_burn',
      'resource_drain',
      'dispel',
      'reflect',
      'tag_trigger',
      'death_prevent',
      'skill_cast',
      'skill_interrupt',
      'cooldown_modify',
    ];
    expect(types).toHaveLength(18);
  });
});

describe('LogEntry', () => {
  it('should have id, type, data, timestamp (no message/highlight)', () => {
    const entry: LogEntry<'damage'> = {
      id: 'test-entry-1',
      type: 'damage',
      data: {
        value: 100,
        remainHp: 50,
        isCritical: false,
        targetName: 'Target',
      },
      timestamp: Date.now(),
    };
    expect(entry.id).toBe('test-entry-1');
    expect(entry.type).toBe('damage');
    expect(entry.data.value).toBe(100);
    expect(entry.timestamp).toBeDefined();
    // 确保没有 message 和 highlight 字段
    expect('message' in entry).toBe(false);
    expect('highlight' in entry).toBe(false);
  });
});

describe('LogSpan', () => {
  it('should have actor and ability instead of title/source', () => {
    const span: LogSpan = {
      id: 'span-1',
      type: 'action',
      turn: 1,
      actor: { id: 'u1', name: '张三' },
      ability: { id: 'skill-1', name: '火球术' },
      entries: [],
      timestamp: Date.now(),
    };
    expect(span.actor).toEqual({ id: 'u1', name: '张三' });
    expect(span.ability).toEqual({ id: 'skill-1', name: '火球术' });
    // 确保没有 title 和 source 字段
    expect('title' in span).toBe(false);
    expect('source' in span).toBe(false);
  });
});

describe('EntryDataMap', () => {
  it('should provide type-safe data access', () => {
    // 这个测试主要是类型检查，编译通过即可
    const damageData: EntryDataMap['damage'] = {
      value: 100,
      remainHp: 50,
      isCritical: true,
      targetName: 'Target',
    };
    expect(damageData.value).toBe(100);
    expect(damageData.isCritical).toBe(true);

    const healData: EntryDataMap['heal'] = {
      value: 50,
      remainHp: 80,
      targetName: 'Target',
    };
    expect(healData.value).toBe(50);
  });
});

import { CombatLogSystem } from '../../systems/log/CombatLogSystem';
import { LogAggregator } from '../../systems/log/LogAggregator';
import { CombatPhase } from '../../core/types';

describe('CombatLogSystem.getLogs()', () => {
  let logSystem: CombatLogSystem;
  let aggregator: any;

  beforeEach(() => {
    logSystem = new CombatLogSystem();
    // Access private aggregator for setup
    aggregator = (logSystem as any)._aggregator;
  });

  it('should return aggregated logs for each span', () => {
    // Setup a span with multiple entries
    aggregator.beginRoundStartSpan(1);
    aggregator.beginActionSpan({ id: 'player', name: '林轩' }, { id: 'skill', name: '普攻' });
    aggregator.addEntry({
      id: '1',
      type: 'damage',
      data: { targetName: '魔狼', value: 50 },
      message: '造成 50 点伤害',
      highlight: false
    });
    aggregator.addEntry({
      id: '2',
      type: 'buff_apply',
      data: { targetName: '魔狼', buffName: '流血' },
      message: '施加流血状态',
      highlight: true
    });
    
    const logs = logSystem.getLogs();
    
    // Should have 2 log entries (one round start, one action span)
    expect(logs.length).toBe(2);
    expect(logs[1].turn).toBe(1);
    expect(logs[1].phase).toBe(CombatPhase.ACTION);
    
    // The message should be formatted by TextFormatter
    expect(logs[1].message).toContain('林轩 行动');
    expect(logs[1].message).toContain('对 魔狼 造成 50 点伤害并施加「流血」');
    
    // Highlight should be true because one entry is highlighted
    expect(logs[1].highlight).toBe(true);
  });

  it('should map span types to correct combat phases', () => {
    // Battle Init
    aggregator.beginBattleInitSpan({ id: 'p1', name: '林轩' }, { id: 'p2', name: '魔狼' });
    
    // Round Start
    aggregator.beginRoundStartSpan(1);
    
    // Action Pre
    aggregator.beginActionPreSpan({ id: 'p1', name: '林轩' });
    
    // Action
    aggregator.beginActionSpan({ id: 'p1', name: '林轩' }, { id: 'basic_attack', name: '普攻' });
    
    // Battle End
    aggregator.beginBattleEndSpan({ id: 'p1', name: '林轩' }, 1);
    
    const logs = logSystem.getLogs();
    expect(logs.length).toBe(5);
    
    expect(logs[0].phase).toBe(CombatPhase.INIT);
    expect(logs[1].phase).toBe(CombatPhase.ROUND_START);
    expect(logs[2].phase).toBe(CombatPhase.ROUND_PRE);
    expect(logs[3].phase).toBe(CombatPhase.ACTION);
    expect(logs[4].phase).toBe(CombatPhase.END);
  });
});

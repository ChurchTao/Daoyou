import { CombatLogSystem } from '../../systems/log/CombatLogSystem';
import { LogAggregator } from '../../systems/log/LogAggregator';
import { CombatPhase } from '../../core/types';

describe('CombatLogSystem Refactored', () => {
  let logSystem: CombatLogSystem;
  let aggregator: LogAggregator;

  beforeEach(() => {
    logSystem = new CombatLogSystem();
    // Access internal aggregator for testing
    aggregator = logSystem.aggregator;
  });

  describe('getPlayerLogs()', () => {
    it('should return aggregated player logs', () => {
      // Setup a battle flow
      aggregator.beginSpan('battle_init', { turn: 0 });
      aggregator.beginSpan('round_start', { turn: 1 });
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'player', name: '林轩' },
        ability: { id: 'basic_attack', name: '普攻' },
      });

      // Add damage entry
      aggregator.addEntry({
        id: 'entry-1',
        type: 'damage',
        data: {
          value: 100,
          remainHp: 50,
          isCritical: false,
          targetName: '魔狼',
        },
        timestamp: Date.now(),
      });

      const logs = logSystem.getPlayerLogs();

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l) => l.includes('林轩'))).toBe(true);
    });
  });

  describe('getLogs() - deprecated', () => {
    it('should return aggregated logs for each span', () => {
      aggregator.beginSpan('round_start', { turn: 1 });
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'player', name: '林轩' },
        ability: { id: 'basic_attack', name: '普攻' },
      });

      aggregator.addEntry({
        id: 'entry-1',
        type: 'damage',
        data: {
          value: 50,
          remainHp: 50,
          isCritical: false,
          targetName: '魔狼',
        },
        timestamp: Date.now(),
      });

      aggregator.addEntry({
        id: 'entry-2',
        type: 'buff_apply',
        data: {
          buffName: '灼烧',
          buffType: 'debuff',
          targetName: '魔狼',
          duration: 3,
        },
        timestamp: Date.now(),
      });

      const logs = logSystem.getLogs();

      // Should have round_start and action
      expect(logs.length).toBeGreaterThanOrEqual(2);

      const actionLog = logs.find((l) => l.phase === CombatPhase.ACTION);
      expect(actionLog).toBeDefined();
      expect(actionLog!.turn).toBe(1);
      expect(actionLog!.message).toContain('林轩');
    });

    it('should map span types to correct combat phases', () => {
      // Battle Init (structural span, no entries needed)
      aggregator.beginSpan('battle_init', { turn: 0 });

      // Round Start (structural span, no entries needed)
      aggregator.beginSpan('round_start', { turn: 1 });

      // Action Pre (needs entry to not be filtered)
      aggregator.beginSpan('action_pre', {
        turn: 1,
        actor: { id: 'p1', name: '林轩' },
      });
      aggregator.addEntry({
        id: 'dot-1',
        type: 'damage',
        data: {
          value: 50,
          remainHp: 50,
          isCritical: false,
          targetName: '林轩',
          sourceBuff: '中毒',
        },
        timestamp: Date.now(),
      });

      // Action (needs entry to not be filtered)
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'p1', name: '林轩' },
        ability: { id: 'basic_attack', name: '普攻' },
      });
      aggregator.addEntry({
        id: 'dmg-1',
        type: 'damage',
        data: {
          value: 100,
          remainHp: 0,
          isCritical: false,
          targetName: '敌人',
        },
        timestamp: Date.now(),
      });

      // Battle End (structural span, no entries needed)
      aggregator.beginSpan('battle_end', {
        turn: 1,
        actor: { id: 'p1', name: '林轩' },
      });

      const logs = logSystem.getLogs();

      expect(logs.length).toBe(5);
      expect(logs[0].phase).toBe(CombatPhase.INIT);
      expect(logs[1].phase).toBe(CombatPhase.ROUND_START);
      expect(logs[2].phase).toBe(CombatPhase.ROUND_PRE);
      expect(logs[3].phase).toBe(CombatPhase.ACTION);
      expect(logs[4].phase).toBe(CombatPhase.END);
    });
  });

  describe('getAIData()', () => {
    it('should return AI view with summary', () => {
      aggregator.beginSpan('battle_init', { turn: 0 });
      aggregator.beginSpan('round_start', { turn: 1 });

      const aiData = logSystem.getAIData();

      expect(aiData.spans).toBeDefined();
      expect(aiData.summary).toBeDefined();
      expect(aiData.summary.totalDamage).toBe(0);
      expect(aiData.summary.turns).toBe(1);
    });

    it('should calculate damage summary correctly', () => {
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'p1', name: '林轩' },
        ability: { id: 'skill-1', name: '火球术' },
      });

      aggregator.addEntry({
        id: 'e1',
        type: 'damage',
        data: {
          value: 100,
          remainHp: 50,
          isCritical: true,
          targetName: '魔狼',
        },
        timestamp: Date.now(),
      });

      aggregator.addEntry({
        id: 'e2',
        type: 'damage',
        data: {
          value: 50,
          remainHp: 0,
          isCritical: false,
          targetName: '魔狼',
        },
        timestamp: Date.now(),
      });

      const aiData = logSystem.getAIData();

      expect(aiData.summary.totalDamage).toBe(150);
      expect(aiData.summary.criticalCount).toBe(1);
    });
  });

  describe('getDebugData()', () => {
    it('should return debug view with event count', () => {
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'p1', name: '林轩' },
      });

      aggregator.addEntry({
        id: 'e1',
        type: 'damage',
        data: {
          value: 100,
          remainHp: 50,
          isCritical: false,
          targetName: '魔狼',
        },
        timestamp: Date.now(),
      });

      aggregator.addEntry({
        id: 'e2',
        type: 'death',
        data: { targetName: '魔狼' },
        timestamp: Date.now(),
      });

      const debugData = logSystem.getDebugData() as {
        spans: unknown[];
        eventCount: number;
      };

      expect(debugData.spans).toHaveLength(1);
      expect(debugData.eventCount).toBe(2);
    });
  });
});

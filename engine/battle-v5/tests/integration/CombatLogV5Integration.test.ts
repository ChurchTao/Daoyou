import { BattleEngineV5 } from '../../BattleEngineV5';
import { Unit } from '../../units/Unit';
import { EventBus } from '../../core/EventBus';

describe('CombatLog V5 Integration', () => {
  let player: Unit;
  let opponent: Unit;
  let engine: BattleEngineV5;

  beforeEach(() => {
    EventBus.instance.reset();
    
    player = new Unit('player', '林轩', {
        hp: 1000,
        mp: 500,
        attack: 100,
        defense: 50,
        agility: 100
    });
    
    opponent = new Unit('opponent', '魔狼', {
        hp: 500,
        mp: 100,
        attack: 80,
        defense: 30,
        agility: 80
    });
    
    engine = new BattleEngineV5(player, opponent);
  });

  afterEach(() => {
    engine.destroy();
    EventBus.instance.reset();
  });

  it('应该在战斗结束后生成结构化的 LogSpan', () => {
    const result = engine.execute();
    
    expect(result.logSpans).toBeDefined();
    expect(result.logSpans!.length).toBeGreaterThan(0);
    
    // 验证 Span 类型
    const spanTypes = result.logSpans!.map(s => s.type);
    expect(spanTypes).toContain('battle_init');
    expect(spanTypes).toContain('round_start');
    expect(spanTypes).toContain('action');
    expect(spanTypes).toContain('battle_end');
    
    // 验证内容
    const initSpan = result.logSpans!.find(s => s.type === 'battle_init');
    expect(initSpan?.title).toContain('林轩');
    expect(initSpan?.title).toContain('魔狼');
  });

  it('应该正确记录行动前的 action_pre Span', () => {
      // 手动触发一个 ActionPreEvent 来验证（或者通过真实战斗流程）
      EventBus.instance.publish({
          type: 'ActionPreEvent',
          timestamp: Date.now(),
          caster: player
      });
      
      const spans = engine.logSystem.getSpans();
      const preSpan = spans.find(s => s.type === 'action_pre');
      expect(preSpan).toBeDefined();
      expect(preSpan?.source?.id).toBe('player');
  });
});

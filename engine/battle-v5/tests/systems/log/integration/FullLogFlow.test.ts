import { BattleEngineV5 } from '../../../../BattleEngineV5';
import { EventBus } from '../../../../core/EventBus';
import { AttributeType } from '../../../../core/types';
import { Unit } from '../../../../units/Unit';

describe('Full Log Flow Integration', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (EventBus as any)._instance = null;
  });

  it('should generate aggregated player logs', () => {
    // 创建角色
    const player = new Unit('player-1', '张三', {
      [AttributeType.MAX_HP]: 1000,
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.SPIRIT]: 30,
    });

    const opponent = new Unit('opponent-1', '李四', {
      [AttributeType.MAX_HP]: 100,
      [AttributeType.PHYSIQUE]: 20,
      [AttributeType.SPIRIT]: 10,
    });

    // 执行战斗
    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    // 验证日志
    const logs = engine.logSystem.getPlayerLogs();
    expect(logs.length).toBeGreaterThan(0);

    // 验证聚合效果：一次行动一行
    const actionLogs = logs.filter((l) => l.includes('张三') || l.includes('李四'));
    for (const log of actionLogs) {
      // 每条日志应该只描述一个行动，不应过长
      expect(log.split('，').length).toBeLessThanOrEqual(5);
    }

    // 验证结构性日志存在
    expect(logs.some((l) => l.includes('【战斗开始】'))).toBe(true);
    expect(logs.some((l) => l.includes('【战斗结束】'))).toBe(true);

    engine.destroy();
  });

  it('should provide AI view with structured data', () => {
    const player = new Unit('player-1', '王五', {
      [AttributeType.MAX_HP]: 500,
      [AttributeType.PHYSIQUE]: 40,
    });

    const opponent = new Unit('opponent-1', '赵六', {
      [AttributeType.MAX_HP]: 300,
      [AttributeType.PHYSIQUE]: 30,
    });

    const engine = new BattleEngineV5(player, opponent);
    engine.execute();

    const aiData = engine.logSystem.getAIData();

    // 验证 AI 视图结构
    expect(aiData.spans).toBeDefined();
    expect(aiData.summary).toBeDefined();
    expect(aiData.summary.totalDamage).toBeGreaterThan(0);

    // 验证每个 span 有描述
    for (const span of aiData.spans) {
      expect(span.description).toBeDefined();
    }

    engine.destroy();
  });

  it('should provide debug view with event count', () => {
    const player = new Unit('player-1', '测试者', {
      [AttributeType.MAX_HP]: 200,
      [AttributeType.PHYSIQUE]: 20,
    });

    const opponent = new Unit('opponent-1', '对手', {
      [AttributeType.MAX_HP]: 200,
      [AttributeType.PHYSIQUE]: 20,
    });

    const engine = new BattleEngineV5(player, opponent);
    engine.execute();

    const debugData = engine.logSystem.getDebugData() as {
      spans: unknown[];
      eventCount: number;
    };

    // 验证调试视图
    expect(debugData.spans).toBeDefined();
    expect(debugData.eventCount).toBeGreaterThan(0);

    engine.destroy();
  });
});

import { BattleEngineV5 } from '../../BattleEngineV5';
import { Unit } from '../../units/Unit';
import { TestActiveSkill } from '../../abilities/test/TestActiveSkill';
import { AttributeType } from '../../core/types';

describe('BattleEngineV5 - Integration', () => {
  it('should execute full battle with new event-driven flow', () => {
    const player = new Unit('player', '玩家', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 80,
      [AttributeType.AGILITY]: 60,
      [AttributeType.CONSCIOUSNESS]: 50,
      [AttributeType.COMPREHENSION]: 50,
    });

    const opponent = new Unit('opponent', '对手', {
      [AttributeType.SPIRIT]: 90,
      [AttributeType.PHYSIQUE]: 90,
      [AttributeType.AGILITY]: 50,
      [AttributeType.CONSCIOUSNESS]: 60,
      [AttributeType.COMPREHENSION]: 50,
    });

    // 给双方添加技能
    const fireball = new TestActiveSkill('fireball', '火球术');
    player.abilities.addAbility(fireball);
    player.currentMp = 100;

    console.log('Player MP:', player.currentMp, 'Skill mana cost:', fireball.manaCost);
    console.log('Player abilities:', player.abilities.getAllAbilities().length);

    const opponentFireball = new TestActiveSkill('fireball', '火球术');
    opponent.abilities.addAbility(opponentFireball);
    opponent.currentMp = 100;

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    // 验证战斗结果
    expect(result).toBeDefined();
    expect(result.turns).toBeGreaterThan(0);
    expect(result.winner).toBeDefined();
    expect(result.logs).toBeDefined();
    expect(result.logs.length).toBeGreaterThan(0);

    // 验证日志中包含事件驱动流程的信息
    const allLogs = result.logs.join(' ');
    console.log('Battle logs:', allLogs);

    // 应该有伤害相关的日志
    expect(allLogs).toMatch(/造成|伤害|闪避|抵抗/);
  });

  it('应该支持回合上限', () => {
    const player = new Unit('player', '玩家', {
      [AttributeType.SPIRIT]: 10,
      [AttributeType.PHYSIQUE]: 1000,
      [AttributeType.AGILITY]: 10,
      [AttributeType.CONSCIOUSNESS]: 10,
      [AttributeType.COMPREHENSION]: 10,
    });

    const opponent = new Unit('opponent', '对手', {
      [AttributeType.SPIRIT]: 10,
      [AttributeType.PHYSIQUE]: 1000,
      [AttributeType.AGILITY]: 10,
      [AttributeType.CONSCIOUSNESS]: 10,
      [AttributeType.COMPREHENSION]: 10,
    });

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    expect(result.turns).toBeLessThanOrEqual(30);
  });

  it('应该正确记录战斗结束', () => {
    const player = new Unit('player', '玩家', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 100,
      [AttributeType.CONSCIOUSNESS]: 100,
      [AttributeType.COMPREHENSION]: 100,
    });

    const opponent = new Unit('opponent', '对手', {
      [AttributeType.SPIRIT]: 10,
      [AttributeType.PHYSIQUE]: 10,
      [AttributeType.AGILITY]: 10,
      [AttributeType.CONSCIOUSNESS]: 10,
      [AttributeType.COMPREHENSION]: 10,
    });

    // 给玩家添加强力技能
    const fireball = new TestActiveSkill('fireball', '火球术');
    player.abilities.addAbility(fireball);
    player.currentMp = 100;

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    expect(result.winner).toBe('player');
    expect(result.logs.some(log => log.includes('获胜'))).toBe(true);
  });

  it('应该正确清理资源', () => {
    const player = new Unit('player', '玩家', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 100,
      [AttributeType.CONSCIOUSNESS]: 100,
      [AttributeType.COMPREHENSION]: 100,
    });

    const opponent = new Unit('opponent', '对手', {
      [AttributeType.SPIRIT]: 10,
      [AttributeType.PHYSIQUE]: 10,
      [AttributeType.AGILITY]: 10,
      [AttributeType.CONSCIOUSNESS]: 10,
      [AttributeType.COMPREHENSION]: 10,
    });

    const engine = new BattleEngineV5(player, opponent);

    // Should not throw
    expect(() => {
      engine.destroy();
    }).not.toThrow();

    // Multiple destroys should be safe
    expect(() => {
      engine.destroy();
      engine.destroy();
    }).not.toThrow();
  });
});

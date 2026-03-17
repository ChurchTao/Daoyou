import { VictorySystem } from '../../systems/VictorySystem';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';

describe('VictorySystem', () => {
  let player: Unit;
  let opponent: Unit;

  beforeEach(() => {
    player = new Unit('player', '玩家', {
      [AttributeType.PHYSIQUE]: 50,
    });
    opponent = new Unit('opponent', '对手', {
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  it('应该检测到死亡单位', () => {
    opponent.takeDamage(opponent.maxHp + 100);

    const result = VictorySystem.checkVictory([player, opponent]);
    expect(result.battleEnded).toBe(true);
    expect(result.winner).toBe('player');
  });

  it('应该平局判定', () => {
    // 双方都死亡
    player.takeDamage(player.maxHp + 100);
    opponent.takeDamage(opponent.maxHp + 100);

    const result = VictorySystem.checkVictory([player, opponent]);
    expect(result.battleEnded).toBe(true);
    expect(result.draw).toBe(true);
  });

  it('应该支持回合上限判定', () => {
    const result = VictorySystem.checkVictory([player, opponent], 30);
    expect(result.battleEnded).toBe(true);
    expect(result.reachedMaxTurns).toBe(true);
  });

  it('应该在回合未达上限时不结束战斗', () => {
    const result = VictorySystem.checkVictory([player, opponent], 29);
    expect(result.battleEnded).toBe(false);
    expect(result.winner).toBeUndefined();
  });

  it('应该在双方存活时按血量百分比判定胜负', () => {
    // 玩家血量更高
    player.takeDamage(10);
    opponent.takeDamage(50);

    const result = VictorySystem.checkVictory([player, opponent], 30);
    expect(result.battleEnded).toBe(true);
    expect(result.winner).toBe('player');
    expect(result.loser).toBe('opponent');
    expect(result.reachedMaxTurns).toBe(true);
  });

  it('应该在没有提供回合数时不判定回合上限', () => {
    const result = VictorySystem.checkVictory([player, opponent]);
    expect(result.battleEnded).toBe(false);
    expect(result.reachedMaxTurns).toBeUndefined();
  });

  it('应该返回正确的最大回合数', () => {
    expect(VictorySystem.getMaxTurns()).toBe(30);
  });
});

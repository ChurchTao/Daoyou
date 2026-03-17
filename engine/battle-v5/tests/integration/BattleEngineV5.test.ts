import { BattleEngineV5 } from '../../BattleEngineV5';
import { CultivatorAdapter } from '../../adapters/CultivatorAdapter';
import { AttributeType } from '../../core/types';

describe('BattleEngineV5 Integration', () => {
  it('应该执行完整战斗流程', () => {
    const playerData = {
      id: 'player',
      name: '玩家',
      attributes: { spirit: 80, vitality: 60, speed: 50, wisdom: 40, willpower: 30 },
    };
    const opponentData = {
      id: 'opponent',
      name: '对手',
      attributes: { spirit: 70, vitality: 50, speed: 45, wisdom: 35, willpower: 25 },
    };

    const player = CultivatorAdapter.toUnit(playerData);
    const opponent = CultivatorAdapter.toUnit(opponentData);

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    expect(result.winner).toBeDefined();
    expect(result.turns).toBeGreaterThan(0);
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it('应该支持回合上限', () => {
    const playerData = {
      id: 'player',
      name: '玩家',
      attributes: { spirit: 10, vitality: 1000, speed: 10, wisdom: 10, willpower: 10 },
    };
    const opponentData = {
      id: 'opponent',
      name: '对手',
      attributes: { spirit: 10, vitality: 1000, speed: 10, wisdom: 10, willpower: 10 },
    };

    const player = CultivatorAdapter.toUnit(playerData);
    const opponent = CultivatorAdapter.toUnit(opponentData);

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    expect(result.turns).toBeLessThanOrEqual(30);
  });
});

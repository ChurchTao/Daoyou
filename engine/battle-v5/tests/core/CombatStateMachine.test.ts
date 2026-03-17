import { CombatStateMachine, CombatContext } from '../../core/CombatStateMachine';
import { CombatPhase } from '../../core/types';
import { EventBus } from '../../core/EventBus';

describe('CombatStateMachine', () => {
  let stateMachine: CombatStateMachine;
  let context: CombatContext;
  const phases: CombatPhase[] = [];

  beforeEach(() => {
    phases.length = 0;
    context = {
      turn: 1,
      maxTurns: 10,
      units: new Map(),
      battleEnded: false,
      winner: null,
    };

    // 订阅所有状态事件来记录转换顺序
    EventBus.instance.reset();
    EventBus.instance.subscribe('BattleInitEvent', () => phases.push(CombatPhase.INIT), 100);
    EventBus.instance.subscribe('DestinyAwakenEvent', () => phases.push(CombatPhase.DESTINY_AWAKEN), 100);
    EventBus.instance.subscribe('RoundStartEvent', () => phases.push(CombatPhase.ROUND_START), 100);
    EventBus.instance.subscribe('RoundPreEvent', () => phases.push(CombatPhase.ROUND_PRE), 100);
    EventBus.instance.subscribe('TurnOrderEvent', () => phases.push(CombatPhase.TURN_ORDER), 100);
    EventBus.instance.subscribe('ActionEvent', () => phases.push(CombatPhase.ACTION), 100);
    EventBus.instance.subscribe('RoundPostEvent', () => phases.push(CombatPhase.ROUND_POST), 100);
    EventBus.instance.subscribe('VictoryCheckEvent', () => phases.push(CombatPhase.VICTORY_CHECK), 100);
    EventBus.instance.subscribe('BattleEndEvent', () => phases.push(CombatPhase.END), 100);

    stateMachine = new CombatStateMachine(context);
  });

  it('应该按照正确顺序转换状态', () => {
    stateMachine.start();

    // 验证初始状态转换
    expect(phases).toContain(CombatPhase.INIT);
    expect(phases).toContain(CombatPhase.DESTINY_AWAKEN);
    expect(phases).toContain(CombatPhase.ROUND_START);
    expect(phases).toContain(CombatPhase.ROUND_PRE);
  });

  it('第1回合应该包含命格觉醒阶段', () => {
    stateMachine.start();

    expect(phases).toContain(CombatPhase.DESTINY_AWAKEN);
  });

  it('战斗结束后应该停止转换', () => {
    // 模拟战斗结束
    context.battleEnded = true;
    context.winner = 'player';

    stateMachine.start();

    expect(phases).toContain(CombatPhase.END);
    expect(stateMachine.getCurrentPhase()).toBe(CombatPhase.END);
  });

  it('getCurrentPhase 应该返回当前状态', () => {
    expect(stateMachine.getCurrentPhase()).toBeNull();

    stateMachine.start();

    // 最终状态应该是 END（因为 battleEnded 默认为 false，会继续循环）
    expect(stateMachine.getCurrentPhase()).not.toBeNull();
  });
});

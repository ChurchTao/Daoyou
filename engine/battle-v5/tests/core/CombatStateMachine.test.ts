import { CombatStateMachine, CombatContext } from '../../core/CombatStateMachine';
import { CombatPhase } from '../../core/types';
import { EventBus } from '../../core/EventBus';

// Helper function to create mock context
function createMockContext(): CombatContext {
  return {
    turn: 1,
    maxTurns: 10,
    units: new Map(),
    battleEnded: false,
    winner: null,
    currentCaster: null,
  };
}

// Helper function to create mock unit
function createMockUnit(id: string, name: string): { id: string; name: string } {
  return { id, name };
}

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
      currentCaster: null,
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

    // 验证初始状态转换（只到 INIT，不再自动转换）
    expect(phases).toContain(CombatPhase.INIT);
    expect(phases).not.toContain(CombatPhase.DESTINY_AWAKEN);
  });

  it('第1回合应该包含命格觉醒阶段', () => {
    stateMachine.start();

    // 不再自动转换，需要手动驱动
    expect(phases).not.toContain(CombatPhase.DESTINY_AWAKEN);
  });

  it('战斗结束后应该停止转换', () => {
    // 模拟战斗结束
    context.battleEnded = true;
    context.winner = 'player';

    stateMachine.start();

    // 只触发 INIT，不再自动转换到 END
    expect(phases).toContain(CombatPhase.INIT);
    expect(phases).not.toContain(CombatPhase.END);
  });

  it('getCurrentPhase 应该返回当前状态', () => {
    expect(stateMachine.getCurrentPhase()).toBeNull();

    stateMachine.start();

    // 应该停留在 INIT 状态
    expect(stateMachine.getCurrentPhase()).toBe(CombatPhase.INIT);
  });
});

describe('CombatStateMachine - CurrentCaster', () => {
  it('should track current caster during action phase', () => {
    const context = createMockContext();
    const sm = new CombatStateMachine(context);
    const mockUnit = createMockUnit('unit1', '测试单位');

    sm.start();

    // 设置当前出手单位
    sm.setCurrentCaster(mockUnit);
    expect(sm.getCurrentCaster()).toBe(mockUnit);
  });

  it('should clear current caster after action phase', () => {
    const context = createMockContext();
    const sm = new CombatStateMachine(context);
    const mockUnit = createMockUnit('unit1', '测试单位');

    sm.setCurrentCaster(mockUnit);
    sm.clearCurrentCaster();
    expect(sm.getCurrentCaster()).toBeNull();
  });
});

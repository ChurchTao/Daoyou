import { LogSubscriber } from '../../systems/log/LogSubscriber';
import { LogAggregator } from '../../systems/log/LogAggregator';
import { EventBus } from '../../core/EventBus';

describe('LogSubscriber', () => {
  let subscriber: LogSubscriber;
  let aggregator: LogAggregator;
  let eventBus: EventBus;

  beforeEach(() => {
    aggregator = new LogAggregator();
    subscriber = new LogSubscriber(aggregator);
    eventBus = EventBus.instance;
    subscriber.subscribe(eventBus);
  });

  afterEach(() => {
    subscriber.unsubscribe(eventBus);
  });

  it('应该响应 ActionPreEvent 并开启 action_pre Span', () => {
    const spy = jest.spyOn(aggregator, 'beginActionPreSpan');
    const unit = { id: 'u1', name: '测试单位' } as any;
    
    eventBus.publish({
      type: 'ActionPreEvent',
      timestamp: Date.now(),
      caster: unit
    });
    
    expect(spy).toHaveBeenCalledWith(unit);
  });

  it('应该响应 ActionEvent 并开启 action Span', () => {
    const spy = jest.spyOn(aggregator, 'beginActionSpan');
    const unit = { id: 'u1', name: '测试单位' } as any;
    
    eventBus.publish({
      type: 'ActionEvent',
      timestamp: Date.now(),
      caster: unit
    });
    
    // ActionEvent 应该触发 beginActionSpan，这里模拟普攻
    expect(spy).toHaveBeenCalled();
  });

  it('应该响应 DamageTakenEvent 并添加 LogEntry', () => {
    const spy = jest.spyOn(aggregator, 'addEntry');
    const unit = { id: 'u1', name: '测试单位' } as any;
    const caster = { id: 'c1', name: '攻击者' } as any;
    
    aggregator.beginActionSpan(caster, { id: 'basic_attack', name: '普攻' } as any);
    
    eventBus.publish({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: caster,
      target: unit,
      damageTaken: 100,
      remainHealth: 900,
      isLethal: false
    });
    
    expect(spy).toHaveBeenCalled();
    const entry = spy.mock.calls[0][0];
    expect(entry.type).toBe('damage');
    expect(entry.data.value).toBe(100);
  });

  it('应该正确处理 DOT 伤害（带 buff 字段的 DamageTakenEvent）', () => {
    const unit = { id: 'u1', name: '测试单位' } as any;
    
    // 模拟 ActionPre 阶段
    eventBus.publish({
      type: 'ActionPreEvent',
      timestamp: Date.now(),
      caster: unit
    });
    
    const spy = jest.spyOn(aggregator, 'addEntry');
    eventBus.publish({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      target: unit,
      buff: { id: 'poison', name: '中毒' } as any,
      damageTaken: 50,
      remainHealth: 850,
      isLethal: false
    });
    
    expect(spy).toHaveBeenCalled();
    const entry = spy.mock.calls[0][0];
    expect(entry.type).toBe('damage');
    expect(entry.message).toContain('中毒');
  });
});

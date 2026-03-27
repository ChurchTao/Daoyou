import { LogPresenter } from '../../../systems/log/LogPresenter';
import { LogEntry, LogEntryType, LogSpan } from '../../../systems/log/types';

const createEntry = <T extends LogEntryType>(
  type: T,
  data: LogEntry<T>['data'],
): LogEntry<T> => ({
  id: `entry_${type}_${Math.random().toString(36).slice(2, 8)}`,
  type,
  data,
  timestamp: Date.now(),
});

const createActionSpan = (entries: LogEntry[]): LogSpan => ({
  id: `span_${Math.random().toString(36).slice(2, 8)}`,
  type: 'action',
  turn: 1,
  actor: { id: 'a', name: '张三' },
  ability: { id: 'fireball', name: '火球术' },
  entries,
  timestamp: Date.now(),
});

describe('LogPresenter 行动日志聚合', () => {
  it('普攻命中应输出完整伤害文本', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 100,
        remainHp: 500,
        isCritical: false,
        targetName: '李四',
      }),
    ]);
    span.ability = { id: 'basic_attack', name: '普攻' };

    expect(presenter.formatSpan(span)).toBe(
      '「张三」发起攻击，对「李四」造成 100 点伤害',
    );
  });

  it('技能 + Buff 应包含持续回合', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 1280,
        remainHp: 420,
        isCritical: false,
        targetName: '李四',
      }),
      createEntry('buff_apply', {
        buffName: '灼烧',
        buffType: 'debuff',
        targetName: '李四',
        layers: 2,
        duration: 2,
      }),
    ]);

    expect(presenter.formatSpan(span)).toBe(
      '「张三」施放《火球术》，对「李四」造成 1,280 点伤害并施加「灼烧」×2（2 回合）',
    );
  });

  it('驱散应使用中文并列分隔符', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('dispel', {
        targetName: '李四',
        buffs: ['灼烧', '中毒'],
      }),
    ]);

    expect(presenter.formatSpan(span)).toBe(
      '「张三」施放《火球术》，清除了「李四」身上的「灼烧」、「中毒」',
    );
  });

  it('技能打断应包含被打断者姓名', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('skill_interrupt', {
        skillName: '火球术',
        targetName: '李四',
        reason: '施法被打断',
      }),
    ]);
    span.ability = { id: 'seal', name: '封魔击' };

    expect(presenter.formatSpan(span)).toBe(
      '「张三」施放《封魔击》，打断了「李四」的《火球术》！',
    );
  });

  it('免死应优先于击杀文案', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 200,
        remainHp: 0,
        isCritical: false,
        targetName: '李四',
      }),
      createEntry('death', {
        targetName: '李四',
        killerName: '张三',
      }),
      createEntry('death_prevent', {
        targetName: '李四',
      }),
    ]);
    span.ability = { id: 'fatal', name: '致命一击' };

    expect(presenter.formatSpan(span)).toBe(
      '「张三」施放《致命一击》，对「李四」造成 200 点伤害，「李四」触发免死效果，保住了性命！',
    );
  });

  it('反伤应并入主目标行而不是拆成自伤目标行', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 38,
        remainHp: 962,
        isCritical: false,
        targetName: '张三',
        damageSource: 'reflect',
        reflectSourceName: '李四',
      }),
      createEntry('damage', {
        value: 1300,
        remainHp: 1,
        isCritical: false,
        targetName: '李四',
      }),
      createEntry('death_prevent', {
        targetName: '李四',
      }),
    ]);
    span.ability = { id: 'basic_attack', name: '普攻' };

    expect(presenter.formatSpan(span)).toBe(
      '「张三」发起攻击，对「李四」造成 1,300 点伤害，「李四」触发免死效果，保住了性命！，反弹 38 点伤害给「张三」',
    );
  });

  it('护盾完全吸收时也应输出0伤害和抵扣护盾', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 0,
        remainHp: 1000,
        isCritical: false,
        targetName: '李四',
        shieldAbsorbed: 114,
        remainShield: 186,
      }),
    ]);
    span.ability = { id: 'basic_attack', name: '普攻' };

    expect(presenter.formatSpan(span)).toBe(
      '「张三」发起攻击，对「李四」造成 0 点伤害（抵扣护盾 114 点）',
    );
  });

  it('多目标应每目标一行', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 100,
        remainHp: 300,
        isCritical: false,
        targetName: '李四',
      }),
      createEntry('damage', {
        value: 120,
        remainHp: 280,
        isCritical: true,
        targetName: '王五',
      }),
    ]);

    expect(presenter.formatSpan(span)).toBe(
      [
        '「张三」施放《火球术》，对「李四」造成 100 点伤害',
        '「张三」施放《火球术》，对「王五」造成 120 点伤害（暴击）！',
      ].join('\n'),
    );
  });
});

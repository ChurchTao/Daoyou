import { LogPresenter } from '../../../systems/log/LogPresenter';
import { Ability } from '../../../abilities/Ability';
import { EventBus } from '../../../core/EventBus';
import type { BattleInitEvent, HealEvent, SkillCastEvent } from '../../../core/events';
import { AbilityType, BuffType } from '../../../core/types';
import { BuffFactory } from '../../../factories/BuffFactory';
import { CombatLogSystem } from '../../../systems/log/CombatLogSystem';
import { Unit } from '../../../units/Unit';
import type {
  LogEntry,
  LogEntryType,
  LogSpan,
} from '../../../systems/log/types';

function entry<T extends LogEntryType>(
  type: T,
  data: LogEntry<T>['data'],
): LogEntry<T> {
  return {
    id: `${type}-${Math.random().toString(36).slice(2)}`,
    type,
    data,
    timestamp: Date.now(),
  };
}

function action(entries: LogEntry[]): LogSpan {
  return {
    id: 'action-v42',
    type: 'action',
    turn: 1,
    actor: { id: 'actor', name: '魁星士' },
    ability: { id: 'falling-stars', name: '剑落星河' },
    entries,
    timestamp: Date.now(),
  };
}

describe('V4.2战斗日志归组', () => {
  it('多段伤害合计吸取和削蓝，行动级剑势与调息只输出一次', () => {
    const source = {
      unitId: 'actor',
      unitName: '魁星士',
      abilityId: 'falling-stars',
      abilityName: '剑落星河',
    };
    const span = action([
      ...[1515, 1553, 1652].map((value, index) => entry('damage', {
        value,
        beforeHp: 20_000 - index * value,
        remainHp: 20_000 - (index + 1) * value,
        isCritical: false,
        targetName: '木桩',
        damageSource: 'direct',
        source,
      })),
      ...[152, 152, 58].map((value) => entry('mana_burn', {
        value,
        targetName: '木桩',
        source,
      })),
      ...[300, 307, 327].map((value) => entry('resource_drain', {
        value,
        drainType: 'hp',
        targetName: '木桩',
        source,
      })),
      entry('resource_change', {
        targetName: '魁星士',
        resourceId: 'sect.lingxiao.sword-momentum',
        resourceName: '剑势',
        resourceMax: 6,
        operation: 'add',
        reason: 'gain',
        requested: 1,
        applied: 1,
        overflow: 0,
        before: 0,
        after: 1,
        source,
      }),
      entry('action_state', {
        unitId: 'actor',
        unitName: '魁星士',
        stateType: 'rest',
        phase: 'entered',
        name: '调息',
        remainingActions: 1,
        sourceAbility: {
          id: 'falling-stars',
          name: '剑落星河',
        },
      }),
    ]);

    const lines = new LogPresenter().formatSpan(span);
    const text = lines.join('\n');

    expect(lines).toEqual([
      '「魁星士」施放《剑落星河》，对「木桩」连续命中3段：',
      '1,515、1,553、1,652，合计4,720点气血伤害',
      '共削减「木桩」362点法力',
      '从「木桩」身上共吸取934点气血',
      '获得1点剑势（1/6）',
      '进入「调息」，下一次行动跳过',
    ]);
    expect(text.match(/施放《剑落星河》/g)).toHaveLength(1);
    expect(text.match(/剑势/g)).toHaveLength(1);
  });

  it('同一技能的不同伤害包使用中性分段日志', () => {
    const span = action([
      entry('damage', {
        value: 120,
        beforeHp: 1_000,
        remainHp: 880,
        isCritical: false,
        targetName: '木桩',
        damageSource: 'direct',
      }),
      entry('damage', {
        value: 180,
        beforeHp: 880,
        remainHp: 700,
        isCritical: false,
        targetName: '木桩',
        damageSource: 'direct',
      }),
    ]);

    expect(new LogPresenter().formatSpan(span)).toEqual([
      '「魁星士」施放《剑落星河》，对「木桩」连续命中2段：',
      '120、180，合计300点气血伤害',
    ]);
    const parts = new LogPresenter().presentSpan(span)[1].parts;
    expect(parts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'number',
        text: '120',
        tone: 'damage-generic',
      }),
      expect.objectContaining({
        kind: 'number',
        text: '180',
        tone: 'damage-generic',
      }),
    ]));
  });

  it('调息跳过显示行动者', () => {
    const span: LogSpan = {
      id: 'rest-v42',
      type: 'action_pre',
      turn: 2,
      actor: { id: 'actor', name: '魁星士' },
      entries: [entry('action_state', {
        unitId: 'actor',
        unitName: '魁星士',
        stateType: 'rest',
        phase: 'skipped',
        name: '调息',
        remainingActions: 0,
      })],
      timestamp: Date.now(),
    };

    expect(new LogPresenter().formatSpan(span)).toEqual([
      '「魁星士」因调息跳过本次行动',
    ]);
  });

  it('被动回蓝独立成触发行，内部marker和机制不进入玩家日志', () => {
    const span = action([
      entry('damage', {
        value: 5917,
        beforeHp: 10_000,
        remainHp: 4083,
        isCritical: false,
        targetName: '木桩',
        damageSource: 'direct',
      }),
      entry('resource_drain', {
        value: 1171,
        drainType: 'hp',
        targetName: '木桩',
      }),
      entry('heal', {
        value: 275,
        remainHp: 10_000,
        remainMp: 900,
        targetName: '魁星士',
        healType: 'mp',
        source: {
          unitId: 'actor',
          unitName: '魁星士',
          buffId: 'body_cultivation_organs_skill_refund',
          buffName: '脏腑·五气回流',
        },
      }),
      entry('buff_apply', {
        buffId: 'body_cultivation_organs_skill_refund_marker',
        buffName: '脏腑·五气已回流',
        buffType: 'buff',
        targetId: 'actor',
        targetName: '魁星士',
        duration: -1,
        durationUnit: 'owner_action',
        visibility: 'debug',
      }),
      entry('mechanic', {
        mechanic: 'memory_record',
        targetName: '魁星士',
        name: 'internal_key',
        internalKey: 'internal_key',
        value: 275,
        visibility: 'debug',
      }),
      entry('resource_change', {
        targetName: '魁星士',
        resourceId: 'sect.lingxiao.sword-momentum',
        resourceName: '剑势',
        resourceMax: 6,
        operation: 'consume_all',
        reason: 'spend',
        requested: -3,
        applied: -3,
        overflow: 0,
        before: 3,
        after: 0,
      }),
    ]);
    span.ability = { id: 'ultimate', name: '万剑归一' };

    const lines = new LogPresenter().formatSpan(span);
    const text = lines.join('\n');
    expect(lines).toEqual([
      '「魁星士」施放《万剑归一》，对「木桩」造成 5,917 点伤害',
      '从「木桩」身上吸取1,171点气血',
      '「魁星士」触发「脏腑·五气回流」，恢复275点法力',
      '消耗3点剑势（0/6）',
    ]);
    expect(text.match(/施放《万剑归一》/g)).toHaveLength(1);
    expect(text).not.toMatch(/已回流|特殊机制|internal_key/);
  });

  it('不同来源不合并，零收益不输出', () => {
    const span = action([
      entry('resource_drain', {
        value: 100,
        drainType: 'mp',
        targetName: '木桩',
        source: { abilityId: 'a', abilityName: '吸元诀' },
      }),
      entry('resource_drain', {
        value: 50,
        drainType: 'mp',
        targetName: '木桩',
        source: { buffId: 'b', buffName: '夺灵' },
      }),
      entry('mana_burn', {
        value: 0,
        targetName: '木桩',
      }),
      entry('heal', {
        value: 0,
        remainHp: 1000,
        targetName: '魁星士',
        healType: 'hp',
      }),
    ]);

    const lines = new LogPresenter().formatSpan(span);
    expect(lines).toContain('从「木桩」身上吸取100点法力');
    expect(lines).toContain('从「木桩」身上吸取50点法力');
    expect(lines.join('\n')).not.toContain('150点');
    expect(lines.join('\n')).not.toMatch(/恢复0点|削减「木桩」0点|吸取0点/);
  });

  it('直接产生语义片段并标记行角色', () => {
    const span = action([
      entry('damage', {
        value: 100,
        beforeHp: 1000,
        remainHp: 900,
        isCritical: true,
        targetName: '木桩',
      }),
    ]);

    const [line] = new LogPresenter().presentSpan(span);
    expect(line.role).toBe('primary');
    expect(line.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unit', text: '「魁星士」' }),
      expect.objectContaining({ kind: 'ability', text: '《剑落星河》' }),
      expect.objectContaining({ kind: 'number', text: '100' }),
      expect.objectContaining({ kind: 'critical', text: '暴击' }),
    ]));
  });

  it('采集器保留炼体来源并将内部marker限制在调试数据', () => {
    EventBus.instance.reset();
    const actor = new Unit('actor', '魁星士', {});
    const target = new Unit('target', '木桩', {});
    const ability = new Ability('ultimate', '万剑归一', AbilityType.ACTIVE_SKILL);
    const sourceBuff = BuffFactory.create({
      id: 'body-refund',
      name: '脏腑·五气回流',
      type: BuffType.BUFF,
      duration: -1,
      stackRule: 'override',
    });
    const marker = BuffFactory.create({
      id: 'body-refund-marker',
      name: '脏腑·五气已回流',
      type: BuffType.BUFF,
      duration: -1,
      stackRule: 'override',
      logVisibility: 'debug',
    });
    const logs = new CombatLogSystem();
    logs.subscribe(EventBus.instance);

    EventBus.instance.publish<BattleInitEvent>({
      type: 'BattleInitEvent',
      timestamp: Date.now(),
      player: actor,
      opponent: target,
    });
    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: actor,
      target,
      ability,
    });
    EventBus.instance.publish<HealEvent>({
      type: 'HealEvent',
      timestamp: Date.now(),
      caster: actor,
      target: actor,
      ability,
      buff: sourceBuff,
      healAmount: 300,
      appliedAmount: 275,
      healType: 'mp',
    });
    actor.buffs.addBuff(marker, actor, { ability, buff: sourceBuff });

    const actionSpan = logs.getSpans().find((span) => span.type === 'action');
    const heal = actionSpan?.entries.find((item) => item.type === 'heal');
    const hiddenMarker = actionSpan?.entries.find((item) => item.type === 'buff_apply');
    expect(heal?.data).toEqual(expect.objectContaining({
      value: 275,
      source: expect.objectContaining({ buffName: '脏腑·五气回流' }),
    }));
    expect(hiddenMarker?.data).toEqual(expect.objectContaining({ visibility: 'debug' }));
    expect(logs.getPlayerLogs().join('\n')).toContain(
      '「魁星士」触发「脏腑·五气回流」，恢复275点法力',
    );
    expect(logs.getPlayerLogs().join('\n')).not.toContain('脏腑·五气已回流');
    expect(JSON.stringify(logs.getDebugData())).toContain('脏腑·五气已回流');

    logs.destroy();
    EventBus.instance.reset();
  });
});

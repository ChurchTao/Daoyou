import { GameplayTags } from '@shared/engine/shared/tag-domain';
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
  it('具名机制可用结构化依据说明旧状态与新效果为何触发', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('mechanic', {
        mechanic: 'named_trigger',
        targetName: '李四',
        sourceName: '张三',
        name: '蒸发',
        displayName: '蒸发',
        internalKey: 'sect.tianyan.reaction.vaporize',
        visibility: 'player',
        triggerBasis: {
          left: { id: 'seal.fire', displayName: '火印' },
          relation: { id: 'reaction.overcome', displayName: '冲克' },
          right: { id: 'element.water', displayName: '水术' },
        },
      }),
    ]);

    expect(presenter.formatSpan(span).join('\n')).toContain(
      '「张三」因「李四」的「火印」与本次「水术」发生「冲克」，触发「蒸发」',
    );
    expect(presenter.formatSpan(span).join('\n')).not.toContain('seal.fire');
  });

  it('没有结构化依据的既有具名机制沿用普通触发格式', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('mechanic', {
        mechanic: 'named_trigger',
        targetName: '张三',
        sourceName: '张三',
        name: '洛书断局',
        displayName: '洛书断局',
        visibility: 'player',
      }),
    ]);

    expect(presenter.formatSpan(span).join('\n')).toContain(
      '「张三」触发「洛书断局」',
    );
  });

  it.each([
    ['apply', undefined, '「李四」获得「火印」'],
    ['refresh', undefined, '「李四」的「火印」持续时间刷新'],
    ['replace', '木印', '「李四」的「木印」转为「火印」'],
    ['consume', undefined, '「李四」的「火印」被消耗'],
  ] as const)('通用状态迁移按%s操作使用现有展示管道', (
    operation,
    previousDisplayName,
    expected,
  ) => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('mechanic', {
        mechanic: 'status_transition',
        targetName: '李四',
        sourceName: '张三',
        name: '火印',
        displayName: '火印',
        internalKey: `test.status.${operation}`,
        visibility: 'player',
        operation,
        previousDisplayName,
      }),
    ]);

    const text = presenter.formatSpan(span).join('\n');
    expect(text).toContain(expected);
    expect(text).not.toContain(`test.status.${operation}`);
  });

  it('带结构化原因的追伤应显示具体机制而非乘势追击', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 688,
        beforeHp: 1000,
        remainHp: 312,
        isCritical: false,
        targetName: '李四',
        damageSource: 'follow_up',
        source: { unitId: 'a', unitName: '张三' },
        cause: { kind: 'mechanic', id: 'reaction-vaporize', displayName: '蒸发' },
      }),
    ]);

    expect(presenter.formatSpan(span)).toContain(
      '「张三」因「蒸发」追加伤害，对「李四」造成688点伤害',
    );
  });

  it.each([
    '冲克·蒸发',
    '冲克·泥沼',
    '冲克·崩根',
    '冲克·断脉',
    '冲克·熔金',
  ])('冲克追伤应逐项保留完整原因：%s', (displayName) => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 200,
        beforeHp: 1000,
        remainHp: 800,
        isCritical: false,
        targetName: '李四',
        damageSource: 'follow_up',
        source: { unitId: 'a', unitName: '张三' },
        cause: {
          kind: 'mechanic',
          id: `reaction-${displayName}`,
          displayName,
        },
      }),
    ]);

    expect(presenter.formatSpan(span)).toContain(
      `「张三」因「${displayName}」追加伤害，对「李四」造成200点伤害`,
    );
  });

  it('无结构化原因的追伤使用通用文本', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 300,
        beforeHp: 1000,
        remainHp: 700,
        isCritical: false,
        targetName: '李四',
        damageSource: 'follow_up',
        source: { unitId: 'a', unitName: '张三' },
      }),
    ]);

    expect(presenter.formatSpan(span)).toContain(
      '「张三」乘势追击，对「李四」造成300点伤害',
    );
  });

  it('同行动不同原因的追伤不得合并', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      ...[
        ['mud', '泥沼', 200],
        ['luoshu', '洛书断局', 250],
      ].map(([id, displayName, value]) =>
        createEntry('damage', {
          value: value as number,
          beforeHp: 1000,
          remainHp: 500,
          isCritical: false,
          targetName: '李四',
          damageSource: 'follow_up' as const,
          source: { unitId: 'a', unitName: '张三' },
          cause: {
            kind: 'mechanic' as const,
            id: id as string,
            displayName: displayName as string,
          },
        }),
      ),
    ]);
    const lines = presenter.formatSpan(span);

    expect(lines).toContain('「张三」因「泥沼」追加伤害，对「李四」造成200点伤害');
    expect(lines).toContain('「张三」因「洛书断局」追加伤害，对「李四」造成250点伤害');
    expect(lines.join('\n')).not.toContain('450点');
  });

  it('行动内多次手动DOT应按Buff与原因聚合', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      ...[128, 128].map((value) =>
        createEntry('damage', {
          value,
          beforeHp: 1000,
          remainHp: 744,
          isCritical: false,
          targetName: '李四',
          damageSource: 'delayed' as const,
          source: {
            unitId: 'a',
            unitName: '张三',
            buffId: 'burn',
            buffName: '灼烧',
          },
          cause: { kind: 'mechanic' as const, id: 'vaporize', displayName: '蒸发' },
        }),
      ),
    ]);

    expect(presenter.formatSpan(span)).toContain(
      '「灼烧」受「蒸发」引动，对「李四」立即结算2次：128、128，合计256点持续伤害',
    );
  });

  it('自然DOT仍沿用行动前的状态发作文案', () => {
    const presenter = new LogPresenter();
    const span: LogSpan = {
      ...createActionSpan([]),
      type: 'action_pre',
      actor: { id: 'b', name: '李四' },
      ability: undefined,
      entries: [
        createEntry('damage', {
          value: 128,
          beforeHp: 1000,
          remainHp: 872,
          isCritical: false,
          targetName: '李四',
          damageSource: 'delayed',
          source: {
            unitId: 'a',
            unitName: '张三',
            buffId: 'burn',
            buffName: '灼烧',
          },
        }),
      ],
    };

    expect(presenter.formatSpan(span)).toEqual([
      '「李四」身上的「灼烧」发作，造成 128 点伤害',
    ]);
  });

  it('反应日志按触发、追伤、法印迁移的因果顺序展示', () => {
    const presenter = new LogPresenter();
    const lines = presenter.formatSpan(createActionSpan([
      createEntry('mechanic', {
        mechanic: 'named_trigger',
        targetName: '李四',
        sourceName: '张三',
        name: '蒸发',
        displayName: '蒸发',
        internalKey: 'sect.tianyan.reaction.vaporize',
        visibility: 'player',
      }),
      createEntry('damage', {
        value: 688,
        beforeHp: 1000,
        remainHp: 312,
        isCritical: false,
        targetName: '李四',
        damageSource: 'follow_up',
        source: { unitId: 'a', unitName: '张三' },
        cause: { kind: 'mechanic', id: 'vaporize', displayName: '蒸发' },
      }),
      createEntry('mechanic', {
        mechanic: 'status_transition',
        targetName: '李四',
        sourceName: '张三',
        name: '水印',
        displayName: '水印',
        internalKey: 'sect.tianyan.element-seal.replace',
        visibility: 'player',
        operation: 'replace',
        previousDisplayName: '火印',
      }),
    ]));

    const triggerIndex = lines.findIndex((line) => line.includes('触发「蒸发」'));
    const damageIndex = lines.findIndex((line) => line.includes('因「蒸发」追加伤害'));
    const transitionIndex = lines.findIndex((line) => line.includes('转为「水印」'));
    expect(triggerIndex).toBeGreaterThanOrEqual(0);
    expect(damageIndex).toBeGreaterThan(triggerIndex);
    expect(transitionIndex).toBeGreaterThan(damageIndex);
  });

  it('普攻命中应输出完整伤害文本', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 100,
        remainHp: 500,
        isCritical: false,
        targetName: '李四',
        beforeHp: 0
      }),
    ]);
    span.ability = { id: 'basic_attack', name: '普攻' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」发起攻击，对「李四」造成 100 点伤害',
    ]);
  });

  it('技能 + Buff 应包含持续回合', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 1280,
        remainHp: 420,
        isCritical: false,
        targetName: '李四',
        beforeHp: 0
      }),
      createEntry('buff_apply', {
        buffId: 'burn',
        buffName: '灼烧',
        buffType: 'debuff',
        targetId: 'b',
        targetName: '李四',
        layers: 2,
        duration: 2,
        durationUnit: 'owner_action',
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》，对「李四」造成 1,280 点伤害并施加「灼烧」×2（未来2次自身行动）',
    ]);
  });

  it('同一技能连续叠加同名状态时只展示最终层数', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      ...[672, 703, 663].map((value) =>
        createEntry('damage', {
          value,
          remainHp: 10_000,
          isCritical: false,
          targetName: '李四',
          beforeHp: 12_038,
        }),
      ),
      ...[1, 2, 3].map((layers) =>
        createEntry('buff_apply', {
          buffId: 'status.stack',
          buffName: '业门',
          buffType: 'debuff',
          targetId: 'b',
          targetName: '李四',
          layers,
          duration: 4,
          durationUnit: 'owner_action',
        }),
      ),
    ]);
    span.ability = { id: 'three-knocks', name: '三叩业门' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《三叩业门》，对「李四」连续命中3段：',
      '672、703、663，合计2,038点气血伤害并施加「业门」×3（未来4次自身行动）',
    ]);
  });

  it('同名但不同 ID 的状态保持独立展示', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('buff_apply', {
        buffId: 'status.fire.outer',
        buffName: '灼烧',
        buffType: 'debuff',
        targetId: 'b',
        targetName: '李四',
        layers: 1,
        duration: 2,
        durationUnit: 'owner_action',
      }),
      createEntry('buff_apply', {
        buffId: 'status.fire.inner',
        buffName: '灼烧',
        buffType: 'debuff',
        targetId: 'b',
        targetName: '李四',
        layers: 2,
        duration: 3,
        durationUnit: 'owner_action',
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》，对「李四」施加「灼烧」（未来2次自身行动）、「灼烧」×2（未来3次自身行动）',
    ]);
  });

  it('纯状态层数变化不进入玩家日志，反击结果仍保留', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 1,
        remainHp: 999,
        isCritical: false,
        targetName: '李四',
        beforeHp: 1_000,
      }),
      createEntry('mechanic', {
        mechanic: 'buff_layer',
        targetName: '张三',
        sourceName: '李四',
        name: '业门',
        displayName: '业门',
        visibility: 'player',
        source: { unitName: '李四', buffName: '业门' },
      }),
      createEntry('damage', {
        value: 326,
        remainHp: 674,
        isCritical: false,
        targetName: '张三',
        beforeHp: 1_000,
        damageSource: 'counter',
        source: {
          unitName: '李四',
          abilityName: '业门',
        },
      }),
    ]);
    span.ability = { id: 'basic_attack', name: '普攻' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」发起攻击，对「李四」造成 1 点伤害',
      '「李四」触发「业门」反击，对「张三」造成326点伤害',
    ]);
  });

  it('形态技能先展示施法效果，再独立展示进入形态', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('buff_apply', {
        buffId: 'status.guard',
        buffName: '止观',
        buffType: 'buff',
        targetId: 'a',
        targetName: '张三',
        duration: -1,
        durationUnit: 'owner_action',
      }),
      createEntry('action_state', {
        unitId: 'a',
        unitName: '张三',
        stateType: 'ability_mode',
        phase: 'entered',
        name: '魔相·止观',
        remainingActions: 2,
        sourceAbility: {
          id: 'turn-form',
          name: '魔相入身',
        },
      }),
      createEntry('resource_change', {
        targetName: '张三',
        resourceId: 'sect.wuxiang.war-intent',
        resourceName: '心念',
        resourceMax: 6,
        operation: 'subtract',
        reason: 'spend',
        requested: -3,
        applied: -3,
        overflow: 0,
        before: 3,
        after: 0,
      }),
    ]);
    span.ability = { id: 'turn-form', name: '魔相入身' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《魔相入身》，对「张三」施加「止观」（永久）',
      '「张三」进入「魔相·止观」',
      '消耗3点心念（0/6）',
    ]);
  });

  it('纯控制被抵抗时应输出抵抗文本', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('resist', {
        targetName: '李四',
      }),
    ]);
    span.ability = { id: 'control', name: '定身术' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《定身术》，被「李四」抵抗了！',
    ]);
  });

  it('伤害控制复合技能被抵抗时仍应输出伤害', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 300,
        remainHp: 700,
        isCritical: false,
        targetName: '李四',
        beforeHp: 1000,
      }),
      createEntry('resist', {
        targetName: '李四',
      }),
    ]);
    span.ability = { id: 'mixed_control_damage', name: '雷锁' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《雷锁》，对「李四」造成 300 点伤害，「李四」抵抗了控制效果',
    ]);
  });

  it('驱散应使用中文并列分隔符', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('dispel', {
        targetName: '李四',
        buffs: ['灼烧', '中毒'],
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》，清除了「李四」身上的「灼烧」、「中毒」',
    ]);
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

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《封魔击》，打断了「李四」的《火球术》！',
    ]);
  });

  it('免死应优先于击杀文案', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 200,
        remainHp: 0,
        isCritical: false,
        targetName: '李四',
        beforeHp: 0
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

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《致命一击》，对「李四」造成 200 点伤害，「李四」触发免死效果，保住了性命！',
    ]);
  });

  it('反伤应作为同一行动块内的独立来源行', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 38,
        remainHp: 962,
        isCritical: false,
        targetName: '张三',
        damageSource: 'reflect',
        reflectSourceName: '李四',
        beforeHp: 0
      }),
      createEntry('damage', {
        value: 1300,
        remainHp: 1,
        isCritical: false,
        targetName: '李四',
        beforeHp: 0
      }),
      createEntry('death_prevent', {
        targetName: '李四',
      }),
    ]);
    span.ability = { id: 'basic_attack', name: '普攻' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」发起攻击，对「李四」造成 1,300 点伤害，「李四」触发免死效果，保住了性命！',
      '「李四」反伤，对「张三」造成38点伤害',
    ]);
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
        beforeHp: 0
      }),
    ]);
    span.ability = { id: 'basic_attack', name: '普攻' };

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」发起攻击，对「李四」造成 0 点伤害（抵扣护盾 114 点）',
    ]);
  });

  it('多目标应每目标一行', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 100,
        remainHp: 300,
        isCritical: false,
        targetName: '李四',
        beforeHp: 0
      }),
      createEntry('damage', {
        value: 120,
        remainHp: 280,
        isCritical: true,
        targetName: '王五',
        beforeHp: 0
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》：',
      '对「李四」造成 100 点伤害',
      '对「王五」造成 120 点伤害（暴击）！',
    ]);
  });

  it('魔法盾吸收应在伤害文案后追加法力化解描述', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage', {
        value: 2,
        beforeHp: 1000,
        remainHp: 998,
        isCritical: false,
        targetName: '李四',
      }),
      createEntry('mana_shield_absorb', {
        targetName: '李四',
        absorbedDamage: 98,
        mpConsumed: 98,
        remainDamage: 2,
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》，对「李四」造成 2 点伤害，「李四」以法力化解 98 点伤害（消耗 98 点法力）',
    ]);
  });

  it('伤害免疫应输出免疫描述', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('damage_immune', {
        targetName: '李四',
        blockedDamage: 120,
        matchedTag: GameplayTags.ABILITY.CHANNEL.MAGIC,
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》，对「李四」造成 0 点伤害，「李四」免疫了此次伤害',
    ]);
  });

  it('纯 Buff 免疫应输出被免疫文案', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('buff_immune', {
        buffName: '灼烧',
        targetName: '李四',
        immuneTag: 'Buff.Type.Debuff',
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》，对「李四」施加的「灼烧」被免疫了',
    ]);
  });

  it('高级机制日志应出现在行动描述中', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('mechanic', {
        mechanic: 'damage_defer',
        targetName: '李四',
        name: '延迟伤害',
        value: 120,
        detail: '2',
      }),
      createEntry('mechanic', {
        mechanic: 'ability_transform',
        targetName: '张三',
        name: '下一击规则',
        value: 1,
      }),
      createEntry('mechanic', {
        mechanic: 'hp_sacrifice',
        targetName: '张三',
        name: '气血献祭',
        value: 80,
      }),
    ]);

    expect(presenter.formatSpan(span)).toEqual([
      '「张三」施放《火球术》：',
      '「李四」将 120 点伤害延后 2 回合结算',
      '「张三」获得「下一击规则」强化，「张三」献祭 80 点气血',
    ]);
  });

  it('记忆机制日志不应展示内部 key', () => {
    const presenter = new LogPresenter();
    const span = createActionSpan([
      createEntry('mechanic', {
        mechanic: 'memory_record',
        targetName: '李四',
        name: 'calamity_debt',
        value: 12_000,
      }),
      createEntry('mechanic', {
        mechanic: 'memory_release',
        targetName: '李四',
        name: 'calamity_debt',
        value: 2_400,
      }),
    ]);

    const lines = presenter.formatSpan(span);
    expect(lines.join(' ')).toContain('劫债');
    expect(lines.join(' ')).not.toContain('calamity_debt');
  });
});

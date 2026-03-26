# Combat Log System Refactor Design

## 概述

重构战斗日志系统，实现"既精简又完备"的目标：
- **精简**：一次行动 = 一行聚合文案
- **完备**：数值完整 + 因果链 + 时序

## 需求总结

| 维度 | 需求 |
|------|------|
| **消费者** | 玩家（战斗后复盘）+ AI（生成战报输入） |
| **精简** | 单行聚合，一次行动一行 |
| **完备** | 数值完整 + 因果链 + 时序 |
| **格式** | 带上下文的语义化描述，AI 润色 |
| **聚合边界** | 按行动聚合（一次技能施放的所有效果） |
| **当前问题** | 冗余重复、缺少上下文 |
| **因果展示** | 扁平列出，通过数据字段关联 |

## 架构设计

### 文件结构

```
engine/battle-v5/systems/log/
├── types.ts              # 类型定义（强类型）
├── LogCollector.ts       # 事件收集器（替代 LogSubscriber）
├── LogAggregator.ts      # Span 生命周期管理
├── LogPresenter.ts       # 多视图输出（替代 LogFormatter）
├── CombatLogSystem.ts    # 门面（简化）
└── index.ts
```

### 组件职责

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `LogCollector` | 监听 EventBus，转换为结构化 LogEntry | CombatEvent | LogEntry |
| `LogAggregator` | 管理 Span 生命周期，Entry 分组 | LogEntry | LogSpan[] |
| `LogPresenter` | 聚合文案生成，多视图输出 | LogSpan[] | Text/JSON |
| `CombatLogSystem` | 门面，协调组件 | - | - |

### 数据流

```
EventBus
   │
   ▼
LogCollector.subscribe()
   │
   ▼ LogEntry (纯数据，无message)
LogAggregator.addEntry()
   │
   ▼ LogSpan (分组后)
LogPresenter.present()
   │
   ├─► getPlayerView()  → 精简聚合文案
   ├─► getAIView()      → 结构化 JSON
   └─► getDebugView()   → 完整调试数据
```

## 数据模型

### LogEntry 强类型设计

**重要变化**：移除现有 `types.ts` 中的 `message` 和 `highlight` 字段，只保留结构化数据。

```typescript
// 日志条目类型（完整列表，包含所有现有类型）
export type LogEntryType =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'buff_apply'
  | 'buff_remove'
  | 'buff_immune'
  | 'dodge'
  | 'resist'
  | 'death'
  | 'mana_burn'
  | 'resource_drain'
  | 'dispel'
  | 'reflect'
  | 'tag_trigger'
  | 'death_prevent'
  | 'skill_cast'
  | 'skill_interrupt'    // 新增：技能打断
  | 'cooldown_modify';   // 新增：冷却修改

// 各类型数据定义
export interface DamageEntryData {
  value: number;
  remainHp: number;
  isCritical: boolean;
  isLethal: boolean;
  targetName: string;
  sourceBuff?: string;
  shieldAbsorbed?: number;
  remainShield?: number;
}

export interface HealEntryData {
  value: number;
  remainHp: number;
  targetName: string;
}

export interface ShieldEntryData {
  value: number;
  targetName: string;
}

export interface BuffApplyEntryData {
  buffName: string;
  buffType: 'buff' | 'debuff' | 'neutral';
  targetName: string;
  duration: number;
}

export interface BuffRemoveEntryData {
  buffName: string;
  targetName: string;
  reason: 'manual' | 'expired' | 'dispel' | 'replace';
}

export interface BuffImmuneEntryData {
  buffName: string;
  targetName: string;
}

export interface DodgeEntryData {
  targetName: string;
}

export interface ResistEntryData {
  targetName: string;
}

export interface DeathEntryData {
  targetName: string;
  killerName?: string;
}

export interface ManaBurnEntryData {
  value: number;
  targetName: string;
}

export interface ResourceDrainEntryData {
  value: number;
  drainType: 'hp' | 'mp';
  targetName: string;
}

export interface DispelEntryData {
  buffs: string[];
  targetName: string;
}

export interface ReflectEntryData {
  value: number;
  targetName: string;
}

export interface TagTriggerEntryData {
  tag: string;
  targetName: string;
}

export interface DeathPreventEntryData {
  targetName: string;
}

export interface SkillCastEntryData {
  skillName: string;
}

export interface SkillInterruptEntryData {
  skillName: string;
  reason: string;
}

export interface CooldownModifyEntryData {
  value: number;
  affectedSkillName: string;
  targetName: string;
}

// 类型映射
export interface EntryDataMap {
  damage: DamageEntryData;
  heal: HealEntryData;
  shield: ShieldEntryData;
  buff_apply: BuffApplyEntryData;
  buff_remove: BuffRemoveEntryData;
  buff_immune: BuffImmuneEntryData;
  dodge: DodgeEntryData;
  resist: ResistEntryData;
  death: DeathEntryData;
  mana_burn: ManaBurnEntryData;
  resource_drain: ResourceDrainEntryData;
  dispel: DispelEntryData;
  reflect: ReflectEntryData;
  tag_trigger: TagTriggerEntryData;
  death_prevent: DeathPreventEntryData;
  skill_cast: SkillCastEntryData;
  skill_interrupt: SkillInterruptEntryData;
  cooldown_modify: CooldownModifyEntryData;
}

// 统一 Entry 结构（移除 message 和 highlight）
export interface LogEntry<T extends LogEntryType = LogEntryType> {
  id: string;
  type: T;
  data: EntryDataMap[T];
  timestamp: number;
  // 注意：不再包含 message 和 highlight 字段
}
```

### LogSpan 结构

**字段迁移说明**：
- 现有 `source` 字段重命名为 `actor`
- 新增 `ability` 字段存储技能信息
- 移除 `title` 字段（由 Presenter 生成）

```typescript
export type LogSpanType =
  | 'action'
  | 'action_pre'
  | 'round_start'
  | 'battle_init'
  | 'battle_end';

export interface LogSpan {
  id: string;
  type: LogSpanType;
  turn: number;
  actor?: { id: string; name: string };  // 原 source 字段重命名
  ability?: { id: string; name: string }; // 新增：技能信息
  entries: LogEntry[];
  timestamp: number;
  // 注意：移除 title 字段，由 Presenter 根据类型生成
}
```

## LogCollector 设计

**职责**：监听 EventBus 事件，转换为结构化 LogEntry，不生成文案。

**迁移说明**：`LogCollector` 是 `LogSubscriber` 的重构版本，职责相同但只收集数据不生成文案。

```typescript
export class LogCollector {
  private _aggregator: LogAggregator;
  private _handlers: Map<string, (event: any) => void> = new Map();

  constructor(aggregator: LogAggregator) {
    this._aggregator = aggregator;
  }

  /**
   * 辅助方法：统一订阅处理
   */
  private _addHandler(
    eventBus: EventBus,
    eventType: string,
    handler: (event: any) => void,
    priority: number = EventPriorityLevel.COMBAT_LOG
  ): void {
    eventBus.subscribe(eventType, handler, priority);
    this._handlers.set(eventType, handler);
  }

  subscribe(eventBus: EventBus): void {
    const highPriority = EventPriorityLevel.ACTION_TRIGGER + 1;

    // ===== Span 管理事件（高优先级） =====
    this._addHandler(eventBus, 'BattleInitEvent', (e: BattleInitEvent) => {
      this._aggregator.beginSpan('battle_init', { turn: 0 });
    }, highPriority);

    this._addHandler(eventBus, 'RoundStartEvent', (e: RoundStartEvent) => {
      this._aggregator.beginSpan('round_start', { turn: e.turn });
    }, highPriority);

    this._addHandler(eventBus, 'ActionPreEvent', (e: ActionPreEvent) => {
      this._aggregator.beginSpan('action_pre', {
        turn: this._aggregator.currentTurn,
        actor: { id: e.caster.id, name: e.caster.name },
      });
    }, highPriority);

    this._addHandler(eventBus, 'SkillCastEvent', (e: SkillCastEvent) => {
      this._aggregator.beginSpan('action', {
        turn: this._aggregator.currentTurn,
        actor: { id: e.caster.id, name: e.caster.name },
        ability: { id: e.ability.id, name: e.ability.name },
      });
    }, highPriority);

    this._addHandler(eventBus, 'BattleEndEvent', (e: BattleEndEvent) => {
      this._aggregator.beginSpan('battle_end', {
        turn: e.turns,
        actor: e.winner ? { id: e.winner, name: e.winner } : undefined,
      });
    }, highPriority);

    // ===== 数据收集事件（默认 COMBAT_LOG 优先级） =====

    this._addHandler(eventBus, 'DamageTakenEvent', (e: DamageTakenEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'damage',
        data: {
          value: Math.round(e.damageTaken),
          remainHp: Math.round(e.remainHealth),
          isCritical: e.isCritical ?? false,
          isLethal: e.isLethal,
          targetName: e.target.name,
          sourceBuff: e.buff?.name,
          shieldAbsorbed: e.shieldAbsorbed,
          remainShield: e.remainShield,
        },
        timestamp: Date.now(),
      });

      if (e.isLethal) {
        this._aggregator.addEntry({
          id: generateId(),
          type: 'death',
          data: {
            targetName: e.target.name,
            killerName: e.caster?.name,
          },
          timestamp: Date.now(),
        });
      }
    });

    this._addHandler(eventBus, 'HealEvent', (e: HealEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'heal',
        data: {
          value: Math.round(e.healAmount),
          remainHp: Math.round(e.target.currentHp),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ShieldEvent', (e: ShieldEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'shield',
        data: {
          value: Math.round(e.shieldAmount),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffAppliedEvent', (e: BuffAppliedEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'buff_apply',
        data: {
          buffName: e.buff.name,
          buffType: e.buff.type,
          targetName: e.target.name,
          duration: e.buff.getMaxDuration(),
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffRemovedEvent', (e: BuffRemovedEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'buff_remove',
        data: {
          buffName: e.buff.name,
          targetName: e.target.name,
          reason: e.reason,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffImmuneEvent', (e: BuffImmuneEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'buff_immune',
        data: {
          buffName: e.buff.name,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'HitCheckEvent', (e: HitCheckEvent) => {
      if (e.isDodged) {
        this._aggregator.addEntry({
          id: generateId(),
          type: 'dodge',
          data: { targetName: e.target.name },
          timestamp: Date.now(),
        });
      } else if (e.isResisted) {
        this._aggregator.addEntry({
          id: generateId(),
          type: 'resist',
          data: { targetName: e.target.name },
          timestamp: Date.now(),
        });
      }
    });

    this._addHandler(eventBus, 'SkillInterruptEvent', (e: SkillInterruptEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'skill_interrupt',
        data: {
          skillName: e.ability.name,
          reason: e.reason,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ManaBurnEvent', (e: ManaBurnEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'mana_burn',
        data: {
          value: Math.round(e.burnAmount),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'CooldownModifyEvent', (e: CooldownModifyEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'cooldown_modify',
        data: {
          value: e.cdModifyValue,
          affectedSkillName: e.affectedAbilityName,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ResourceDrainEvent', (e: ResourceDrainEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'resource_drain',
        data: {
          value: Math.round(e.amount),
          drainType: e.drainType,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ReflectEvent', (e: ReflectEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'reflect',
        data: {
          value: Math.round(e.reflectAmount),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'DispelEvent', (e: DispelEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'dispel',
        data: {
          buffs: e.removedBuffNames,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'TagTriggerEvent', (e: TagTriggerEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'tag_trigger',
        data: {
          tag: e.tag,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'DeathPreventEvent', (e: DeathPreventEvent) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'death_prevent',
        data: { targetName: e.target.name },
        timestamp: Date.now(),
      });
    });
  }

  unsubscribe(eventBus: EventBus): void {
    for (const [type, handler] of this._handlers) {
      eventBus.unsubscribe(type, handler);
    }
    this._handlers.clear();
  }
}

// 辅助函数
function generateId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

**关键点**：
- 只收集结构化数据，不生成 message
- data 字段严格按类型定义
- 击杀作为独立 entry 记录
- 所有现有事件类型都有对应处理

## LogPresenter 聚合逻辑

**职责**：将 Span 内的多个 Entry 聚合成一行人类可读的文案。

**迁移说明**：`LogPresenter` 是 `LogFormatter` 的重构版本，合并了 TextFormatter 和 JsonFormatter 的功能。

### 聚合规则

| 场景 | 输出示例 |
|------|----------|
| 普攻命中 | `张三发起攻击，对李四造成 100 点伤害` |
| 普攻暴击 | `张三发起攻击，对李四造成 150 点伤害（暴击！）` |
| 普攻+破盾 | `张三发起攻击，对李四造成 100 点伤害（抵扣护盾 50 点，护盾已破碎）` |
| 技能+Buff | `张三施放【火球术】，对李四造成 80 点伤害并施加「灼烧」` |
| 技能+击杀 | `张三施放【致命一击】，对李四造成 200 点伤害，李四被击败！` |
| 被闪避 | `张三施放【火球术】，被目标闪避了！` |
| DOT触发 | `【持续】李四身上的「毒」发作，造成 50 点伤害` |
| 纯治疗 | `张三施放【回春术】，为李四恢复 80 点气血` |
| 纯护盾 | `张三施放【护身诀】，为李四施加 100 点护盾` |
| 驱散 | `张三施放【净化术】，清除了李四身上的「灼烧」「中毒」` |
| 打断 | `张三施放【封魔击】，打断了李四的【火球术】` |
| 免死 | `张三施放【致命一击】，李四触发免死效果保住了性命！` |

### 多目标聚合策略

对于 AoE 技能（一个 Span 包含多个目标的 entries）：

**策略**：按目标分组聚合，每个目标一行

```typescript
// 示例：火球术命中两个目标
// 输出：
// "张三施放【火球术】，对李四造成 80 点伤害并施加「灼烧」"
// "张三施放【火球术】，对王五造成 60 点伤害"
```

**实现**：`formatAction` 检测多目标场景，调用 `formatActionForTarget` 为每个目标生成独立文案。

### 核心方法

```typescript
export class LogPresenter {
  formatSpan(span: LogSpan): string {
    // 空 Span 处理
    if (span.entries.length === 0) {
      return this.formatEmptySpan(span);
    }

    switch (span.type) {
      case 'battle_init':
        return this.formatBattleInit(span);
      case 'battle_end':
        return this.formatBattleEnd(span);
      case 'round_start':
        return `【第 ${span.turn} 回合】`;
      case 'action_pre':
        return this.formatActionPre(span);
      case 'action':
        return this.formatAction(span);
      default:
        return '';
    }
  }

  /**
   * 空 Span 处理
   * 结构性 Span（battle_init, round_start, battle_end）即使为空也显示
   * 其他空 Span 返回空字符串（将被过滤）
   */
  private formatEmptySpan(span: LogSpan): string {
    switch (span.type) {
      case 'battle_init':
        return '【战斗开始】';
      case 'battle_end':
        const winner = span.actor?.name ?? '未知';
        return `【战斗结束】${winner} 获胜！`;
      case 'round_start':
        return `【第 ${span.turn} 回合】`;
      default:
        return ''; // action_pre / action 无 entries 则不显示
    }
  }

  private formatBattleInit(span: LogSpan): string {
    // 从 entries 或其他方式获取对战信息
    return '【战斗开始】';
  }

  private formatBattleEnd(span: LogSpan): string {
    const winner = span.actor?.name ?? '未知';
    return `【战斗结束】${winner} 获胜！`;
  }

  /**
   * 主动行动聚合
   */
  private formatAction(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const ability = span.ability;
    const entries = span.entries;

    // 检测多目标场景
    const targets = this.extractTargets(entries);
    if (targets.length > 1) {
      return this.formatMultiTargetAction(span, actor, ability, targets);
    }

    return this.formatSingleTargetAction(span, actor, ability, entries);
  }

  /**
   * 单目标行动聚合
   */
  private formatSingleTargetAction(
    span: LogSpan,
    actor: string,
    ability: { id: string; name: string } | undefined,
    entries: LogEntry[]
  ): string {
    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');
    const shield = this.findEntry(entries, 'shield');
    const buffApply = this.findEntry(entries, 'buff_apply');
    const dodge = this.findEntry(entries, 'dodge');
    const resist = this.findEntry(entries, 'resist');
    const death = this.findEntry(entries, 'death');
    const dispel = this.findEntry(entries, 'dispel');
    const interrupt = this.findEntry(entries, 'skill_interrupt');
    const deathPrevent = this.findEntry(entries, 'death_prevent');
    const reflect = this.findEntry(entries, 'reflect');
    const manaBurn = this.findEntry(entries, 'mana_burn');
    const resourceDrain = this.findEntry(entries, 'resource_drain');
    const cooldownModify = this.findEntry(entries, 'cooldown_modify');
    const tagTrigger = this.findEntry(entries, 'tag_trigger');

    const isBasicAttack = ability?.id === 'basic_attack';
    const actionDesc = isBasicAttack ? '发起攻击' : `施放【${ability?.name}】`;

    // 1. 闪避/抵抗
    if (dodge || resist) {
      const reason = dodge ? '闪避' : '抵抗';
      return `${actor} ${actionDesc}，被目标${reason}了！`;
    }

    // 2. 技能打断
    if (interrupt) {
      return `${actor} ${actionDesc}，打断了目标的【${interrupt.data.skillName}】：${interrupt.data.reason}！`;
    }

    // 构建基础句子
    let result = `${actor} ${actionDesc}`;

    // 3. 伤害处理
    if (damage) {
      result += `，对 ${damage.data.targetName}`;
      result += ` 造成 ${damage.data.value} 点伤害`;

      if (damage.data.isCritical) result += '（暴击！）';

      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点`;
        if (damage.data.remainShield && damage.data.remainShield <= 0) {
          result += '，护盾已破碎';
        }
        result += '）';
      }

      if (buffApply && buffApply.data.targetName === damage.data.targetName) {
        result += `并施加「${buffApply.data.buffName}」`;
      }

      if (death) {
        result += `，${death.data.targetName}被击败！`;
      } else if (deathPrevent) {
        result += `，${deathPrevent.data.targetName}触发免死效果保住了性命！`;
      }
    }
    // 4. 纯治疗（无伤害）
    else if (heal) {
      result += `，为 ${heal.data.targetName} 恢复 ${heal.data.value} 点气血`;
    }

    // 5. 护盾
    if (shield && !damage) {
      result += `，为 ${shield.data.targetName} 施加 ${shield.data.value} 点护盾`;
    }

    // 6. 驱散
    if (dispel) {
      const buffsText = dispel.data.buffs.map(n => `「${n}」`).join('、');
      result += `，清除了 ${dispel.data.targetName} 身上的 ${buffsText}`;
    }

    // 7. 焚元
    if (manaBurn) {
      result += `，削减了 ${manaBurn.data.targetName} ${manaBurn.data.value} 点真元`;
    }

    // 8. 资源掠夺
    if (resourceDrain) {
      const typeText = resourceDrain.data.drainType === 'hp' ? '气血' : '真元';
      result += `，从 ${resourceDrain.data.targetName} 身上夺取了 ${resourceDrain.data.value} 点${typeText}`;
    }

    // 9. 反伤
    if (reflect) {
      result += `，反弹 ${reflect.data.value} 点伤害给 ${reflect.data.targetName}`;
    }

    // 10. 冷却修改
    if (cooldownModify) {
      const action = cooldownModify.data.value > 0 ? '增加' : '减少';
      result += `，使 ${cooldownModify.data.targetName} 的【${cooldownModify.data.affectedSkillName}】冷却${action}${Math.abs(cooldownModify.data.value)} 回合`;
    }

    // 11. 标签触发
    if (tagTrigger) {
      result += `，触发了 ${tagTrigger.data.targetName} 身上的「${tagTrigger.data.tag}」标记`;
    }

    return result;
  }

  /**
   * 多目标行动聚合
   * 为每个目标生成独立的一行文案
   */
  private formatMultiTargetAction(
    span: LogSpan,
    actor: string,
    ability: { id: string; name: string } | undefined,
    targets: string[]
  ): string {
    const lines: string[] = [];

    for (const target of targets) {
      const targetEntries = span.entries.filter(e => {
        const data = e.data as { targetName?: string };
        return data.targetName === target;
      });
      lines.push(this.formatSingleTargetAction(span, actor, ability, targetEntries));
    }

    return lines.join('\n');
  }

  /**
   * 提取所有目标
   */
  private extractTargets(entries: LogEntry[]): string[] {
    const targets = new Set<string>();
    for (const entry of entries) {
      const data = entry.data as { targetName?: string };
      if (data.targetName) {
        targets.add(data.targetName);
      }
    }
    return Array.from(targets);
  }

  /**
   * 持续效果聚合（DOT/HOT/护盾衰减等）
   */
  private formatActionPre(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const entries = span.entries;

    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');
    const shield = this.findEntry(entries, 'shield');
    const buffRemove = this.findEntry(entries, 'buff_remove');

    // DOT 伤害
    if (damage && damage.data.sourceBuff) {
      let result = `【持续】${actor}身上的「${damage.data.sourceBuff}」发作`;
      result += `，造成 ${damage.data.value} 点伤害`;

      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点）`;
      }

      if (damage.data.isLethal) {
        result += `，${actor}被击败！`;
      }

      return result;
    }

    // HOT 治疗
    if (heal) {
      return `【持续】${actor}身上的治疗效果生效，恢复 ${heal.data.value} 点气血`;
    }

    // Buff 过期
    if (buffRemove && buffRemove.data.reason === 'expired') {
      return `【持续】${actor}身上的「${buffRemove.data.buffName}」时效已过`;
    }

    return `${actor} 持续效果触发`;
  }

  // 辅助方法
  private findEntry<T extends LogEntryType>(
    entries: LogEntry[],
    type: T
  ): LogEntry<T> | undefined {
    return entries.find(e => e.type === type) as LogEntry<T> | undefined;
  }
}
```

## 多视图输出

### 玩家视图

```typescript
getPlayerView(spans: LogSpan[]): string[] {
  return spans
    .filter(span => span.entries.length > 0 || this._isStructuralSpan(span))
    .map(span => this.formatSpan(span))
    .filter(text => text.length > 0);
}

private _isStructuralSpan(span: LogSpan): boolean {
  return ['battle_init', 'round_start', 'battle_end'].includes(span.type);
}
```

### AI 视图

```typescript
interface CombatLogAIView {
  spans: Array<{
    turn: number;
    type: LogSpanType;
    actor?: { id: string; name: string };
    ability?: { id: string; name: string };
    entries: Array<{ type: LogEntryType; data: unknown }>;
    description: string; // 语义化描述，AI 可基于此润色
  }>;
  summary: CombatLogSummary;
}

interface CombatLogSummary {
  totalDamage: number;
  totalHeal: number;
  criticalCount: number;
  deaths: string[];
  turns: number;
}

getAIView(spans: LogSpan[]): CombatLogAIView {
  return {
    spans: spans.map(span => ({
      turn: span.turn,
      type: span.type,
      actor: span.actor,
      ability: span.ability,
      entries: span.entries.map(e => ({ type: e.type, data: e.data })),
      description: this.formatSpan(span),
    })),
    summary: this.generateSummary(spans),
  };
}

/**
 * 生成战斗统计摘要
 */
private generateSummary(spans: LogSpan[]): CombatLogSummary {
  let totalDamage = 0;
  let totalHeal = 0;
  let criticalCount = 0;
  const deaths: string[] = [];
  let maxTurn = 0;

  for (const span of spans) {
    maxTurn = Math.max(maxTurn, span.turn);

    for (const entry of span.entries) {
      if (entry.type === 'damage') {
        const data = entry.data as DamageEntryData;
        totalDamage += data.value;
        if (data.isCritical) criticalCount++;
      }
      if (entry.type === 'heal') {
        const data = entry.data as HealEntryData;
        totalHeal += data.value;
      }
      if (entry.type === 'death') {
        const data = entry.data as DeathEntryData;
        deaths.push(data.targetName);
      }
    }
  }

  return { totalDamage, totalHeal, criticalCount, deaths, turns: maxTurn };
}
```

### 调试视图

```typescript
getDebugView(spans: LogSpan[]): object {
  return {
    spans,
    eventCount: spans.reduce((sum, s) => sum + s.entries.length, 0),
    summary: this.generateSummary(spans),
  };
}
```

## CombatLogSystem 门面

```typescript
export class CombatLogSystem {
  private _collector: LogCollector;
  private _aggregator: LogAggregator;
  private _presenter: LogPresenter;

  constructor() {
    this._aggregator = new LogAggregator();
    this._collector = new LogCollector(this._aggregator);
    this._presenter = new LogPresenter();
  }

  // ===== 生命周期 =====
  subscribe(eventBus: EventBus): void {
    this._collector.subscribe(eventBus);
  }

  unsubscribe(eventBus: EventBus): void {
    this._collector.unsubscribe(eventBus);
  }

  clear(): void {
    this._aggregator.clear();
  }

  destroy(): void {
    this._collector.unsubscribe(EventBus.instance);
  }

  // ===== 新 API =====
  /**
   * 获取玩家视图（精简聚合）
   */
  getPlayerLogs(): string[] {
    return this._presenter.getPlayerView(this._aggregator.getSpans());
  }

  /**
   * 获取 AI 视图（结构化数据）
   */
  getAIData(): CombatLogAIView {
    return this._presenter.getAIView(this._aggregator.getSpans());
  }

  /**
   * 获取调试视图
   */
  getDebugData(): object {
    return this._presenter.getDebugView(this._aggregator.getSpans());
  }

  // ===== 兼容旧 API（逐步废弃） =====
  /** @deprecated 使用 getPlayerLogs() */
  getLogs(): CombatLog[] {
    // 转换为旧格式 CombatLog[]
    const logs: CombatLog[] = [];
    for (const span of this._aggregator.getSpans()) {
      if (span.entries.length === 0 && !this._isStructuralSpan(span)) continue;

      const message = this._presenter.formatSpan(span);
      if (!message) continue;

      logs.push({
        turn: span.turn,
        phase: this._mapSpanTypeToPhase(span.type),
        message,
        highlight: this._hasHighlightEntry(span),
      });
    }
    return logs;
  }

  /** @deprecated 使用 getPlayerLogs().join('\n') */
  generateReport(): string {
    return this.getPlayerLogs().join('\n');
  }

  private _isStructuralSpan(span: LogSpan): boolean {
    return ['battle_init', 'round_start', 'battle_end'].includes(span.type);
  }

  private _mapSpanTypeToPhase(type: LogSpanType): CombatPhase {
    const mapping: Record<LogSpanType, CombatPhase> = {
      battle_init: CombatPhase.INIT,
      round_start: CombatPhase.ROUND_START,
      action_pre: CombatPhase.ROUND_PRE,
      action: CombatPhase.ACTION,
      battle_end: CombatPhase.END,
    };
    return mapping[type] ?? CombatPhase.ROUND_PRE;
  }

  private _hasHighlightEntry(span: LogSpan): boolean {
    return span.entries.some(e =>
      ['death', 'death_prevent', 'skill_interrupt'].includes(e.type) ||
      (e.type === 'damage' && (e.data as DamageEntryData).isCritical)
    );
  }
}
```

## LogAggregator 改进

现有 `LogAggregator` 需要小幅改进：

```typescript
export class LogAggregator {
  private _spans: LogSpan[] = [];
  private _activeSpan: LogSpan | null = null;
  private _turn: number = 0;
  private _spanCounter: number = 0;

  /**
   * 获取当前回合数（供 LogCollector 使用）
   */
  get currentTurn(): number {
    return this._turn;
  }

  beginSpan(
    type: LogSpanType,
    options: {
      turn: number;
      actor?: { id: string; name: string };
      ability?: { id: string; name: string };
    }
  ): void {
    // 自动结束前一个 Span
    this.endSpan();

    this._turn = options.turn;

    const span: LogSpan = {
      id: `span_${++this._spanCounter}_${Date.now()}`,
      type,
      turn: options.turn,
      actor: options.actor,
      ability: options.ability,
      entries: [],
      timestamp: Date.now(),
    };

    this._spans.push(span);
    this._activeSpan = span;
  }

  addEntry(entry: LogEntry): void {
    if (!this._activeSpan) {
      console.warn('[LogAggregator] No active span, entry dropped:', entry.type);
      return;
    }
    this._activeSpan.entries.push(entry);
  }

  endSpan(): void {
    this._activeSpan = null;
  }

  getSpans(): LogSpan[] {
    return [...this._spans];
  }

  clear(): void {
    this._spans = [];
    this._activeSpan = null;
    this._turn = 0;
    this._spanCounter = 0;
  }
}
```

## 测试策略

### 测试文件结构

```
engine/battle-v5/tests/systems/log/
├── LogCollector.test.ts      # 数据收集测试
├── LogAggregator.test.ts     # Span分组测试
├── LogPresenter.test.ts      # 聚合逻辑测试
└── integration/
    └── FullLogFlow.test.ts   # 端到端测试
```

### 测试覆盖

1. **LogCollector 测试**
   - 各类型事件正确转换为 LogEntry
   - data 字段类型正确
   - 不生成 message
   - 所有事件类型都有对应处理

2. **LogAggregator 测试**
   - Span 正确开启/关闭
   - Entry 正确归属到当前 Span
   - 空白 Span 处理
   - currentTurn getter 正确

3. **LogPresenter 测试**
   - 各种场景的聚合输出正确（见聚合规则表）
   - 边界情况：空 Span、无伤害、纯治疗等
   - 三种视图输出格式正确
   - 多目标场景正确处理

4. **集成测试**
   - 完整战斗流程日志输出
   - 验证"一次行动一行"的聚合效果

## 改动清单

| 文件 | 操作 | 改动量 | 说明 |
|------|------|--------|------|
| `types.ts` | 重写 | 中 | 移除 message/highlight，添加强类型 |
| `LogCollector.ts` | 新增 | 大 | 替代 LogSubscriber |
| `LogAggregator.ts` | 重构 | 中 | 添加 currentTurn，调整字段命名 |
| `LogPresenter.ts` | 新增 | 大 | 替代 LogFormatter，完整聚合逻辑 |
| `CombatLogSystem.ts` | 简化 | 小 | 协调新组件 |
| `LogSubscriber.ts` | 删除 | - | 被 LogCollector 替代 |
| `LogFormatter.ts` | 删除 | - | 被 LogPresenter 替代 |

## 设计亮点

1. **类型安全**：判别联合替代 any，移除 message/highlight
2. **职责分离**：收集/分组/呈现 各司其职
3. **单行聚合**：一次行动 = 一行文案
4. **多视图输出**：玩家/AI/调试 三种视图
5. **向后兼容**：旧 API 标记 deprecated
6. **完整覆盖**：所有事件类型都有处理
7. **多目标支持**：AoE 技能按目标分组输出

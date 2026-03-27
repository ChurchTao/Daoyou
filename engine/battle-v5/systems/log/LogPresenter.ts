import {
  LogSpan,
  LogEntry,
  LogEntryType,
  LogSpanType,
  CombatLogSummary,
  CombatLogAIView,
  DamageEntryData,
} from './types';

/**
 * LogPresenter 职责：将 Span 聚合为人类可读的输出。
 * 核心改进：一次行动一行，信息完备。
 */
export class LogPresenter {
  /**
   * 格式化单个 Span 为单行输出
   */
  formatSpan(span: LogSpan): string {
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

  private formatEmptySpan(span: LogSpan): string {
    switch (span.type) {
      case 'battle_init':
        return '【战斗开始】';
      case 'battle_end':
        const winner = span.actor?.name ?? '未知';
        return `【战斗结束】${winner} 获胜!`;
      case 'round_start':
        return `【第 ${span.turn} 回合】`;
      default:
        return '';
    }
  }

  private formatBattleInit(span: LogSpan): string {
    return '【战斗开始】';
  }

  private formatBattleEnd(span: LogSpan): string {
    const winner = span.actor?.name ?? '未知';
    return `【战斗结束】${winner} 获胜!`;
  }

  private formatAction(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const ability = span.ability;
    const entries = span.entries;

    const targets = this.extractTargets(entries);
    if (targets.length > 1) {
      return this.formatMultiTargetAction(span, actor, ability, targets);
    }
    return this.formatSingleTargetAction(span, actor, ability, entries);
  }

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

    // 情况 1: 闪避/抵抗
    if (dodge || resist) {
      const reason = dodge ? '闪避' : '抵抗';
      return `${actor}${actionDesc}，被目标${reason}了！`;
    }

    // 情况 2: 技能打断
    if (interrupt) {
      return `${actor}${actionDesc}，打断了目标的【${interrupt.data.skillName}】：${interrupt.data.reason}！`;
    }

    let result = `${actor}${actionDesc}`;

    // 情况 3: 伤害 + Buff + 死亡
    if (damage) {
      result += `，对 ${damage.data.targetName}`;
      result += ` 造成 ${damage.data.value} 点伤害`;

      if (damage.data.isCritical) {
        result += '（暴击！）';
      }

      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点`;
        // remainShield 为 0 表示护盾完全消耗（破碎）
        if (damage.data.remainShield === 0) {
          result += '，护盾已破碎';
        }
        result += '）';
      }

      // 同时施加 Buff
      if (buffApply && buffApply.data.targetName === damage.data.targetName) {
        result += `并施加「${buffApply.data.buffName}」`;
      }

      // 死亡或免死
      if (death) {
        result += `，${death.data.targetName}被击败!`;
      } else if (deathPrevent) {
        result += `，${deathPrevent.data.targetName}触发免死效果保住了性命!`;
      }
    } else if (heal) {
      // 情况 4: 治疗
      result += `，为 ${heal.data.targetName} 恢复 ${heal.data.value} 点气血`;
    }

    // 情况 5: 护盾（无伤害时）
    if (shield && !damage) {
      result += `，为 ${shield.data.targetName} 施加 ${shield.data.value} 点护盾`;
    }

    // 情况 6: 驱散
    if (dispel) {
      const buffsText = dispel.data.buffs.map((n) => `「${n}」`).join('、');
      result += `，清除了 ${dispel.data.targetName} 身上的 ${buffsText}`;
    }

    // 情况 7: 焚元
    if (manaBurn) {
      result += `，削减了 ${manaBurn.data.targetName} ${manaBurn.data.value} 点真元`;
    }

    // 情况 8: 掠夺
    if (resourceDrain) {
      const typeText = resourceDrain.data.drainType === 'hp' ? '气血' : '真元';
      result += `，从 ${resourceDrain.data.targetName} 身上夺取了 ${resourceDrain.data.value} 点${typeText}`;
    }

    // 情况 9: 反伤
    if (reflect) {
      result += `，反弹 ${reflect.data.value} 点伤害给 ${reflect.data.targetName}`;
    }

    // 情况 10: 冷却修改
    if (cooldownModify) {
      const action = cooldownModify.data.value > 0 ? '增加' : '减少';
      result += `，使 ${cooldownModify.data.targetName} 的【${cooldownModify.data.affectedSkillName}】冷却${action}${Math.abs(cooldownModify.data.value)} 回合`;
    }

    // 情况 11: 标签触发
    if (tagTrigger) {
      result += `，触发了 ${tagTrigger.data.targetName} 身上的「${tagTrigger.data.tag}」标记`;
    }

    return result;
  }

  private formatMultiTargetAction(
    span: LogSpan,
    actor: string,
    ability: { id: string; name: string } | undefined,
    targets: string[]
  ): string {
    const lines: string[] = [];
    for (const target of targets) {
      const targetEntries = span.entries.filter((e) => {
        const data = e.data as { targetName?: string };
        return data.targetName === target;
      });
      lines.push(this.formatSingleTargetAction(span, actor, ability, targetEntries));
    }
    return lines.join('\n');
  }

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

  private formatActionPre(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const entries = span.entries;

    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');
    const buffRemove = this.findEntry(entries, 'buff_remove');

    // DOT 伤害
    if (damage && damage.data.sourceBuff) {
      let result = `【持续】${actor}身上的「${damage.data.sourceBuff}」发作`;
      result += `，造成 ${damage.data.value} 点伤害`;

      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点）`;
      }

      const death = this.findEntry(span.entries, 'death');
      if (death && death.data.targetName === actor) {
        result += `，${actor}被击败!`;
      }
      return result;
    }

    // HOT 治疗
    if (heal && heal.data.sourceBuff) {
      return `【持续】${actor}身上的「${heal.data.sourceBuff}」生效，恢复 ${heal.data.value} 点气血`;
    }

    // Buff 过期
    if (buffRemove && buffRemove.data.reason === 'expired') {
      return `【持续】${actor}身上的「${buffRemove.data.buffName}」时效已过`;
    }

    return `${actor} 持续效果触发`;
  }

  private findEntry<T extends LogEntryType>(
    entries: LogEntry[],
    type: T
  ): LogEntry<T> | undefined {
    return entries.find((e) => e.type === type) as LogEntry<T> | undefined;
  }

  /**
   * 获取玩家视图（过滤空 Span）
   */
  getPlayerView(spans: LogSpan[]): string[] {
    return spans
      .filter((span) => span.entries.length > 0 || this._isStructuralSpan(span))
      .map((span) => this.formatSpan(span))
      .filter((text) => text.length > 0);
  }

  private _isStructuralSpan(span: LogSpan): boolean {
    return ['battle_init', 'round_start', 'battle_end'].includes(span.type);
  }

  /**
   * 获取 AI 视图（结构化数据 + 描述）
   */
  getAIView(spans: LogSpan[]): CombatLogAIView {
    return {
      spans: spans.map((span) => ({
        turn: span.turn,
        type: span.type,
        actor: span.actor,
        ability: span.ability,
        entries: span.entries.map((e) => ({ type: e.type, data: e.data })),
        description: this.formatSpan(span),
      })),
      summary: this.generateSummary(spans),
    };
  }

  /**
   * 获取调试视图
   */
  getDebugView(spans: LogSpan[]): object {
    return {
      spans,
      eventCount: spans.reduce((sum, s) => sum + s.entries.length, 0),
      summary: this.generateSummary(spans),
    };
  }

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
          const data = entry.data as { value: number };
          totalHeal += data.value;
        }
        if (entry.type === 'death') {
          const data = entry.data as { targetName: string };
          deaths.push(data.targetName);
        }
      }
    }

    return { totalDamage, totalHeal, criticalCount, deaths, turns: maxTurn };
  }
}

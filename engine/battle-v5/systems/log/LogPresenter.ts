import {
  CombatLogAIView,
  CombatLogSummary,
  DamageEntryData,
  LogEntry,
  LogEntryType,
  LogSpan,
} from './types';

/**
 * LogPresenter 职责：将 Span 聚合为人类可读的输出。
 * 核心改进：一次行动一行，信息完备。
 */
export class LogPresenter {
  private readonly _numberFormatter = new Intl.NumberFormat('en-US');

  /**
   * 格式化单个 Span 为单行输出
   */
  formatSpan(span: LogSpan): string {
    if (span.entries.length === 0) {
      return this.formatEmptySpan(span);
    }

    switch (span.type) {
      case 'battle_init':
        return this.formatBattleInit();
      case 'battle_end':
        return this.formatBattleEnd(span);
      case 'round_start':
        return `【第 ${span.turn} 回合】`;
      case 'action_pre':
        return this.formatActionPre(span);
      case 'action':
        return this.formatAction(span);
      case 'action_after':
        return this.formatActionAfter(span);
      default:
        return '';
    }
  }

  private formatEmptySpan(span: LogSpan): string {
    switch (span.type) {
      case 'battle_init':
        return '【战斗开始】';
      case 'battle_end':
        const winner = this.formatName(span.actor?.name ?? '未知');
        return `【战斗结束】${winner} 获胜！`;
      case 'round_start':
        return `【第 ${span.turn} 回合】`;
      case 'action_after':
        return '';
      default:
        return '';
    }
  }

  private formatBattleInit(): string {
    return '【战斗开始】';
  }

  private formatBattleEnd(span: LogSpan): string {
    const winner = this.formatName(span.actor?.name ?? '未知');
    return `【战斗结束】${winner} 获胜！`;
  }

  private formatAction(span: LogSpan): string {
    const actor = this.formatName(span.actor?.name ?? '未知');
    const ability = span.ability;
    const entries = span.entries;

    const targets = this.extractDisplayTargets(entries);
    let mainOutput: string;
    if (targets.length === 1) {
      mainOutput = this.formatSingleTargetAction(
        span,
        actor,
        ability,
        this.getEntriesForTarget(entries, targets[0]),
      );
    } else if (targets.length > 1) {
      mainOutput = this.formatMultiTargetAction(span, actor, ability, targets);
    } else {
      mainOutput = this.formatSingleTargetAction(span, actor, ability, entries);
    }

    return mainOutput;
  }

  private formatActionAfter(span: LogSpan): string {
    const expiredEntries = this.findEntries(span.entries, 'buff_remove').filter(
      (e) => e.data.reason === 'expired',
    );
    if (expiredEntries.length === 0) return '';

    // processBuffs 只处理当前行动者的 buff，所有过期条目实质属于同一单位
    const targetName = this.formatName(expiredEntries[0].data.targetName);
    const buffNames = this.formatQuotedList(expiredEntries.map((e) => e.data.buffName));
    return `【持续】${targetName}身上的${buffNames}时效已过`;
  }

  private formatSingleTargetAction(
    span: LogSpan,
    actor: string,
    ability: { id: string; name: string } | undefined,
    entries: LogEntry[],
  ): string {
    const damageEntries = this.findEntries(entries, 'damage');
    const directDamageEntries = damageEntries.filter(
      (entry) => entry.data.damageSource !== 'reflect',
    );
    const reflectDamageEntries = damageEntries.filter(
      (entry) => entry.data.damageSource === 'reflect',
    );
    const healEntries = this.findEntries(entries, 'heal');
    const shieldEntries = this.findEntries(entries, 'shield');
    const buffApplies = this.findEntries(entries, 'buff_apply');
    const dodge = this.findEntry(entries, 'dodge');
    const resist = this.findEntry(entries, 'resist');
    const death = this.findEntry(entries, 'death');
    const dispels = this.findEntries(entries, 'dispel');
    const interrupt = this.findEntry(entries, 'skill_interrupt');
    const deathPrevent = this.findEntry(entries, 'death_prevent');
    const manaBurns = this.findEntries(entries, 'mana_burn');
    const resourceDrains = this.findEntries(entries, 'resource_drain');
    const cooldownModifies = this.findEntries(entries, 'cooldown_modify');
    const tagTriggers = this.findEntries(entries, 'tag_trigger');

    const isBasicAttack = ability?.id === 'basic_attack';
    const actionDesc = isBasicAttack
      ? '发起攻击'
      : `施放${this.formatSkill(ability?.name ?? '未知技能')}`;

    // 情况 1: 闪避/抵抗
    if (dodge || resist) {
      const targetName = this.formatName(
        dodge?.data.targetName ?? resist?.data.targetName ?? '目标',
      );
      const reason = dodge ? '闪避' : '抵抗';
      return `${actor}${actionDesc}，被${targetName}${reason}了！`;
    }

    // 情况 2: 技能打断
    if (interrupt) {
      return `${actor}${actionDesc}，打断了${this.formatName(interrupt.data.targetName)}的${this.formatSkill(interrupt.data.skillName)}！`;
    }

    const resultParts: string[] = [];

    const damageTotal = directDamageEntries.reduce(
      (sum, e) => sum + e.data.value,
      0,
    );
    const totalShieldAbsorbed = directDamageEntries.reduce(
      (sum, e) => sum + (e.data.shieldAbsorbed ?? 0),
      0,
    );
    const hasCritical = directDamageEntries.some((e) => e.data.isCritical);
    const shieldBroken = directDamageEntries.some(
      (e) => (e.data.shieldAbsorbed ?? 0) > 0 && e.data.remainShield === 0,
    );
    const primaryTarget =
      directDamageEntries[0]?.data.targetName ??
      healEntries[0]?.data.targetName ??
      shieldEntries[0]?.data.targetName ??
      buffApplies[0]?.data.targetName ??
      dispels[0]?.data.targetName ??
      manaBurns[0]?.data.targetName ??
      resourceDrains[0]?.data.targetName ??
      cooldownModifies[0]?.data.targetName ??
      tagTriggers[0]?.data.targetName;

    // 情况 3: 伤害 + Buff + 死亡
    if ((directDamageEntries.length > 0 || totalShieldAbsorbed > 0) && primaryTarget) {
      const formattedPrimaryTarget = this.formatName(primaryTarget);
      let damageText = `对${formattedPrimaryTarget}造成 ${this.formatNumber(damageTotal)} 点伤害`;

      if (hasCritical) {
        damageText += '（暴击）！';
      }

      if (totalShieldAbsorbed > 0) {
        damageText += `（抵扣护盾 ${this.formatNumber(
          Math.round(totalShieldAbsorbed),
        )} 点`;
        if (shieldBroken) {
          damageText += '，护盾已破碎';
        }
        damageText += '）';
      }

      const appliedOnPrimary = buffApplies.filter(
        (e) => e.data.targetName === primaryTarget,
      );
      if (appliedOnPrimary.length > 0) {
        damageText += `并施加${this.formatBuffApplyList(appliedOnPrimary)}`;
      }

      resultParts.push(damageText);

      // 免死优先于击杀
      if (deathPrevent) {
        resultParts.push(
          `${this.formatName(deathPrevent.data.targetName)}触发免死效果，保住了性命！`,
        );
      } else if (death) {
        resultParts.push(`${this.formatName(death.data.targetName)}被击败！`);
      }
    } else {
      const healTotal = healEntries.reduce((sum, e) => sum + e.data.value, 0);
      const shieldTotal = shieldEntries.reduce((sum, e) => sum + e.data.value, 0);

      // 情况 4: 治疗
      if (healTotal > 0 && healEntries[0]) {
        resultParts.push(
          `为${this.formatName(healEntries[0].data.targetName)}恢复 ${this.formatNumber(healTotal)} 点气血`,
        );
      }

      // 情况 5: 护盾（无伤害时）
      if (shieldTotal > 0 && shieldEntries[0]) {
        resultParts.push(
          `为${this.formatName(shieldEntries[0].data.targetName)}施加 ${this.formatNumber(shieldTotal)} 点护盾`,
        );
      }

      // 情况 3.5: 纯 Buff
      if (buffApplies.length > 0 && buffApplies[0]) {
        resultParts.push(
          `对${this.formatName(buffApplies[0].data.targetName)}施加${this.formatBuffApplyList(buffApplies)}`,
        );
      }
    }

    // 情况 6: 驱散
    for (const dispel of dispels) {
      const buffsText = this.formatQuotedList(dispel.data.buffs);
      resultParts.push(
        `清除了${this.formatName(dispel.data.targetName)}身上的${buffsText}`,
      );
    }

    // 情况 7: 焚元
    for (const manaBurn of manaBurns) {
      resultParts.push(
        `削减了${this.formatName(manaBurn.data.targetName)} ${this.formatNumber(manaBurn.data.value)} 点真元`,
      );
    }

    // 情况 8: 掠夺
    for (const resourceDrain of resourceDrains) {
      const typeText = resourceDrain.data.drainType === 'hp' ? '气血' : '真元';
      resultParts.push(
        `从${this.formatName(resourceDrain.data.targetName)}身上夺取了 ${this.formatNumber(resourceDrain.data.value)} 点${typeText}`,
      );
    }

    // 情况 9: 反伤
    for (const reflect of reflectDamageEntries) {
      resultParts.push(
        `反弹 ${this.formatNumber(reflect.data.value)} 点伤害给${this.formatName(reflect.data.targetName)}`,
      );
    }

    // 情况 10: 冷却修改
    for (const cooldownModify of cooldownModifies) {
      const action = cooldownModify.data.value > 0 ? '增加' : '减少';
      resultParts.push(
        `使${this.formatName(cooldownModify.data.targetName)}的${this.formatSkill(cooldownModify.data.affectedSkillName)}冷却${action}${this.formatNumber(Math.abs(cooldownModify.data.value))}回合`,
      );
    }

    // 情况 11: 标签触发
    for (const tagTrigger of tagTriggers) {
      resultParts.push(
        `触发了${this.formatName(tagTrigger.data.targetName)}身上的「${tagTrigger.data.tag}」标记`,
      );
    }

    if (resultParts.length === 0) {
      return `${actor}${actionDesc}`;
    }

    return `${actor}${actionDesc}，${resultParts.join('，')}`;
  }

  private formatMultiTargetAction(
    span: LogSpan,
    actor: string,
    ability: { id: string; name: string } | undefined,
    targets: string[],
  ): string {
    const lines: string[] = [];
    for (const target of targets) {
      const targetEntries = this.getEntriesForTarget(span.entries, target);
      if (targetEntries.length === 0) {
        continue;
      }
      lines.push(
        this.formatSingleTargetAction(span, actor, ability, targetEntries),
      );
    }
    return lines.join('\n');
  }

  private extractDisplayTargets(entries: LogEntry[]): string[] {
    const targets = new Set<string>();
    const fallbackTargets = new Set<string>();
    const targetEntryTypes: LogEntryType[] = [
      'damage',
      'heal',
      'shield',
      'buff_apply',
      'dodge',
      'resist',
      'death',
      'mana_burn',
      'resource_drain',
      'dispel',
      'tag_trigger',
      'death_prevent',
      'skill_interrupt',
      'cooldown_modify',
    ];

    for (const entry of entries) {
      const data = entry.data as {
        targetName?: string;
        damageSource?: 'direct' | 'reflect';
      };

      if (!data.targetName) {
        continue;
      }

      fallbackTargets.add(data.targetName);

      if (!targetEntryTypes.includes(entry.type)) {
        continue;
      }

      if (entry.type === 'damage' && data.damageSource === 'reflect') {
        continue;
      }

      targets.add(data.targetName);
    }

    return targets.size > 0 ? Array.from(targets) : Array.from(fallbackTargets);
  }

  private getEntriesForTarget(entries: LogEntry[], target: string): LogEntry[] {
    return entries.filter((entry) => {
      const data = entry.data as {
        targetName?: string;
        damageSource?: 'direct' | 'reflect';
        reflectSourceName?: string;
      };

      if (entry.type === 'damage' && data.damageSource === 'reflect') {
        return data.reflectSourceName === target;
      }

      return data.targetName === target;
    });
  }

  private formatActionPre(span: LogSpan): string {
    const actorName = span.actor?.name ?? '未知';
    const actor = this.formatName(actorName);
    const entries = span.entries;

    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');

    // DOT 伤害
    if (damage && damage.data.sourceBuff) {
      let result = `【持续】${actor}身上的「${damage.data.sourceBuff}」发作`;
      result += `，造成 ${this.formatNumber(damage.data.value)} 点伤害`;

      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${this.formatNumber(Math.round(damage.data.shieldAbsorbed))} 点）`;
      }

      const death = this.findEntry(span.entries, 'death');
      if (death && death.data.targetName === actorName) {
        result += `，${actor}被击败！`;
      }
      return result;
    }

    // HOT 治疗
    if (heal && heal.data.sourceBuff) {
      return `【持续】${actor}身上的「${heal.data.sourceBuff}」生效，恢复 ${this.formatNumber(heal.data.value)} 点气血`;
    }

    return `${actor} 持续效果触发`;
  }

  private findEntry<T extends LogEntryType>(
    entries: LogEntry[],
    type: T,
  ): LogEntry<T> | undefined {
    return entries.find((e) => e.type === type) as LogEntry<T> | undefined;
  }

  private findEntries<T extends LogEntryType>(
    entries: LogEntry[],
    type: T,
  ): LogEntry<T>[] {
    return entries.filter((e) => e.type === type) as LogEntry<T>[];
  }

  private formatBuffApplyList(
    buffApplies: Array<LogEntry<'buff_apply'>>,
  ): string {
    return buffApplies
      .map((entry) => {
        const durationText = this.formatDuration(entry.data.duration);
        const layerText = this.formatBuffLayer(entry.data.layers);
        return `「${entry.data.buffName}」${layerText}${durationText}`;
      })
      .join('、');
  }

  private formatBuffLayer(layers?: number): string {
    if (!layers || layers <= 1) {
      return '';
    }
    return `×${this.formatNumber(layers)}`;
  }

  private formatDuration(duration: number): string {
    if (duration < 0) {
      return '（永久）';
    }
    return `（${duration} 回合）`;
  }

  private formatQuotedList(items: string[]): string {
    return items.map((item) => `「${item}」`).join('、');
  }

  private formatName(name: string): string {
    return `「${name}」`;
  }

  private formatSkill(name: string): string {
    return `《${name}》`;
  }

  private formatNumber(value: number): string {
    return this._numberFormatter.format(value);
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

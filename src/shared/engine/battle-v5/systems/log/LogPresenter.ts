import {
  CombatLogAIView,
  CombatLogSummary,
  DamageEntryData,
  LogEntry,
  LogEntryType,
  LogSourceRef,
  LogSpan,
  PresentedLogLine,
  PresentedLogPart,
} from './types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { getResourceText } from '@shared/lib/gameConceptDisplay';

/**
 * 控制标签 → 战报状态描述（基于行动完全被压制的场景）
 * 仅处理 ControlledSkipEvent 可携带的标签（NO_ACTION / STUNNED）
 */
const CONTROL_TAG_DESC: Readonly<Record<string, string>> = {
  [GameplayTags.STATUS.CONTROL.STUNNED]:   '陷入眩晕',
  [GameplayTags.STATUS.CONTROL.NO_ACTION]: '失去行动力',
};

function getControlDesc(tag: string): string {
  return CONTROL_TAG_DESC[tag] ?? '受控制效果压制';
}

/**
 * LogPresenter 职责：将 Span 聚合为人类可读的输出。
 * 核心改进：一次行动一行，信息完备。
 */
export class LogPresenter {
  private readonly _numberFormatter = new Intl.NumberFormat('en-US');

  /**
   * 格式化单个 Span 为单行输出
   */
  formatSpan(span: LogSpan): string[] {
    return this.presentSpan(span).map((line) =>
      line.parts.map((part) => part.text).join(''),
    );
  }

  presentSpan(span: LogSpan): PresentedLogLine[] {
    if (span.type === 'action') {
      return this.presentAction(span);
    }
    return this.formatSpanText(span).map((line) => ({
      role: this.roleForSpan(span),
      parts: [{ kind: 'text', text: line }],
    }));
  }

  private presentAction(span: LogSpan): PresentedLogLine[] {
    const actorName = span.actor?.name ?? '未知';
    const actionPrefix = this.actionPrefixParts(actorName, span.ability);
    const visibleEntries = span.entries.filter((entry) => {
      if (entry.type !== 'buff_apply' && entry.type !== 'mechanic') return true;
      return (entry.data as { visibility?: 'player' | 'debug' }).visibility !== 'debug';
    });
    const resourceEntries = this.findEntries(visibleEntries, 'resource_change')
      .filter((entry) => !entry.data.isInitial);
    const actionStateEntries = this.findEntries(visibleEntries, 'action_state');
    const secondaryDamage = this.findEntries(visibleEntries, 'damage').filter(
      (entry) =>
        entry.data.damageSource === 'follow_up' ||
        entry.data.damageSource === 'counter' ||
        entry.data.damageSource === 'reflect' ||
        (entry.data.damageSource === 'delayed' && Boolean(entry.data.cause)),
    );
    const secondaryDamageIds = new Set(secondaryDamage.map((entry) => entry.id));
    const namedTriggers = this.findEntries(visibleEntries, 'mechanic').filter(
      (entry) => entry.data.mechanic === 'named_trigger',
    );
    const statusTransitions = this.findEntries(visibleEntries, 'mechanic').filter(
      (entry) => entry.data.mechanic === 'status_transition',
    );
    const standaloneMechanicIds = new Set(
      [...namedTriggers, ...statusTransitions].map((entry) => entry.id),
    );
    const outcomeEntries = visibleEntries.filter((entry) =>
      entry.type !== 'resource_change' &&
      entry.type !== 'action_state' &&
      !standaloneMechanicIds.has(entry.id) &&
      !(entry.type === 'damage' && secondaryDamageIds.has(entry.id)) &&
      !this.isZeroOutcome(entry),
    );
    const triggerEntries = outcomeEntries.filter((entry) =>
      this.isTriggeredOutcome(entry, span),
    );
    const primaryEntries = outcomeEntries.filter(
      (entry) => !triggerEntries.includes(entry),
    );
    const targets = this.extractPrimaryTargets(primaryEntries);
    const lines: PresentedLogLine[] = [];

    if (targets.length === 1) {
      const targetLines = this.presentTargetOutcomes(
        primaryEntries.filter((entry) => this.entryBelongsToTarget(entry, targets[0])),
        targets[0],
      );
      if (targetLines.length > 0) {
        targetLines[0] = {
          ...targetLines[0],
          role: 'primary',
          parts: [...actionPrefix, this.textPart('，'), ...targetLines[0].parts],
        };
        lines.push(...targetLines);
      } else {
        lines.push(this.line('primary', ...actionPrefix));
      }
    } else if (targets.length > 1) {
      lines.push(this.line('header', ...actionPrefix, this.textPart('：')));
      for (const target of targets) {
        lines.push(
          ...this.presentTargetOutcomes(
            primaryEntries.filter((entry) => this.entryBelongsToTarget(entry, target)),
            target,
          ),
        );
      }
    } else {
      lines.push(this.line('primary', ...actionPrefix));
    }

    for (const mechanic of namedTriggers) {
      lines.push(
        this.line('trigger', this.textPart(this.formatMechanic(mechanic))),
      );
    }
    lines.push(...this.presentTriggerOutcomes(triggerEntries, actorName));
    lines.push(...this.presentSecondaryDamage(secondaryDamage));
    for (const mechanic of statusTransitions) {
      lines.push(
        this.line('trigger', this.textPart(this.formatMechanic(mechanic))),
      );
    }
    for (const entry of resourceEntries) {
      lines.push(this.resourceChangeLine(entry));
    }
    for (const entry of actionStateEntries) {
      const stateLine = this.actionStateLine(entry, false);
      if (stateLine) lines.push(stateLine);
    }

    return lines.filter((line) => line.parts.length > 0);
  }

  private presentTargetOutcomes(
    entries: LogEntry[],
    targetName: string,
  ): PresentedLogLine[] {
    const lines: PresentedLogLine[] = [];
    const directDamage = this.findEntries(entries, 'damage').filter(
      (entry) => !entry.data.damageSource || entry.data.damageSource === 'direct',
    );
    const buffs = this.findEntries(entries, 'buff_apply').filter(
      (entry) => entry.data.visibility !== 'debug',
    );
    const damageImmune = this.findEntries(entries, 'damage_immune');
    const buffImmune = this.findEntries(entries, 'buff_immune');
    const deathPrevent = this.findEntry(entries, 'death_prevent');
    const death = this.findEntry(entries, 'death');
    const manaShield = this.findEntries(entries, 'mana_shield_absorb');
    const resist = this.findEntries(entries, 'resist');
    const dodge = this.findEntry(entries, 'dodge');
    const interrupt = this.findEntry(entries, 'skill_interrupt');

    if (dodge) {
      return [this.line(
        'primary',
        this.textPart('被'),
        this.unitPart(targetName),
        this.textPart('闪避了！'),
      )];
    }
    if (interrupt) {
      return [this.line(
        'primary',
        this.textPart('打断了'),
        this.unitPart(interrupt.data.targetName),
        this.textPart('的'),
        this.abilityPart(interrupt.data.skillName),
        this.textPart('！'),
      )];
    }
    if (resist.length > 0 && entries.every((entry) => entry.type === 'resist')) {
      return [this.line(
        'primary',
        this.textPart('被'),
        this.unitPart(targetName),
        this.textPart('抵抗了！'),
      )];
    }

    if (directDamage.length > 1) {
      lines.push(this.line(
        'primary',
        this.textPart('对'),
        this.unitPart(targetName),
        this.textPart(`连续命中${directDamage.length}段：`),
      ));
      const detailParts: PresentedLogPart[] = [];
      directDamage.forEach((entry, index) => {
        if (index > 0) detailParts.push(this.textPart('、'));
        detailParts.push(...this.damageSegmentParts(entry));
      });
      const totalDamage = directDamage.reduce((sum, entry) => sum + entry.data.value, 0);
      detailParts.push(
        this.textPart('，合计'),
        this.numberPart(totalDamage),
        this.textPart('点气血伤害'),
      );
      const totalShield = directDamage.reduce(
        (sum, entry) => sum + (entry.data.shieldAbsorbed ?? 0),
        0,
      );
      if (totalShield > 0) {
        detailParts.push(
          this.textPart('，护盾共吸收'),
          this.numberPart(Math.round(totalShield)),
          this.textPart('点'),
        );
      }
      this.appendDamageResultParts(detailParts, targetName, buffs, deathPrevent, death);
      lines.push(this.line('primary', ...detailParts));
    } else if (directDamage.length === 1 || damageImmune.length > 0) {
      const damage = directDamage[0];
      const parts: PresentedLogPart[] = [
        this.textPart('对'),
        this.unitPart(targetName),
        this.textPart('造成 '),
        this.numberPart(damage?.data.value ?? 0),
        this.textPart(' 点伤害'),
      ];
      if (damage?.data.isCritical) {
        parts.push(this.textPart('（'), this.criticalPart(), this.textPart('）！'));
      }
      const absorbed = damage?.data.shieldAbsorbed ?? 0;
      if (absorbed > 0) {
        parts.push(
          this.textPart('（抵扣护盾 '),
          this.numberPart(Math.round(absorbed)),
          this.textPart(damage?.data.remainShield === 0 ? ' 点，护盾已破碎）' : ' 点）'),
        );
      }
      this.appendDamageResultParts(parts, targetName, buffs, deathPrevent, death);
      if (damageImmune.length > 0) {
        parts.push(
          this.textPart('，'),
          this.unitPart(targetName),
          this.textPart('免疫了此次伤害'),
        );
      }
      if (buffImmune.length > 0) {
        parts.push(
          this.textPart('，'),
          this.unitPart(targetName),
          this.textPart('免疫了'),
          ...this.quotedBuffParts(buffImmune.map((entry) => entry.data.buffName)),
        );
      }
      if (manaShield.length > 0) {
        const absorbedDamage = manaShield.reduce(
          (sum, entry) => sum + entry.data.absorbedDamage,
          0,
        );
        const mpConsumed = manaShield.reduce(
          (sum, entry) => sum + entry.data.mpConsumed,
          0,
        );
        parts.push(
          this.textPart('，'),
          this.unitPart(targetName),
          this.textPart('以法力化解 '),
          this.numberPart(absorbedDamage),
          this.textPart(' 点伤害（消耗 '),
          this.numberPart(mpConsumed),
          this.textPart(' 点法力）'),
        );
      }
      if (resist.length > 0) {
        parts.push(
          this.textPart('，'),
          this.unitPart(targetName),
          this.textPart('抵抗了控制效果'),
        );
      }
      lines.push(this.line('primary', ...parts));
    } else {
      const resultParts = this.nonDamageOutcomeParts(entries, targetName);
      if (resultParts.length > 0) lines.push(this.line('primary', ...resultParts));
    }

    lines.push(...this.presentManaBurns(this.findEntries(entries, 'mana_burn')));
    lines.push(...this.presentResourceDrains(this.findEntries(entries, 'resource_drain')));
    return lines;
  }

  private presentTriggerOutcomes(
    entries: LogEntry[],
    fallbackActorName: string,
  ): PresentedLogLine[] {
    const groups = this.groupBySource(entries);
    const lines: PresentedLogLine[] = [];
    for (const group of groups) {
      const first = group[0];
      const source = this.getEntrySource(first);
      const targetName = this.entryTargetName(first) ?? fallbackActorName;
      const prefix: PresentedLogPart[] = [
        this.unitPart(source?.unitName ?? targetName),
      ];
      if (source?.buffName) {
        prefix.push(
          this.textPart('触发'),
          this.buffPart(source.buffName),
          this.textPart('，'),
        );
      } else if (source?.abilityName) {
        prefix.push(
          this.textPart('触发'),
          this.abilityPart(source.abilityName),
          this.textPart('，'),
        );
      }

      const heals = this.findEntries(group, 'heal').filter((entry) => entry.data.value > 0);
      const shields = this.findEntries(group, 'shield').filter((entry) => entry.data.value > 0);
      const buffs = this.findEntries(group, 'buff_apply').filter(
        (entry) => entry.data.visibility !== 'debug',
      );
      const mechanics = this.findEntries(group, 'mechanic').filter(
        (entry) => entry.data.visibility !== 'debug',
      );
      const result: PresentedLogPart[] = [];
      if (heals.length > 0) {
        const healType = heals[0].data.healType ?? 'hp';
        result.push(
          this.textPart('恢复'),
          this.numberPart(heals.reduce((sum, entry) => sum + entry.data.value, 0)),
          this.textPart(`点${getResourceText(healType)}`),
        );
      }
      if (shields.length > 0) {
        if (result.length > 0) result.push(this.textPart('，'));
        result.push(
          this.textPart('获得'),
          this.numberPart(shields.reduce((sum, entry) => sum + entry.data.value, 0)),
          this.textPart('点护盾'),
        );
      }
      if (buffs.length > 0) {
        if (result.length > 0) result.push(this.textPart('，并'));
        result.push(
          this.textPart('获得'),
          ...this.buffApplyParts(buffs),
        );
      }
      for (const mechanic of mechanics) {
        if (result.length > 0) result.push(this.textPart('，'));
        result.push(this.textPart(this.formatMechanic(mechanic)));
      }
      if (result.length > 0) {
        lines.push(this.line('trigger', ...prefix, ...result));
      }
      lines.push(...this.presentManaBurns(this.findEntries(group, 'mana_burn'), 'trigger'));
      lines.push(...this.presentResourceDrains(this.findEntries(group, 'resource_drain'), 'trigger'));
    }
    return lines;
  }

  private presentSecondaryDamage(entries: Array<LogEntry<'damage'>>): PresentedLogLine[] {
    const lines: PresentedLogLine[] = [];
    for (const source of ['follow_up', 'counter', 'reflect', 'delayed'] as const) {
      const sourceEntries = entries.filter((entry) => entry.data.damageSource === source);
      for (const text of this.formatSecondaryDamageLines(sourceEntries, source)) {
        lines.push(this.line('secondary', this.textPart(text)));
      }
    }
    return lines;
  }

  private presentManaBurns(
    entries: Array<LogEntry<'mana_burn'>>,
    role: PresentedLogLine['role'] = 'primary',
  ): PresentedLogLine[] {
    return this.groupNumericEntries(entries).map((group) => {
      const total = group.reduce((sum, entry) => sum + entry.data.value, 0);
      return this.line(
        role,
        this.textPart(group.length > 1 ? '共削减' : '削减'),
        this.unitPart(group[0].data.targetName),
        this.numberPart(total),
        this.textPart('点法力'),
      );
    });
  }

  private presentResourceDrains(
    entries: Array<LogEntry<'resource_drain'>>,
    role: PresentedLogLine['role'] = 'primary',
  ): PresentedLogLine[] {
    return this.groupNumericEntries(entries).map((group) => {
      const total = group.reduce((sum, entry) => sum + entry.data.value, 0);
      return this.line(
        role,
        this.textPart('从'),
        this.unitPart(group[0].data.targetName),
        this.textPart(group.length > 1 ? '身上共吸取' : '身上吸取'),
        this.numberPart(total),
        this.textPart(`点${getResourceText(group[0].data.drainType)}`),
      );
    });
  }

  private groupNumericEntries<T extends 'mana_burn' | 'resource_drain'>(
    entries: Array<LogEntry<T>>,
  ): Array<Array<LogEntry<T>>> {
    const groups = new Map<string, Array<LogEntry<T>>>();
    for (const entry of entries.filter((item) => item.data.value > 0)) {
      const source = this.getEntrySource(entry);
      const drainType = entry.type === 'resource_drain'
        ? (entry.data as LogEntry<'resource_drain'>['data']).drainType
        : 'mp';
      const key = [
        source?.buffId ?? source?.buffName ?? '',
        source?.abilityId ?? source?.abilityName ?? '',
        entry.data.targetName,
        drainType,
      ].join('|');
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }

  private groupBySource(entries: LogEntry[]): LogEntry[][] {
    const groups = new Map<string, LogEntry[]>();
    for (const entry of entries) {
      const source = this.getEntrySource(entry);
      const key = [
        source?.buffId ?? source?.buffName ?? '',
        source?.abilityId ?? source?.abilityName ?? '',
        source?.unitId ?? source?.unitName ?? '',
      ].join('|');
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }

  private actionPrefixParts(
    actorName: string,
    ability: { id: string; name: string } | undefined,
  ): PresentedLogPart[] {
    if (ability?.id === 'basic_attack') {
      return [this.unitPart(actorName), this.textPart('发起攻击')];
    }
    return [
      this.unitPart(actorName),
      this.textPart('施放'),
      this.abilityPart(ability?.name ?? '未知技能'),
    ];
  }

  private extractPrimaryTargets(entries: LogEntry[]): string[] {
    const targets = new Set<string>();
    for (const entry of entries) {
      const target = this.entryTargetName(entry);
      if (!target) continue;
      if (
        entry.type === 'damage' &&
        (entry.data as DamageEntryData).damageSource === 'reflect'
      ) continue;
      if (
        entry.type === 'resource_change' ||
        entry.type === 'action_state' ||
        entry.type === 'control_skip'
      ) continue;
      targets.add(target);
    }
    return Array.from(targets);
  }

  private entryBelongsToTarget(entry: LogEntry, targetName: string): boolean {
    return this.entryTargetName(entry) === targetName;
  }

  private entryTargetName(entry: LogEntry): string | undefined {
    const data = entry.data as { targetName?: string; unitName?: string };
    return data.targetName ?? data.unitName;
  }

  private isZeroOutcome(entry: LogEntry): boolean {
    if (
      entry.type === 'heal' ||
      entry.type === 'mana_burn' ||
      entry.type === 'resource_drain' ||
      entry.type === 'shield'
    ) {
      return (entry.data as { value: number }).value <= 0;
    }
    return false;
  }

  private isTriggeredOutcome(entry: LogEntry, span: LogSpan): boolean {
    const source = this.getEntrySource(entry);
    if (source?.buffId || source?.buffName) return true;
    return Boolean(
      source?.abilityId &&
      span.ability?.id &&
      source.abilityId !== span.ability.id,
    );
  }

  private getEntrySource(entry: LogEntry): LogSourceRef | undefined {
    const data = entry.data as {
      source?: LogSourceRef;
      sourceUnitId?: string;
      sourceUnitName?: string;
      sourceAbilityId?: string;
      sourceAbilityName?: string;
      sourceBuff?: string;
    };
    if (data.source) return data.source;
    if (
      data.sourceUnitId ||
      data.sourceUnitName ||
      data.sourceAbilityId ||
      data.sourceAbilityName ||
      data.sourceBuff
    ) {
      return {
        unitId: data.sourceUnitId,
        unitName: data.sourceUnitName,
        abilityId: data.sourceAbilityId,
        abilityName: data.sourceAbilityName,
        buffName: data.sourceBuff,
      };
    }
    return undefined;
  }

  private damageSegmentParts(entry: LogEntry<'damage'>): PresentedLogPart[] {
    const parts: PresentedLogPart[] = [this.numberPart(entry.data.value)];
    if ((entry.data.shieldAbsorbed ?? 0) > 0) {
      parts.push(
        this.textPart('（护盾吸收'),
        this.numberPart(Math.round(entry.data.shieldAbsorbed ?? 0)),
        this.textPart('）'),
      );
    }
    if (entry.data.isCritical) {
      parts.push(this.textPart('（'), this.criticalPart(), this.textPart('）'));
    }
    return parts;
  }

  private appendDamageResultParts(
    parts: PresentedLogPart[],
    targetName: string,
    buffs: Array<LogEntry<'buff_apply'>>,
    deathPrevent?: LogEntry<'death_prevent'>,
    death?: LogEntry<'death'>,
  ): void {
    if (buffs.length > 0) {
      parts.push(this.textPart('并施加'), ...this.buffApplyParts(buffs));
    }
    if (deathPrevent) {
      parts.push(
        this.textPart('，'),
        this.unitPart(deathPrevent.data.targetName),
        this.textPart('触发免死效果，保住了性命！'),
      );
    } else if (death) {
      parts.push(
        this.textPart('，'),
        this.unitPart(death.data.targetName ?? targetName),
        this.textPart('被击败！'),
      );
    }
  }

  private nonDamageOutcomeParts(
    entries: LogEntry[],
    targetName: string,
  ): PresentedLogPart[] {
    const parts: PresentedLogPart[] = [];
    const appendClause = (...clause: PresentedLogPart[]) => {
      if (parts.length > 0) parts.push(this.textPart('，'));
      parts.push(...clause);
    };
    const heals = this.findEntries(entries, 'heal').filter((entry) => entry.data.value > 0);
    const shields = this.findEntries(entries, 'shield').filter((entry) => entry.data.value > 0);
    const buffs = this.findEntries(entries, 'buff_apply').filter(
      (entry) => entry.data.visibility !== 'debug',
    );
    const buffImmune = this.findEntries(entries, 'buff_immune');
    const dispels = this.findEntries(entries, 'dispel');
    const cooldowns = this.findEntries(entries, 'cooldown_modify');
    const tags = this.findEntries(entries, 'tag_trigger');
    const mechanics = this.findEntries(entries, 'mechanic').filter(
      (entry) => entry.data.visibility !== 'debug',
    );

    for (const healType of ['hp', 'mp'] as const) {
      const matching = heals.filter(
        (entry) => (entry.data.healType ?? 'hp') === healType,
      );
      if (matching.length === 0) continue;
      appendClause(
        this.textPart('为'),
        this.unitPart(targetName),
        this.textPart('恢复 '),
        this.numberPart(matching.reduce((sum, entry) => sum + entry.data.value, 0)),
        this.textPart(` 点${getResourceText(healType)}`),
      );
    }
    if (shields.length > 0) {
      appendClause(
        this.textPart('为'),
        this.unitPart(targetName),
        this.textPart('施加 '),
        this.numberPart(shields.reduce((sum, entry) => sum + entry.data.value, 0)),
        this.textPart(' 点护盾'),
      );
    }
    if (buffs.length > 0) {
      appendClause(
        this.textPart('对'),
        this.unitPart(targetName),
        this.textPart('施加'),
        ...this.buffApplyParts(buffs),
      );
    }
    if (buffImmune.length > 0) {
      appendClause(
        this.textPart('对'),
        this.unitPart(targetName),
        this.textPart('施加的'),
        ...this.quotedBuffParts(buffImmune.map((entry) => entry.data.buffName)),
        this.textPart('被免疫了'),
      );
    }
    for (const dispel of dispels) {
      appendClause(
        this.textPart('清除了'),
        this.unitPart(dispel.data.targetName),
        this.textPart('身上的'),
        ...this.quotedBuffParts(dispel.data.buffs),
      );
    }
    for (const cooldown of cooldowns) {
      const action = cooldown.data.value > 0 ? '增加' : '减少';
      appendClause(
        this.textPart('使'),
        this.unitPart(cooldown.data.targetName),
        this.textPart('的'),
        this.abilityPart(cooldown.data.affectedSkillName),
        this.textPart(`冷却${action}`),
        this.numberPart(Math.abs(cooldown.data.value)),
        this.textPart('回合'),
      );
    }
    for (const tag of tags) {
      appendClause(
        this.textPart('触发了'),
        this.unitPart(tag.data.targetName),
        this.textPart('身上的'),
        this.buffPart(tag.data.displayName ?? '特殊标记'),
      );
    }
    for (const mechanic of mechanics) {
      appendClause(this.textPart(this.formatMechanic(mechanic)));
    }
    return parts;
  }

  private buffApplyParts(
    entries: Array<LogEntry<'buff_apply'>>,
  ): PresentedLogPart[] {
    const parts: PresentedLogPart[] = [];
    entries.forEach((entry, index) => {
      if (index > 0) parts.push(this.textPart('、'));
      parts.push(this.buffPart(entry.data.buffName));
      if ((entry.data.layers ?? 1) > 1) {
        parts.push(this.textPart('×'), this.numberPart(entry.data.layers ?? 1));
      }
      parts.push(this.textPart(this.formatDuration(
        entry.data.duration,
        entry.data.durationUnit,
      )));
    });
    return parts;
  }

  private quotedBuffParts(names: string[]): PresentedLogPart[] {
    const parts: PresentedLogPart[] = [];
    names.forEach((name, index) => {
      if (index > 0) parts.push(this.textPart('、'));
      parts.push(this.buffPart(name));
    });
    return parts;
  }

  private resourceChangeLine(
    entry: LogEntry<'resource_change'>,
  ): PresentedLogLine {
    const text = this.formatResourceChange(entry);
    const resourceIndex = text.indexOf(entry.data.resourceName);
    if (resourceIndex < 0) {
      return this.line('resource', this.textPart(text));
    }
    return this.line(
      'resource',
      this.textPart(text.slice(0, resourceIndex)),
      this.resourcePart(entry.data.resourceName),
      this.textPart(text.slice(resourceIndex + entry.data.resourceName.length)),
    );
  }

  private actionStateLine(
    entry: LogEntry<'action_state'>,
    includeUnit: boolean,
  ): PresentedLogLine | undefined {
    const data = entry.data;
    const unit = includeUnit ? [this.unitPart(data.unitName)] : [];
    if (data.stateType === 'rest') {
      if (data.phase === 'entered') {
        return this.line(
          'state',
          ...unit,
          this.textPart('进入'),
          this.statusPart('「调息」'),
          this.textPart('，下一次行动跳过'),
        );
      }
      if (data.phase === 'skipped') {
        return this.line(
          'state',
          this.unitPart(data.unitName),
          this.textPart('因'),
          this.statusPart('调息'),
          this.textPart('跳过本次行动'),
        );
      }
      return undefined;
    }
    const abilityName = data.abilityName ?? '后发神通';
    if (data.phase === 'entered') {
      return this.line(
        'state',
        ...unit,
        this.textPart('开始'),
        this.statusPart('蓄势'),
        this.textPart('，下一行动将发动'),
        this.abilityPart(abilityName),
      );
    }
    if (data.phase === 'triggered') {
      return this.line(
        'state',
        ...unit,
        this.statusPart('蓄势'),
        this.textPart('完成，发动'),
        this.abilityPart(abilityName),
      );
    }
    if (data.phase === 'cancelled') {
      return this.line('state', ...unit, this.statusPart('蓄势'), this.textPart('取消'));
    }
    return undefined;
  }

  private roleForSpan(span: LogSpan): PresentedLogLine['role'] {
    if (span.type === 'action_pre') return 'state';
    if (span.type === 'action_after') return 'secondary';
    return 'system';
  }

  private line(
    role: PresentedLogLine['role'],
    ...parts: PresentedLogPart[]
  ): PresentedLogLine {
    return { role, parts };
  }

  private textPart(text: string): PresentedLogPart {
    return { kind: 'text', text };
  }

  private unitPart(name: string): PresentedLogPart {
    return { kind: 'unit', text: this.formatName(name) };
  }

  private abilityPart(name: string): PresentedLogPart {
    return { kind: 'ability', text: this.formatSkill(name) };
  }

  private numberPart(value: number): PresentedLogPart {
    return { kind: 'number', text: this.formatNumber(value) };
  }

  private resourcePart(name: string): PresentedLogPart {
    return { kind: 'resource', text: name };
  }

  private buffPart(name: string): PresentedLogPart {
    return { kind: 'buff', text: `「${name}」` };
  }

  private criticalPart(): PresentedLogPart {
    return { kind: 'critical', text: '暴击' };
  }

  private statusPart(text: string): PresentedLogPart {
    return { kind: 'status', text };
  }

  private formatSpanText(span: LogSpan): string[] {
    if (span.entries.length === 0) {
      return this.formatEmptySpan(span);
    }

    switch (span.type) {
      case 'battle_init':
        return this.formatBattleInit(span);
      case 'battle_end':
        return this.formatBattleEnd(span);
      case 'round_start':
        return this.formatRoundStart(span);
      case 'action_pre':
        return this.formatActionPre(span);
      case 'action_after':
        return this.formatActionAfter(span);
      default:
        return [];
    }
  }

  private formatEmptySpan(span: LogSpan): string[] {
    switch (span.type) {
      case 'battle_init':
        return ['【战斗开始】'];
      case 'battle_end':
        return [`【战斗结束】${this.formatName(span.actor?.name ?? '未知')} 获胜！`];
      case 'round_start':
        return [`【第 ${span.turn} 回合】`];
      case 'action_after':
        return [];
      default:
        return [];
    }
  }

  private formatBattleInit(span: LogSpan): string[] {
    const lines = ['【战斗开始】'];
    for (const entry of this.findEntries(span.entries, 'resource_change')) {
      if (!entry.data.isInitial || entry.data.after <= 0) continue;
      lines.push(
        `${this.formatName(entry.data.targetName)}以${this.formatNumber(entry.data.after)}点${entry.data.resourceName}进入战斗`,
      );
    }
    return lines;
  }

  private formatBattleEnd(span: LogSpan): string[] {
    const winner = this.formatName(span.actor?.name ?? '未知');
    return [`【战斗结束】${winner} 获胜！`];
  }

  private formatRoundStart(span: LogSpan): string[] {
    const lines: string[] = [`【第 ${span.turn} 回合】`];

    const healEntries = this.findEntries(span.entries, 'heal');
    for (const entry of healEntries) {
      const resourceLabel = getResourceText(entry.data.healType ?? 'hp');
      lines.push(
        `${this.formatName(entry.data.targetName)}恢复 ${this.formatNumber(entry.data.value)} 点${resourceLabel}`,
      );
    }

    const dispelEntries = this.findEntries(span.entries, 'dispel');
    for (const entry of dispelEntries) {
      const buffNames = this.formatQuotedList(entry.data.buffs);
      lines.push(
        `${this.formatName(entry.data.targetName)}驱散了${buffNames}`,
      );
    }

    return lines;
  }

  private formatActionAfter(span: LogSpan): string[] {
    const expiredEntries = this.findEntries(span.entries, 'buff_remove').filter(
      (e) => e.data.reason === 'expired',
    );
    const resourceLines = this.findEntries(span.entries, 'resource_change')
      .filter((entry) => !entry.data.isInitial)
      .map((entry) => this.formatResourceChange(entry));
    if (expiredEntries.length === 0) return resourceLines;

    // processBuffs 只处理当前行动者的 buff，所有过期条目实质属于同一单位
    const targetName = this.formatName(expiredEntries[0].data.targetName);
    const buffNames = this.formatQuotedList(expiredEntries.map((e) => e.data.buffName));
    return [`${targetName}身上的${buffNames}时效已过`, ...resourceLines];
  }

  private formatActionPre(span: LogSpan): string[] {
    const actorName = span.actor?.name ?? '未知';
    const actor = this.formatName(actorName);
    const entries = span.entries;

    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');
    const controlSkip = this.findEntry(entries, 'control_skip');
    const actionStateLines = this.findEntries(entries, 'action_state')
      .map((entry) => this.formatActionState(entry))
      .filter((line): line is string => Boolean(line));

    // 持续效果文本（DOT / HOT），可能与控制文本同帧出现
    const dotHotText = this._buildDotHotText(actor, actorName, span, damage, heal);

    // 控制跳过文本
    if (controlSkip) {
      const controlDesc = getControlDesc(controlSkip.data.controlTag);
      const controlText = `${actor}${controlDesc}，本回合无法行动`;
      // 若同回合有 DOT/HOT，先描述持续效果再描述控制结果
      return [
        ...(dotHotText ? [dotHotText] : []),
        ...actionStateLines,
        controlText,
      ];
    }

    if (dotHotText) return [dotHotText, ...actionStateLines];
    if (actionStateLines.length > 0) return actionStateLines;
    return [`${actor} 持续效果触发`];
  }

  private formatMechanic(entry: LogEntry<'mechanic'>): string {
    const target = this.formatName(entry.data.targetName);
    const source = this.formatName(entry.data.sourceName ?? entry.data.targetName);
    const mechanicName = this.formatMechanicName(entry.data.name);
    const value = entry.data.value !== undefined
      ? this.formatNumber(Math.round(entry.data.value))
      : undefined;

    switch (entry.data.mechanic) {
      case 'memory_record':
        return `${target}记录「${mechanicName}」${value ?? ''}`;
      case 'memory_release':
        return `${target}释放「${mechanicName}」${value ?? ''}`;
      case 'ability_transform':
        return `${target}获得「${mechanicName}」强化`;
      case 'damage_defer':
        return `${target}将 ${value ?? 0} 点伤害延后 ${entry.data.detail ?? '?'} 回合结算`;
      case 'hp_sacrifice':
        return `${target}献祭 ${value ?? 0} 点气血`;
      case 'buff_layer':
        return `${target}调整「${entry.data.name}」层数`;
      case 'status_spread':
        return entry.data.detail === 'no_target'
          ? `${target}没有可扩散目标`
          : `${target}扩散「${mechanicName}」`;
      case 'named_trigger':
        if (entry.data.triggerBasis) {
          const basis = entry.data.triggerBasis;
          return `${source}因${target}的「${this.formatMechanicName(basis.left.displayName)}」与本次「${this.formatMechanicName(basis.right.displayName)}」发生「${this.formatMechanicName(basis.relation.displayName)}」，触发「${mechanicName}」`;
        }
        return `${source}触发「${mechanicName}」`;
      case 'status_transition': {
        const previous = entry.data.previousDisplayName
          ? this.formatMechanicName(entry.data.previousDisplayName)
          : undefined;
        switch (entry.data.operation) {
          case 'apply':
            return `${target}获得「${mechanicName}」`;
          case 'refresh':
            return `${target}的「${mechanicName}」持续时间刷新`;
          case 'replace':
            return `${target}的「${previous ?? '原状态'}」转为「${mechanicName}」`;
          case 'consume':
            return `${target}的「${mechanicName}」被消耗`;
          default:
            return `${target}的状态变为「${mechanicName}」`;
        }
      }
      default:
        return `${target}触发「${mechanicName}」`;
    }
  }

  private formatDamageSegment(entry: LogEntry<'damage'>): string {
    let text = this.formatNumber(entry.data.value);
    if ((entry.data.shieldAbsorbed ?? 0) > 0) {
      text += `（护盾吸收${this.formatNumber(Math.round(entry.data.shieldAbsorbed ?? 0))}）`;
    }
    if (entry.data.isCritical) text += '（暴击）';
    return text;
  }

  private formatSecondaryDamageLines(
    entries: Array<LogEntry<'damage'>>,
    source: 'follow_up' | 'counter' | 'reflect' | 'delayed',
  ): string[] {
    if (entries.length === 0) return [];
    const groups = new Map<string, Array<LogEntry<'damage'>>>();
    for (const entry of entries) {
      const key = [
        entry.data.sourceUnitId ?? entry.data.sourceUnitName ?? 'unknown',
        entry.data.sourceAbilityId ?? entry.data.sourceAbilityName ?? source,
        entry.data.targetName,
        entry.data.sourceBuff ?? '',
        entry.data.cause?.kind ?? '',
        entry.data.cause?.id ?? '',
      ].join('|');
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }

    return Array.from(groups.values()).map((group) => {
      const first = group[0];
      const sourceName = this.formatName(
        first.data.sourceUnitName ?? first.data.reflectSourceName ?? '未知',
      );
      const targetName = this.formatName(first.data.targetName);
      const abilityName = first.data.sourceAbilityName;
      const totalDamage = group.reduce((sum, entry) => sum + entry.data.value, 0);
      const totalShield = group.reduce(
        (sum, entry) => sum + (entry.data.shieldAbsorbed ?? 0),
        0,
      );
      const damageText = group.length > 1
        ? `${group.map((entry) => this.formatDamageSegment(entry)).join('、')}，合计${this.formatNumber(totalDamage)}点伤害`
        : `${this.formatDamageSegment(first)}点伤害`;
      const shieldText = totalShield > 0 && group.length > 1
        ? `，护盾共吸收${this.formatNumber(Math.round(totalShield))}点`
        : '';

      if (source === 'follow_up') {
        if (first.data.cause) {
          return `${sourceName}因「${first.data.cause.displayName}」追加伤害，对${targetName}造成${damageText}${shieldText}`;
        }
        return `${sourceName}乘势追击，对${targetName}造成${damageText}${shieldText}`;
      }
      if (source === 'counter') {
        const trigger = abilityName ? `触发「${abilityName}」反击` : '发动反击';
        return `${sourceName}${trigger}，对${targetName}造成${damageText}${shieldText}`;
      }
      if (source === 'delayed') {
        const buffName = first.data.sourceBuff ?? '持续效果';
        const causeName = first.data.cause?.displayName;
        if (causeName) {
          const settlement = group.length > 1
            ? `立即结算${group.length}次：${group.map((entry) => this.formatDamageSegment(entry)).join('、')}，合计${this.formatNumber(totalDamage)}点持续伤害`
            : `立即造成${damageText.replace('点伤害', '点持续伤害')}`;
          return `「${buffName}」受「${causeName}」引动，对${targetName}${settlement}`;
        }
        return `「${buffName}」对${targetName}造成${damageText}${shieldText}`;
      }
      return `${sourceName}反伤，对${targetName}造成${damageText}${shieldText}`;
    });
  }

  private formatResourceChange(entry: LogEntry<'resource_change'>): string {
    const data = entry.data;
    const applied = Math.abs(data.applied);
    const requested = Math.abs(data.requested);
    const state = `${data.after}/${data.resourceMax}`;
    if (data.operation === 'decay') {
      return `${data.resourceName}自然衰减${this.formatNumber(applied)}点（${state}）`;
    }
    if (data.operation === 'consume_all' || data.operation === 'subtract') {
      return `消耗${this.formatNumber(applied)}点${data.resourceName}（${state}）`;
    }
    if (data.operation === 'set') {
      return `${data.resourceName}调整为${this.formatNumber(data.after)}点（${state}）`;
    }
    if (applied === 0 && data.overflow > 0) {
      return `${data.resourceName}已满（${state}，溢出${this.formatNumber(data.overflow)}点）`;
    }
    if (data.reason === 'refund') {
      const overflow = data.overflow > 0
        ? `，溢出${this.formatNumber(data.overflow)}点`
        : '';
      return `返还${this.formatNumber(applied)}点${data.resourceName}（${state}${overflow}）`;
    }
    const overflow = data.overflow > 0
      ? `，溢出${this.formatNumber(data.overflow)}点`
      : '';
    return `获得${this.formatNumber(applied || requested)}点${data.resourceName}（${state}${overflow}）`;
  }

  private formatActionState(
    entry: LogEntry<'action_state'>,
    includeUnit = false,
  ): string | undefined {
    const data = entry.data;
    const unit = includeUnit ? `${this.formatName(data.unitName)}` : '';
    if (data.stateType === 'rest') {
      if (data.phase === 'entered') return `${unit}进入「调息」，下一次行动跳过`;
      if (data.phase === 'skipped') {
        return `${this.formatName(data.unitName)}因调息跳过本次行动`;
      }
      return undefined;
    }
    const abilityName = data.abilityName ?? '后发神通';
    if (data.phase === 'entered') {
      return `${unit}开始蓄势，下一行动将发动${this.formatSkill(abilityName)}`;
    }
    if (data.phase === 'triggered') {
      return `${unit}蓄势完成，发动${this.formatSkill(abilityName)}`;
    }
    if (data.phase === 'cancelled') {
      return `${unit}蓄势取消`;
    }
    return undefined;
  }

  private formatMechanicName(name: string): string {
    const labels: Record<string, string> = {
      calamity_debt: '劫债',
      karma_mirror_crit: '业镜',
      blood_ink_damage: '血墨符',
      borrowed_heal: '借法还真',
      causality_damage: '因果',
      shield_break: '破盾',
      thunder_devour_charge: '蓄雷',
      heaven_jealousy: '天妒',
    };
    return labels[name] ?? name;
  }

  private _buildDotHotText(
    actor: string,
    actorName: string,
    span: LogSpan,
    damage: LogEntry<'damage'> | undefined,
    heal: LogEntry<'heal'> | undefined,
  ): string | undefined {
    if (damage?.data.sourceBuff) {
      let result = `${actor}身上的「${damage.data.sourceBuff}」发作`;
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

    if (heal?.data.sourceBuff) {
      const resourceLabel = getResourceText(heal.data.healType ?? 'hp');
      return `${actor}身上的「${heal.data.sourceBuff}」生效，恢复 ${this.formatNumber(heal.data.value)} 点${resourceLabel}`;
    }

    return undefined;
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

  private formatDuration(
    duration: number,
    unit: 'owner_action' | 'round' = 'owner_action',
  ): string {
    if (duration < 0) {
      return '（永久）';
    }
    return unit === 'owner_action'
      ? `（未来${duration}次自身行动）`
      : `（${duration}回合）`;
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
      .flat()
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

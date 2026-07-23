import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { getResourceText } from '@shared/lib/gameConceptDisplay';
import { getLogEntrySource, reduceActionLog } from './ActionLogReducer';
import {
  CombatLogAIView,
  CombatLogSummary,
  DamageEntryData,
  LogEntry,
  LogEntryType,
  LogSpan,
  PresentedLogLine,
  PresentedLogPart,
  PresentedLogTone,
} from './types';

/**
 * 控制标签 → 战报状态描述（基于行动完全被压制的场景）
 * 仅处理 ControlledSkipEvent 可携带的标签（NO_ACTION / STUNNED）
 */
const CONTROL_TAG_DESC: Readonly<Record<string, string>> = {
  [GameplayTags.STATUS.CONTROL.STUNNED]: '陷入眩晕',
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
    return this.presentNonActionSpan(span);
  }

  private presentNonActionSpan(span: LogSpan): PresentedLogLine[] {
    if (span.entries.length === 0) {
      switch (span.type) {
        case 'battle_init':
          return [this.line('system', this.textPart('【战斗开始】'))];
        case 'battle_end':
          return [
            this.line(
              'system',
              this.textPart('【战斗结束】'),
              this.unitPart(span.actor?.name ?? '未知'),
              this.textPart(' 获胜！', 'fatal', 'strong'),
            ),
          ];
        case 'round_start':
          return [
            this.line(
              'system',
              this.textPart('【第 '),
              this.rawNumberPart(String(span.turn), 'secondary'),
              this.textPart(' 回合】'),
            ),
          ];
        default:
          return [];
      }
    }

    switch (span.type) {
      case 'battle_init':
        return this.presentBattleInit(span);
      case 'battle_end':
        return [
          this.line(
            'system',
            this.textPart('【战斗结束】'),
            this.unitPart(span.actor?.name ?? '未知'),
            this.textPart(' 获胜！', 'fatal', 'strong'),
          ),
        ];
      case 'round_start':
        return this.presentRoundStart(span);
      case 'action_pre':
        return this.presentActionPre(span);
      case 'action_after':
        return this.presentActionAfter(span);
      default:
        return [];
    }
  }

  private presentBattleInit(span: LogSpan): PresentedLogLine[] {
    const lines = [this.line('system', this.textPart('【战斗开始】'))];
    for (const entry of this.findEntries(span.entries, 'resource_change')) {
      if (!entry.data.isInitial || entry.data.after <= 0) continue;
      lines.push(
        this.line(
          'system',
          this.unitPart(entry.data.targetName),
          this.textPart('以'),
          this.numberPart(entry.data.after, 'resource'),
          this.textPart('点'),
          this.resourcePart(entry.data.resourceName),
          this.textPart('进入战斗'),
        ),
      );
    }
    return lines;
  }

  private presentRoundStart(span: LogSpan): PresentedLogLine[] {
    const lines = [
      this.line(
        'system',
        this.textPart('【第 '),
        this.rawNumberPart(String(span.turn), 'secondary'),
        this.textPart(' 回合】'),
      ),
    ];
    for (const entry of this.findEntries(span.entries, 'heal')) {
      lines.push(
        this.line(
          'system',
          this.unitPart(entry.data.targetName),
          this.textPart('恢复 '),
          this.numberPart(entry.data.value, 'positive'),
          this.textPart(` 点${getResourceText(entry.data.healType ?? 'hp')}`),
        ),
      );
    }
    for (const entry of this.findEntries(span.entries, 'dispel')) {
      lines.push(
        this.line(
          'system',
          this.unitPart(entry.data.targetName),
          this.textPart('驱散了', 'defense'),
          ...this.quotedBuffParts(entry.data.buffs),
        ),
      );
    }
    return lines;
  }

  private presentActionAfter(span: LogSpan): PresentedLogLine[] {
    const lines: PresentedLogLine[] = [];
    const expiredEntries = this.findEntries(span.entries, 'buff_remove').filter(
      (entry) => entry.data.reason === 'expired',
    );
    if (expiredEntries.length > 0) {
      lines.push(
        this.line(
          'secondary',
          this.unitPart(expiredEntries[0].data.targetName),
          this.textPart('身上的'),
          ...this.quotedBuffParts(
            expiredEntries.map((entry) => entry.data.buffName),
          ),
          this.textPart('时效已过', 'secondary'),
        ),
      );
    }
    for (const entry of this.findEntries(
      span.entries,
      'resource_change',
    ).filter((item) => !item.data.isInitial)) {
      lines.push(this.line('secondary', ...this.resourceChangeParts(entry)));
    }
    return lines;
  }

  private presentActionPre(span: LogSpan): PresentedLogLine[] {
    const actorName = span.actor?.name ?? '未知';
    const entries = span.entries;
    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');
    const controlSkip = this.findEntry(entries, 'control_skip');
    const lines: PresentedLogLine[] = [];

    const damageBuffName = damage
      ? getLogEntrySource(damage)?.buffName
      : undefined;
    const healBuffName = heal ? getLogEntrySource(heal)?.buffName : undefined;

    if (damage && damageBuffName) {
      const parts: PresentedLogPart[] = [
        this.unitPart(actorName),
        this.textPart('身上的'),
        this.buffPart(damageBuffName, 'debuff'),
        this.textPart('发作，造成 '),
        this.numberPart(
          damage.data.value,
          this.damageTone(damage.data.damageType),
        ),
        this.textPart(' 点伤害'),
      ];
      if ((damage.data.shieldAbsorbed ?? 0) > 0) {
        parts.push(
          this.textPart('（抵扣护盾 '),
          this.numberPart(
            Math.round(damage.data.shieldAbsorbed ?? 0),
            'shield',
          ),
          this.textPart(' 点）'),
        );
      }
      const death = this.findEntry(entries, 'death');
      if (death?.data.targetName === actorName) {
        parts.push(
          this.textPart('，'),
          this.unitPart(actorName),
          this.textPart('被击败！', 'fatal', 'strong'),
        );
      }
      lines.push(this.line('state', ...parts));
    } else if (heal && healBuffName) {
      lines.push(
        this.line(
          'state',
          this.unitPart(actorName),
          this.textPart('身上的'),
          this.buffPart(healBuffName, 'buff'),
          this.textPart('生效，恢复 '),
          this.numberPart(heal.data.value, 'positive'),
          this.textPart(` 点${getResourceText(heal.data.healType ?? 'hp')}`),
        ),
      );
    }

    for (const entry of this.findEntries(entries, 'action_state')) {
      const stateLine = this.actionStateLine(entry, false);
      if (stateLine) lines.push(stateLine);
    }
    if (controlSkip) {
      lines.push(
        this.line(
          'state',
          this.unitPart(actorName),
          this.textPart(
            `${getControlDesc(controlSkip.data.controlTag)}，本回合无法行动`,
            'control',
            'strong',
          ),
        ),
      );
    }
    if (lines.length > 0) return lines;
    return [
      this.line(
        'state',
        this.unitPart(actorName),
        this.textPart(' 持续效果触发'),
      ),
    ];
  }

  private presentAction(span: LogSpan): PresentedLogLine[] {
    const actorName = span.actor?.name ?? '未知';
    const actionPrefix = this.actionPrefixParts(actorName, span.ability);
    const {
      primaryEntries,
      triggerEntries,
      secondaryDamage,
      namedTriggers,
      statusTransitions,
      abilityModeStates,
      deferredActionStates,
      resourceEntries,
    } = reduceActionLog(span);
    const targets = this.extractPrimaryTargets(primaryEntries);
    const lines: PresentedLogLine[] = [];

    if (targets.length === 1) {
      const targetLines = this.presentTargetOutcomes(
        primaryEntries.filter((entry) =>
          this.entryBelongsToTarget(entry, targets[0]),
        ),
        targets[0],
      );
      if (targetLines.length > 0) {
        targetLines[0] = {
          ...targetLines[0],
          role: 'primary',
          parts: [
            ...actionPrefix,
            this.textPart('，'),
            ...targetLines[0].parts,
          ],
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
            primaryEntries.filter((entry) =>
              this.entryBelongsToTarget(entry, target),
            ),
            target,
          ),
        );
      }
    } else {
      lines.push(this.line('primary', ...actionPrefix));
    }

    for (const entry of abilityModeStates) {
      const stateLine = this.actionStateLine(entry, true);
      if (stateLine) lines.push(stateLine);
    }
    for (const mechanic of namedTriggers) {
      lines.push(this.line('trigger', ...this.mechanicParts(mechanic)));
    }
    lines.push(...this.presentTriggerOutcomes(triggerEntries, actorName));
    lines.push(...this.presentSecondaryDamage(secondaryDamage));
    for (const mechanic of statusTransitions) {
      lines.push(this.line('trigger', ...this.mechanicParts(mechanic)));
    }
    for (const entry of resourceEntries) {
      lines.push(this.resourceChangeLine(entry));
    }
    for (const entry of deferredActionStates) {
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
      (entry) =>
        !entry.data.damageSource || entry.data.damageSource === 'direct',
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
      return [
        this.line(
          'primary',
          this.textPart('被'),
          this.unitPart(targetName),
          this.textPart('闪避了！', 'defense', 'strong'),
        ),
      ];
    }
    if (interrupt) {
      return [
        this.line(
          'primary',
          this.textPart('打断了', 'negative', 'strong'),
          this.unitPart(interrupt.data.targetName),
          this.textPart('的'),
          this.abilityPart(interrupt.data.skillName),
          this.textPart('！'),
        ),
      ];
    }
    if (
      resist.length > 0 &&
      entries.every((entry) => entry.type === 'resist')
    ) {
      return [
        this.line(
          'primary',
          this.textPart('被'),
          this.unitPart(targetName),
          this.textPart('抵抗了！', 'defense', 'strong'),
        ),
      ];
    }

    if (directDamage.length > 1) {
      lines.push(
        this.line(
          'primary',
          this.textPart('对'),
          this.unitPart(targetName),
          this.textPart('连续命中'),
          this.rawNumberPart(String(directDamage.length), 'secondary'),
          this.textPart('段：'),
        ),
      );
      const detailParts: PresentedLogPart[] = [];
      directDamage.forEach((entry, index) => {
        if (index > 0) detailParts.push(this.textPart('、'));
        detailParts.push(...this.damageSegmentParts(entry));
      });
      const totalDamage = directDamage.reduce(
        (sum, entry) => sum + entry.data.value,
        0,
      );
      detailParts.push(
        this.textPart('，合计'),
        this.numberPart(
          totalDamage,
          this.groupDamageTone(directDamage),
          'strong',
        ),
        this.textPart('点气血伤害'),
      );
      const totalShield = directDamage.reduce(
        (sum, entry) => sum + (entry.data.shieldAbsorbed ?? 0),
        0,
      );
      if (totalShield > 0) {
        detailParts.push(
          this.textPart('，护盾共吸收'),
          this.numberPart(Math.round(totalShield), 'shield'),
          this.textPart('点'),
        );
      }
      this.appendDamageResultParts(
        detailParts,
        targetName,
        buffs,
        deathPrevent,
        death,
      );
      lines.push(this.line('primary', ...detailParts));
    } else if (directDamage.length === 1 || damageImmune.length > 0) {
      const damage = directDamage[0];
      const parts: PresentedLogPart[] = [
        this.textPart('对'),
        this.unitPart(targetName),
        this.textPart('造成 '),
        this.numberPart(
          damage?.data.value ?? 0,
          this.damageTone(damage?.data.damageType),
        ),
        this.textPart(' 点伤害'),
      ];
      if (damage?.data.isCritical) {
        parts.push(
          this.textPart('（'),
          this.criticalPart(),
          this.textPart('）！'),
        );
      }
      const absorbed = damage?.data.shieldAbsorbed ?? 0;
      if (absorbed > 0) {
        parts.push(
          this.textPart('（抵扣护盾 '),
          this.numberPart(Math.round(absorbed), 'shield'),
          this.textPart(' 点'),
          ...(damage?.data.remainShield === 0
            ? [this.textPart('，护盾已破碎', 'fatal', 'strong')]
            : []),
          this.textPart('）'),
        );
      }
      this.appendDamageResultParts(
        parts,
        targetName,
        buffs,
        deathPrevent,
        death,
      );
      if (damageImmune.length > 0) {
        parts.push(
          this.textPart('，'),
          this.unitPart(targetName),
          this.textPart('免疫了此次伤害', 'defense', 'strong'),
        );
      }
      if (buffImmune.length > 0) {
        parts.push(
          this.textPart('，'),
          this.unitPart(targetName),
          this.textPart('免疫了', 'defense', 'strong'),
          ...this.quotedBuffParts(
            buffImmune.map((entry) => entry.data.buffName),
          ),
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
          this.numberPart(absorbedDamage, 'shield'),
          this.textPart(' 点伤害（消耗 '),
          this.numberPart(mpConsumed, 'negative'),
          this.textPart(' 点法力）'),
        );
      }
      if (resist.length > 0) {
        parts.push(
          this.textPart('，'),
          this.unitPart(targetName),
          this.textPart('抵抗了控制效果', 'defense', 'strong'),
        );
      }
      lines.push(this.line('primary', ...parts));
    } else {
      const resultParts = this.nonDamageOutcomeParts(entries, targetName);
      if (resultParts.length > 0)
        lines.push(this.line('primary', ...resultParts));
    }

    lines.push(
      ...this.presentManaBurns(this.findEntries(entries, 'mana_burn')),
    );
    lines.push(
      ...this.presentResourceDrains(
        this.findEntries(entries, 'resource_drain'),
      ),
    );
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
      const source = getLogEntrySource(first);
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

      const heals = this.findEntries(group, 'heal').filter(
        (entry) => entry.data.value > 0,
      );
      const shields = this.findEntries(group, 'shield').filter(
        (entry) => entry.data.value > 0,
      );
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
          this.numberPart(
            heals.reduce((sum, entry) => sum + entry.data.value, 0),
            'positive',
          ),
          this.textPart(`点${getResourceText(healType)}`),
        );
      }
      if (shields.length > 0) {
        if (result.length > 0) result.push(this.textPart('，'));
        result.push(
          this.textPart('获得'),
          this.numberPart(
            shields.reduce((sum, entry) => sum + entry.data.value, 0),
            'shield',
          ),
          this.textPart('点护盾'),
        );
      }
      if (buffs.length > 0) {
        if (result.length > 0) result.push(this.textPart('，并'));
        result.push(this.textPart('获得'), ...this.buffApplyParts(buffs));
      }
      for (const mechanic of mechanics) {
        if (result.length > 0) result.push(this.textPart('，'));
        result.push(...this.mechanicParts(mechanic));
      }
      if (result.length > 0) {
        lines.push(this.line('trigger', ...prefix, ...result));
      }
      lines.push(
        ...this.presentManaBurns(
          this.findEntries(group, 'mana_burn'),
          'trigger',
        ),
      );
      lines.push(
        ...this.presentResourceDrains(
          this.findEntries(group, 'resource_drain'),
          'trigger',
        ),
      );
    }
    return lines;
  }

  private presentSecondaryDamage(
    entries: Array<LogEntry<'damage'>>,
  ): PresentedLogLine[] {
    const lines: PresentedLogLine[] = [];
    for (const source of [
      'follow_up',
      'counter',
      'reflect',
      'delayed',
    ] as const) {
      const sourceEntries = entries.filter(
        (entry) => entry.data.damageSource === source,
      );
      for (const parts of this.secondaryDamageParts(sourceEntries, source)) {
        lines.push(this.line('secondary', ...parts));
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
        this.numberPart(total, 'negative'),
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
        this.numberPart(total, 'negative'),
        this.textPart(`点${getResourceText(group[0].data.drainType)}`),
      );
    });
  }

  private groupNumericEntries<T extends 'mana_burn' | 'resource_drain'>(
    entries: Array<LogEntry<T>>,
  ): Array<Array<LogEntry<T>>> {
    const groups = new Map<string, Array<LogEntry<T>>>();
    for (const entry of entries.filter((item) => item.data.value > 0)) {
      const source = getLogEntrySource(entry);
      const drainType =
        entry.type === 'resource_drain'
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
      const source = getLogEntrySource(entry);
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
      )
        continue;
      if (
        entry.type === 'resource_change' ||
        entry.type === 'action_state' ||
        entry.type === 'control_skip'
      )
        continue;
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

  private damageSegmentParts(entry: LogEntry<'damage'>): PresentedLogPart[] {
    const parts: PresentedLogPart[] = [
      this.numberPart(entry.data.value, this.damageTone(entry.data.damageType)),
    ];
    if ((entry.data.shieldAbsorbed ?? 0) > 0) {
      parts.push(
        this.textPart('（护盾吸收'),
        this.numberPart(Math.round(entry.data.shieldAbsorbed ?? 0), 'shield'),
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
        this.textPart('触发免死效果，保住了性命！', 'defense', 'strong'),
      );
    } else if (death) {
      parts.push(
        this.textPart('，'),
        this.unitPart(death.data.targetName ?? targetName),
        this.textPart('被击败！', 'fatal', 'strong'),
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
    const heals = this.findEntries(entries, 'heal').filter(
      (entry) => entry.data.value > 0,
    );
    const shields = this.findEntries(entries, 'shield').filter(
      (entry) => entry.data.value > 0,
    );
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
        this.numberPart(
          matching.reduce((sum, entry) => sum + entry.data.value, 0),
          'positive',
        ),
        this.textPart(` 点${getResourceText(healType)}`),
      );
    }
    if (shields.length > 0) {
      appendClause(
        this.textPart('为'),
        this.unitPart(targetName),
        this.textPart('施加 '),
        this.numberPart(
          shields.reduce((sum, entry) => sum + entry.data.value, 0),
          'shield',
        ),
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
        this.textPart('被免疫了', 'defense', 'strong'),
      );
    }
    for (const dispel of dispels) {
      appendClause(
        this.textPart('清除了', 'defense'),
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
        this.numberPart(
          Math.abs(cooldown.data.value),
          cooldown.data.value > 0 ? 'negative' : 'positive',
        ),
        this.textPart('回合'),
      );
    }
    for (const tag of tags) {
      appendClause(
        this.textPart('触发了'),
        this.unitPart(tag.data.targetName),
        this.textPart('身上的'),
        this.buffPart(tag.data.displayName ?? '特殊标记', 'mechanic'),
      );
    }
    for (const mechanic of mechanics) {
      appendClause(...this.mechanicParts(mechanic));
    }
    return parts;
  }

  private buffApplyParts(
    entries: Array<LogEntry<'buff_apply'>>,
  ): PresentedLogPart[] {
    const parts: PresentedLogPart[] = [];
    entries.forEach((entry, index) => {
      if (index > 0) parts.push(this.textPart('、'));
      parts.push(this.buffPart(entry.data.buffName, entry.data.buffType));
      if ((entry.data.layers ?? 1) > 1) {
        parts.push(
          this.textPart('×'),
          this.numberPart(entry.data.layers ?? 1, 'secondary'),
        );
      }
      parts.push(
        ...this.durationParts(entry.data.duration, entry.data.durationUnit),
      );
    });
    return parts;
  }

  private quotedBuffParts(names: string[]): PresentedLogPart[] {
    const parts: PresentedLogPart[] = [];
    names.forEach((name, index) => {
      if (index > 0) parts.push(this.textPart('、'));
      parts.push(this.buffPart(name, 'secondary'));
    });
    return parts;
  }

  private resourceChangeLine(
    entry: LogEntry<'resource_change'>,
  ): PresentedLogLine {
    return this.line('resource', ...this.resourceChangeParts(entry));
  }

  private actionStateLine(
    entry: LogEntry<'action_state'>,
    includeUnit: boolean,
  ): PresentedLogLine | undefined {
    const data = entry.data;
    const unit = includeUnit ? [this.unitPart(data.unitName)] : [];
    if (data.stateType === 'ability_mode') {
      if (data.phase !== 'entered') return undefined;
      return this.line(
        'state',
        ...unit,
        this.textPart('进入'),
        this.statusPart(`「${data.name}」`),
      );
    }
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
    const abilityName = data.ability?.name ?? '后发神通';
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
      return this.line(
        'state',
        ...unit,
        this.statusPart('蓄势'),
        this.textPart('取消'),
      );
    }
    return undefined;
  }

  private line(
    role: PresentedLogLine['role'],
    ...parts: PresentedLogPart[]
  ): PresentedLogLine {
    return { role, parts };
  }

  private textPart(
    text: string,
    tone?: PresentedLogTone,
    emphasis?: PresentedLogPart['emphasis'],
  ): PresentedLogPart {
    return {
      kind: 'text',
      text,
      ...(tone ? { tone } : {}),
      ...(emphasis ? { emphasis } : {}),
    };
  }

  private unitPart(name: string): PresentedLogPart {
    return { kind: 'unit', text: this.formatName(name), tone: 'neutral' };
  }

  private abilityPart(name: string): PresentedLogPart {
    return {
      kind: 'ability',
      text: this.formatSkill(name),
      tone: 'ability',
    };
  }

  private numberPart(
    value: number,
    tone?: PresentedLogTone,
    emphasis?: PresentedLogPart['emphasis'],
  ): PresentedLogPart {
    return {
      kind: 'number',
      text: this.formatNumber(value),
      ...(tone ? { tone } : {}),
      ...(emphasis ? { emphasis } : {}),
    };
  }

  private rawNumberPart(
    value: string,
    tone: PresentedLogTone = 'secondary',
  ): PresentedLogPart {
    return { kind: 'number', text: value, tone };
  }

  private resourcePart(name: string): PresentedLogPart {
    return { kind: 'resource', text: name, tone: 'resource' };
  }

  private buffPart(
    name: string,
    tone:
      'buff' | 'debuff' | 'control' | 'mechanic' | 'secondary' = 'secondary',
  ): PresentedLogPart {
    return { kind: 'buff', text: `「${name}」`, tone };
  }

  private criticalPart(): PresentedLogPart {
    return {
      kind: 'critical',
      text: '暴击',
      tone: 'critical',
      emphasis: 'strong',
    };
  }

  private statusPart(text: string): PresentedLogPart {
    return { kind: 'status', text, tone: 'control' };
  }

  private damageTone(
    damageType: DamageEntryData['damageType'],
  ): PresentedLogTone {
    switch (damageType) {
      case 'physical':
        return 'damage-physical';
      case 'magical':
        return 'damage-magical';
      case 'true':
        return 'damage-true';
      case 'dot':
        return 'damage-dot';
      default:
        return 'damage-generic';
    }
  }

  private groupDamageTone(
    entries: Array<LogEntry<'damage'>>,
  ): PresentedLogTone {
    const tones = new Set(
      entries.map((entry) => this.damageTone(entry.data.damageType)),
    );
    return tones.size === 1 ? Array.from(tones)[0] : 'damage-generic';
  }

  private durationParts(
    duration: number,
    unit: 'owner_action' | 'round' = 'owner_action',
  ): PresentedLogPart[] {
    if (duration < 0) {
      return [this.textPart('（永久）', 'secondary')];
    }
    return unit === 'owner_action'
      ? [
          this.textPart('（未来', 'secondary'),
          this.rawNumberPart(String(duration), 'secondary'),
          this.textPart('次自身行动）', 'secondary'),
        ]
      : [
          this.textPart('（', 'secondary'),
          this.rawNumberPart(String(duration), 'secondary'),
          this.textPart('回合）', 'secondary'),
        ];
  }

  private mechanicParts(entry: LogEntry<'mechanic'>): PresentedLogPart[] {
    const target = this.unitPart(entry.data.targetName);
    const source = this.unitPart(
      entry.data.sourceName ?? entry.data.targetName,
    );
    const mechanicName = this.formatMechanicName(entry.data.name);
    const value =
      entry.data.value !== undefined
        ? this.numberPart(Math.round(entry.data.value), 'mechanic')
        : undefined;
    const mechanic = (name: string) =>
      this.buffPart(this.formatMechanicName(name), 'mechanic');

    switch (entry.data.mechanic) {
      case 'memory_record':
        return [
          target,
          this.textPart('记录'),
          mechanic(mechanicName),
          ...(value ? [value] : []),
        ];
      case 'memory_release':
        return [
          target,
          this.textPart('释放'),
          mechanic(mechanicName),
          ...(value ? [value] : []),
        ];
      case 'ability_transform':
        return [
          target,
          this.textPart('获得'),
          mechanic(mechanicName),
          this.textPart('强化'),
        ];
      case 'damage_defer':
        return [
          target,
          this.textPart('将 '),
          value ?? this.numberPart(0, 'mechanic'),
          this.textPart(' 点伤害延后 '),
          this.rawNumberPart(entry.data.detail ?? '?'),
          this.textPart(' 回合结算'),
        ];
      case 'hp_sacrifice':
        return [
          target,
          this.textPart('献祭 '),
          entry.data.value !== undefined
            ? this.numberPart(Math.round(entry.data.value), 'negative')
            : this.numberPart(0, 'negative'),
          this.textPart(' 点气血'),
        ];
      case 'buff_layer':
        return [
          target,
          this.textPart('调整'),
          mechanic(entry.data.name),
          this.textPart('层数'),
        ];
      case 'status_spread':
        return entry.data.detail === 'no_target'
          ? [target, this.textPart('没有可扩散目标')]
          : [target, this.textPart('扩散'), mechanic(mechanicName)];
      case 'named_trigger':
        if (entry.data.triggerBasis) {
          const basis = entry.data.triggerBasis;
          return [
            source,
            this.textPart('因'),
            target,
            this.textPart('的'),
            mechanic(basis.left.displayName),
            this.textPart('与本次'),
            mechanic(basis.right.displayName),
            this.textPart('发生'),
            mechanic(basis.relation.displayName),
            this.textPart('，触发'),
            mechanic(mechanicName),
          ];
        }
        return [source, this.textPart('触发'), mechanic(mechanicName)];
      case 'status_transition': {
        const previous = entry.data.previousDisplayName
          ? this.formatMechanicName(entry.data.previousDisplayName)
          : undefined;
        switch (entry.data.operation) {
          case 'apply':
            return [target, this.textPart('获得'), mechanic(mechanicName)];
          case 'refresh':
            return [
              target,
              this.textPart('的'),
              mechanic(mechanicName),
              this.textPart('持续时间刷新'),
            ];
          case 'replace':
            return [
              target,
              this.textPart('的'),
              mechanic(previous ?? '原状态'),
              this.textPart('转为'),
              mechanic(mechanicName),
            ];
          case 'consume':
            return [
              target,
              this.textPart('的'),
              mechanic(mechanicName),
              this.textPart('被消耗', 'negative'),
            ];
          default:
            return [
              target,
              this.textPart('的状态变为'),
              mechanic(mechanicName),
            ];
        }
      }
      default:
        return [target, this.textPart('触发'), mechanic(mechanicName)];
    }
  }

  private secondaryDamageParts(
    entries: Array<LogEntry<'damage'>>,
    source: 'follow_up' | 'counter' | 'reflect' | 'delayed',
  ): PresentedLogPart[][] {
    if (entries.length === 0) return [];
    const groups = new Map<string, Array<LogEntry<'damage'>>>();
    for (const entry of entries) {
      const entrySource = getLogEntrySource(entry);
      const key = [
        entrySource?.unitId ?? entrySource?.unitName ?? 'unknown',
        entrySource?.abilityId ??
          entrySource?.abilityName ??
          entrySource?.buffId ??
          entrySource?.buffName ??
          source,
        entry.data.targetName,
        entry.data.cause?.kind ?? '',
        entry.data.cause?.id ?? '',
      ].join('|');
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }

    return Array.from(groups.values()).map((group): PresentedLogPart[] => {
      const first = group[0];
      const firstSource = getLogEntrySource(first);
      const sourceName =
        firstSource?.unitName ?? first.data.reflectSourceName ?? '未知';
      const abilityName = firstSource?.abilityName ?? firstSource?.buffName;
      const totalDamage = group.reduce(
        (sum, entry) => sum + entry.data.value,
        0,
      );
      const totalShield = group.reduce(
        (sum, entry) => sum + (entry.data.shieldAbsorbed ?? 0),
        0,
      );
      const damageParts: PresentedLogPart[] = [];
      group.forEach((entry, index) => {
        if (index > 0) damageParts.push(this.textPart('、'));
        damageParts.push(...this.damageSegmentParts(entry));
      });
      if (group.length > 1) {
        damageParts.push(
          this.textPart('，合计'),
          this.numberPart(totalDamage, this.groupDamageTone(group), 'strong'),
          this.textPart(
            source === 'delayed' && first.data.cause ? '点持续伤害' : '点伤害',
          ),
        );
      } else {
        damageParts.push(
          this.textPart(
            source === 'delayed' && first.data.cause ? '点持续伤害' : '点伤害',
          ),
        );
      }
      if (totalShield > 0 && group.length > 1) {
        damageParts.push(
          this.textPart('，护盾共吸收'),
          this.numberPart(Math.round(totalShield), 'shield'),
          this.textPart('点'),
        );
      }

      if (source === 'follow_up') {
        if (first.data.cause) {
          return [
            this.unitPart(sourceName),
            this.textPart('因'),
            this.buffPart(first.data.cause.displayName, 'mechanic'),
            this.textPart('追加伤害，对'),
            this.unitPart(first.data.targetName),
            this.textPart('造成'),
            ...damageParts,
          ];
        }
        return [
          this.unitPart(sourceName),
          this.textPart('乘势追击，对', 'mechanic'),
          this.unitPart(first.data.targetName),
          this.textPart('造成'),
          ...damageParts,
        ];
      }
      if (source === 'counter') {
        return [
          this.unitPart(sourceName),
          ...(abilityName
            ? [
                this.textPart('触发'),
                this.buffPart(
                  abilityName,
                  firstSource?.abilityName ? 'mechanic' : 'secondary',
                ),
                this.textPart('反击', 'mechanic'),
              ]
            : [this.textPart('发动反击', 'mechanic')]),
          this.textPart('，对'),
          this.unitPart(first.data.targetName),
          this.textPart('造成'),
          ...damageParts,
        ];
      }
      if (source === 'delayed') {
        const buffName = firstSource?.buffName ?? '持续效果';
        const causeName = first.data.cause?.displayName;
        if (causeName) {
          return [
            this.buffPart(buffName, 'debuff'),
            this.textPart('受'),
            this.buffPart(causeName, 'mechanic'),
            this.textPart('引动，对'),
            this.unitPart(first.data.targetName),
            ...(group.length > 1
              ? [
                  this.textPart('立即结算'),
                  this.rawNumberPart(String(group.length), 'secondary'),
                  this.textPart('次：'),
                ]
              : [this.textPart('立即造成')]),
            ...damageParts,
          ];
        }
        return [
          this.buffPart(buffName, 'debuff'),
          this.textPart('对'),
          this.unitPart(first.data.targetName),
          this.textPart('造成'),
          ...damageParts,
        ];
      }
      return [
        this.unitPart(sourceName),
        this.textPart('反伤，对', 'mechanic'),
        this.unitPart(first.data.targetName),
        this.textPart('造成'),
        ...damageParts,
      ];
    });
  }

  private resourceStateParts(
    data: LogEntry<'resource_change'>['data'],
    overflow = 0,
  ): PresentedLogPart[] {
    return [
      this.textPart('（'),
      this.rawNumberPart(String(data.after), 'resource'),
      this.textPart('/'),
      this.rawNumberPart(String(data.resourceMax), 'resource'),
      ...(overflow > 0
        ? [
            this.textPart('，溢出'),
            this.numberPart(overflow, 'resource'),
            this.textPart('点'),
          ]
        : []),
      this.textPart('）'),
    ];
  }

  private resourceChangeParts(
    entry: LogEntry<'resource_change'>,
  ): PresentedLogPart[] {
    const data = entry.data;
    const applied = Math.abs(data.applied);
    const requested = Math.abs(data.requested);
    if (data.operation === 'decay') {
      return [
        this.resourcePart(data.resourceName),
        this.textPart('自然衰减'),
        this.numberPart(applied, 'negative'),
        this.textPart('点'),
        ...this.resourceStateParts(data),
      ];
    }
    if (data.operation === 'consume_all' || data.operation === 'subtract') {
      return [
        this.textPart('消耗'),
        this.numberPart(applied, 'negative'),
        this.textPart('点'),
        this.resourcePart(data.resourceName),
        ...this.resourceStateParts(data),
      ];
    }
    if (data.operation === 'set') {
      return [
        this.resourcePart(data.resourceName),
        this.textPart('调整为'),
        this.numberPart(data.after, 'resource'),
        this.textPart('点'),
        ...this.resourceStateParts(data),
      ];
    }
    if (applied === 0 && data.overflow > 0) {
      return [
        this.resourcePart(data.resourceName),
        this.textPart('已满'),
        ...this.resourceStateParts(data, data.overflow),
      ];
    }
    if (data.reason === 'refund') {
      return [
        this.textPart('返还'),
        this.numberPart(applied, 'positive'),
        this.textPart('点'),
        this.resourcePart(data.resourceName),
        ...this.resourceStateParts(data, data.overflow),
      ];
    }
    return [
      this.textPart('获得'),
      this.numberPart(applied || requested, 'positive'),
      this.textPart('点'),
      this.resourcePart(data.resourceName),
      ...this.resourceStateParts(data, data.overflow),
    ];
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

import { CombatLogResult, LogSpan } from './types';

/**
 * LogFormatter 职责：将 Span 或整场战斗结果格式化为不同输出。
 */
export interface LogFormatter {
  formatSpan(span: LogSpan): string;
  formatResult(result: CombatLogResult): string;
}

/**
 * 文本格式化器：生成人类可读的聚合文案。
 */
export class TextFormatter implements LogFormatter {
  formatSpan(span: LogSpan): string {
    const aggregated = this.tryAggregate(span);
    if (aggregated) {
      // 聚合成功：如果聚合文案已经包含主语或足够完整，则不再拼标题
      return aggregated;
    }

    // 无法聚合时，保留标题并在下方列出条目
    const lines: string[] = [span.title];
    for (const entry of span.entries) {
      lines.push(`  ${entry.message}`);
    }
    return lines.join('\n');
  }

  private tryAggregate(span: LogSpan): string | null {
    if (span.entries.length === 0) return null;

    const sourceName = span.source?.name || '未知单位';

    // 情况 1: action_pre (持续效果)
    if (span.type === 'action_pre') {
      const damageEntry = span.entries.find((e) => e.type === 'damage');
      if (damageEntry && damageEntry.data.sourceBuff) {
        let shieldSuffix = '';
        if (damageEntry.data.shieldAbsorbed > 0) {
          shieldSuffix = `（抵扣护盾 ${Math.round(damageEntry.data.shieldAbsorbed)} 点${damageEntry.data.remainShield <= 0 ? '，护盾已破碎' : ''}）`;
        }
        return `【持续】${sourceName} 身上的「${damageEntry.data.sourceBuff}」发作，受到 ${damageEntry.data.value} 点伤害${shieldSuffix}`;
      }
    }

    // 情况 2: action (主动行动)
    if (span.type === 'action') {
      const damageEntry = span.entries.find((e) => e.type === 'damage');
      const buffEntry = span.entries.find((e) => e.type === 'buff_apply');
      const dodgeEntry = span.entries.find((e) => e.type === 'dodge');
      const resistEntry = span.entries.find((e) => e.type === 'resist');
      const dispelEntry = span.entries.find((e) => e.type === 'dispel');

      const isBasicAttack = span.title.endsWith('行动');
      const actionDesc = isBasicAttack
        ? '发起攻击'
        : span.title.replace(sourceName + ' ', '');

      let result = `${sourceName} ${actionDesc}`;

      // 情况 2.1: 闪避/抵抗
      if (dodgeEntry) return `${result}，被目标闪避了！`;
      if (resistEntry) return `${result}，被目标抵抗了！`;

      // 情况 2.2: 伤害 + Buff
      let shieldSuffix = '';
      if (damageEntry && damageEntry.data.shieldAbsorbed > 0) {
        shieldSuffix = `（抵扣护盾 ${Math.round(damageEntry.data.shieldAbsorbed)} 点${damageEntry.data.remainShield <= 0 ? '，护盾已破碎' : ''}）`;
      }

      if (
        damageEntry &&
        buffEntry &&
        damageEntry.data.targetName === buffEntry.data.targetName
      ) {
        return `${result}，对 ${damageEntry.data.targetName} 造成 ${damageEntry.data.value} 点伤害${shieldSuffix}并施加「${buffEntry.data.buffName}」`;
      }

      // 情况 2.3: 只有伤害
      if (damageEntry && damageEntry.data.targetName) {
        return `${result}，对 ${damageEntry.data.targetName} 造成 ${damageEntry.data.value} 点伤害${shieldSuffix}`;
      }

      // 情况 2.4: 只有 Buff
      if (buffEntry && !damageEntry && buffEntry.data.targetName) {
        return `${result}，对 ${buffEntry.data.targetName} 施加了「${buffEntry.data.buffName}」`;
      }

      // 情况 2.5: 驱散
      if (dispelEntry && dispelEntry.data.buffs) {
        const buffsText = (dispelEntry.data.buffs as string[])
          .map((n) => `「${n}」`)
          .join('、');
        return `${result}，清除了目标身上的 ${buffsText}`;
      }
    }

    return null;
  }

  formatResult(result: CombatLogResult): string {
    const lines: string[] = [];

    let currentTurn = -1;
    for (const span of result.spans) {
      if (span.turn !== currentTurn) {
        currentTurn = span.turn;
        if (currentTurn === 0) {
          lines.push('【战斗准备】');
        } else {
          lines.push(`\n【第 ${currentTurn} 回合】`);
        }
      }

      lines.push(this.formatSpan(span));
    }

    return lines.join('\n');
  }
}

/**
 * JSON 格式化器：生成结构化 JSON 字符串。
 */
export class JsonFormatter implements LogFormatter {
  formatSpan(span: LogSpan): string {
    return JSON.stringify(span, null, 2);
  }

  formatResult(result: CombatLogResult): string {
    return JSON.stringify(result, null, 2);
  }
}

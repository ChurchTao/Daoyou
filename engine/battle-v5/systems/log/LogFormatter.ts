import { CombatLogResult, LogSpan, LogEntry } from './types';

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
    const lines: string[] = [];
    
    // Span 标题
    lines.push(span.title);
    
    // 尝试聚合条目
    const aggregated = this.tryAggregate(span);
    if (aggregated) {
      lines.push(`  ${aggregated}`);
    } else {
      // 无法聚合时，按顺序输出条目消息
      for (const entry of span.entries) {
        lines.push(`  ${entry.message}`);
      }
    }
    
    return lines.join('\n');
  }

  private tryAggregate(span: LogSpan): string | null {
    if (span.entries.length === 0) return null;

    // 情况 1: action_pre (持续效果)
    if (span.type === 'action_pre') {
      const damageEntry = span.entries.find(e => e.type === 'damage');
      if (damageEntry && damageEntry.data.sourceBuff) {
        let shieldSuffix = '';
        if (damageEntry.data.shieldAbsorbed > 0) {
          shieldSuffix = `（抵扣护盾 ${Math.round(damageEntry.data.shieldAbsorbed)} 点${damageEntry.data.remainShield <= 0 ? '，护盾已破碎' : ''}）`;
        }
        return `由于「${damageEntry.data.sourceBuff}」发作，${span.source?.name || '未知单位'} 受到 ${damageEntry.data.value} 点伤害${shieldSuffix}`;
      }
    }

    // 情况 2: 复合行动 (施法 + 伤害 + Buff)
    if (span.type === 'action') {
      const damageEntry = span.entries.find(e => e.type === 'damage');
      const buffEntry = span.entries.find(e => e.type === 'buff_apply');

      let shieldSuffix = '';
      if (damageEntry && damageEntry.data.shieldAbsorbed > 0) {
        shieldSuffix = `（抵扣护盾 ${Math.round(damageEntry.data.shieldAbsorbed)} 点${damageEntry.data.remainShield <= 0 ? '，护盾已破碎' : ''}）`;
      }

      if (damageEntry && buffEntry && damageEntry.data.targetName === buffEntry.data.targetName) {
        return `对 ${damageEntry.data.targetName} 造成 ${damageEntry.data.value} 点伤害${shieldSuffix}并施加「${buffEntry.data.buffName}」`;
      }

      // 情况 3: 只有伤害
      if (damageEntry && damageEntry.data.targetName) {
        return `对 ${damageEntry.data.targetName} 造成 ${damageEntry.data.value} 点伤害${shieldSuffix}`;
      }

      // 情况 4: 只有 Buff (例如施毒术等扣益技能)
      if (buffEntry && !damageEntry && buffEntry.data.targetName) {
        return `对 ${buffEntry.data.targetName} 施加了「${buffEntry.data.buffName}」`;
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

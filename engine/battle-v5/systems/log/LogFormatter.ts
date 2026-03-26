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
    const lines: string[] = [];
    
    // Span 标题
    lines.push(span.title);
    
    // 条目消息
    for (const entry of span.entries) {
      lines.push(`  ${entry.message}`);
    }
    
    return lines.join('\n');
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

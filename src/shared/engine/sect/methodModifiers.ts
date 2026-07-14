import { LINGXIAO_METHOD_BY_ID } from './lingxiao';
import type {
  CultivatorSectState,
  SectMethodModifierProjection,
} from './types';

/**
 * 心法属性的唯一数值投影入口。战斗与展示适配器必须共同消费此结果，
 * 避免面板、恢复与实战使用不同的心法收益。
 */
export function projectSectMethodModifiers(
  sect: CultivatorSectState | undefined,
): SectMethodModifierProjection[] {
  if (!sect || sect.status !== 'active' || sect.sectId !== 'lingxiao') return [];

  return Array.from(LINGXIAO_METHOD_BY_ID.values()).flatMap((method) => {
    const level = sect.methods[method.id] ?? 0;
    if (!method.modifierPerLevel || level <= 0) return [];

    return [{
      methodId: method.id,
      methodName: method.name,
      level,
      modifiers: [{
        ...method.modifierPerLevel,
        value: method.modifierPerLevel.value * level,
      }],
    }];
  });
}

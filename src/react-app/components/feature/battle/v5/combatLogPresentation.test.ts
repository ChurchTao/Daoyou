import type { PresentedLogPart } from '@shared/engine/battle-v5/systems/log/types';
import { getCombatLogPartClassName } from './combatLogPresentation';

describe('战斗日志语义样式映射', () => {
  it.each([
    ['damage-physical', 'text-battle-log-damage-physical'],
    ['damage-magical', 'text-battle-log-damage-magical'],
    ['damage-true', 'text-battle-log-damage-true'],
    ['damage-dot', 'text-battle-log-damage-dot'],
    ['positive', 'text-battle-log-positive'],
    ['negative', 'text-battle-log-negative'],
    ['shield', 'text-battle-log-shield'],
    ['resource', 'text-battle-log-resource'],
  ] as const)('%s 映射到对应语义令牌', (tone, expectedClass) => {
    const part: PresentedLogPart = {
      kind: 'number',
      text: '100',
      tone,
    };

    expect(getCombatLogPartClassName(part)).toContain(expectedClass);
    expect(getCombatLogPartClassName(part)).toContain('tabular-nums');
  });

  it('单位、技能和强调结果保留各自的排版职责', () => {
    expect(
      getCombatLogPartClassName({ kind: 'unit', text: '「张三」' }),
    ).toContain('font-medium');
    expect(
      getCombatLogPartClassName({
        kind: 'ability',
        text: '《火球术》',
        tone: 'ability',
      }),
    ).toContain('text-battle-log-ability');
    expect(
      getCombatLogPartClassName({
        kind: 'critical',
        text: '暴击',
        tone: 'critical',
        emphasis: 'strong',
      }),
    ).toContain('font-semibold');
  });
});

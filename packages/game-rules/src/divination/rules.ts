import {
  DivinationDiceSchema,
  type DivinationDice,
  type DivinationDirection,
} from '@daoyou/game-domain/divination';
import {
  DIVINATION_DIRECTIONS,
  DIVINATION_OMENS,
  SCATTERED_OMENS,
} from '@daoyou/game-content/divination';
import { QI_RESTORE_TALISMAN_SCENARIOS } from '@daoyou/game-content/qi/config';

import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';

export function resolveDivination(dice: DivinationDice) {
  const [a, b, c] = DivinationDiceSchema.parse(dice).sort(
    (left, right) => left - right,
  );
  const index =
    a === c
      ? a - 1
      : b === a + 1 && c === b + 1
        ? 6 + a - 1
        : a === b || b === c
          ? 10 + b - 1
          : SCATTERED_OMENS[`${a}${b}${c}`];
  const total = a + b + c;
  return {
    omen: DIVINATION_OMENS[index],
    total,
    rewardScenario:
      total === 18
        ? ('qi_restore_large' as const)
        : ('qi_restore_small' as const),
  };
}

export function divinationDayKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function fallbackDivination(
  direction: DivinationDirection,
  dice: DivinationDice,
) {
  const { omen } = resolveDivination(dice);
  const subject = DIVINATION_DIRECTIONS.find((item) => item.id === direction)!;
  return `「${omen.name}」：${omen.verse}\n\n${omen.meaning}你所问的是${subject.label}。${subject.advice}`;
}

export function divinationRewardFacts(dice: DivinationDice) {
  const { rewardScenario } = resolveDivination(dice);
  const reward = QI_RESTORE_TALISMAN_SCENARIOS[rewardScenario];
  return ConsumableFactsSchema.parse({
    name: reward.label,
    type: '符箓',
    quality: '凡品',
    description: `聚拢天地清气的符箓，使用后恢复${reward.amount}点天地灵气。`,
    spec: {
      kind: 'talisman',
      scenario: rewardScenario,
      sessionMode: 'consume_on_action',
    },
  });
}

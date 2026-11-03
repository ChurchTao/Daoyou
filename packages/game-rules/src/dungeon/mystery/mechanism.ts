import type { MysteryHintRule } from '@daoyou/game-domain/dungeon/mystery';

/** 机关错满此数即锁死。 */
export const MECHANISM_MAX_FAILURES = 3;

const ORDINAL = ['一', '二', '三'];

export function satisfiesHintRule(
  sequence: readonly string[],
  rule: MysteryHintRule,
): boolean {
  switch (rule.kind) {
    case 'position':
      return sequence[rule.index] === rule.part;
    case 'before': {
      const a = sequence.indexOf(rule.first);
      const b = sequence.indexOf(rule.then);
      return a >= 0 && b >= 0 && a < b;
    }
    case 'absent':
      return !sequence.includes(rule.part);
  }
}

/** 从 4 个部件中按次序选 3 个的全部 24 种组合。 */
export function mechanismSequences(partIds: readonly string[]): string[][] {
  const out: string[][] = [];
  for (const a of partIds)
    for (const b of partIds)
      for (const c of partIds)
        if (a !== b && b !== c && a !== c) out.push([a, b, c]);
  return out;
}

/** 满足全部提示规则的组合。规则恰好唯一确定解法时只剩一种。 */
export function mechanismCandidates(
  partIds: readonly string[],
  rules: readonly MysteryHintRule[],
): string[][] {
  return mechanismSequences(partIds).filter((seq) =>
    rules.every((rule) => satisfiesHintRule(seq, rule)),
  );
}

/** 提示规则的文字，由程序渲染，保证与解法一致。 */
export function renderHintRule(
  rule: MysteryHintRule,
  labelOf: (partId: string) => string,
): string {
  switch (rule.kind) {
    case 'position':
      return `${labelOf(rule.part)}居第${ORDINAL[rule.index]}`;
    case 'before':
      return `${labelOf(rule.first)}在${labelOf(rule.then)}之前`;
    case 'absent':
      return `${labelOf(rule.part)}不在其中`;
  }
}

/**
 * 为解法挑一组最少的提示规则（2–3 条），合起来恰好唯一确定解法。
 * `random` 决定候选的先后，同一随机序列总得到同一组规则。
 */
export function pickHintRules(
  partIds: readonly string[],
  solution: readonly string[],
  random: () => number,
): MysteryHintRule[] {
  const truths: MysteryHintRule[] = [
    ...solution.map((part, index) => ({
      kind: 'position' as const,
      part,
      index,
    })),
    ...solution.flatMap((first, i) =>
      solution
        .slice(i + 1)
        .map((then) => ({ kind: 'before' as const, first, then })),
    ),
    ...partIds
      .filter((p) => !solution.includes(p))
      .map((part) => ({ kind: 'absent' as const, part })),
  ];
  // 洗牌后按顺序找第一组能唯一确定的规则，优先两条。
  const pool = [...truths];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const unique = (rules: MysteryHintRule[]) =>
    mechanismCandidates(partIds, rules).length === 1;
  for (let a = 0; a < pool.length; a++)
    for (let b = a + 1; b < pool.length; b++)
      if (unique([pool[a]!, pool[b]!])) return [pool[a]!, pool[b]!];
  for (let a = 0; a < pool.length; a++)
    for (let b = a + 1; b < pool.length; b++)
      for (let c = b + 1; c < pool.length; c++)
        if (unique([pool[a]!, pool[b]!, pool[c]!]))
          return [pool[a]!, pool[b]!, pool[c]!];
  throw new Error('无法为机关找到唯一的提示组合');
}

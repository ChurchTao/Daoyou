import type {
  MysteryAnswers,
  MysteryCaseFile,
  MysteryResult,
  MysteryRewardTier,
  MysteryRunState,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';

export function mysteryTierForScore(total: number): MysteryRewardTier {
  if (total >= 90) return 'S';
  if (total >= 75) return 'A';
  if (total >= 60) return 'B';
  if (total >= 40) return 'C';
  return 'D';
}

/** 校验结案答案：线索题只能用已获得的线索作答。返回错误文案或 null。 */
export function checkMysteryAnswers(
  caseFile: MysteryCaseFile,
  template: MysteryScenarioTemplate,
  run: MysteryRunState,
  answers: MysteryAnswers,
): string | null {
  for (const tq of template.questions) {
    const answer = answers[tq.id];
    if (!answer) return `请回答：${tq.prompt}`;
    if (tq.answer_kind === 'npc' && !caseFile.npcs.some((n) => n.id === answer))
      return `${tq.prompt}：请选择一名人物`;
    if (tq.answer_kind === 'clue' && !run.clues.includes(answer))
      return `${tq.prompt}：只能以已掌握的线索作答`;
    if (tq.answer_kind === 'choice') {
      const q = caseFile.questions.find((x) => x.id === tq.id);
      if (!q?.options?.some((o) => o.id === answer))
        return `${tq.prompt}：请选择一个选项`;
    }
  }
  const extra = Object.keys(answers).find(
    (id) => !template.questions.some((q) => q.id === id),
  );
  return extra ? `未知的问题：${extra}` : null;
}

/**
 * 规则评分。放弃结案（answers 为空）时真相记零。
 * 效率分乘以真相正确率，避免不调查直接乱猜也能拿到效率分。
 */
export function scoreMysteryRun(
  caseFile: MysteryCaseFile,
  template: MysteryScenarioTemplate,
  run: MysteryRunState,
  answers: MysteryAnswers,
): MysteryResult {
  const weights = template.scoring;
  const correct: Record<string, boolean> = {};
  for (const q of caseFile.questions) correct[q.id] = answers[q.id] === q.answer;
  const truthRatio =
    caseFile.questions.length === 0
      ? 0
      : Object.values(correct).filter(Boolean).length / caseFile.questions.length;

  const keyClues = caseFile.clues.filter((c) => c.key);
  const keyCluesFound = keyClues.filter((c) => run.clues.includes(c.id)).length;
  const coverageRatio = keyClues.length === 0 ? 1 : keyCluesFound / keyClues.length;

  const efficiencyRatio = Math.min(
    1,
    Math.max(0, (run.actionsLeft / Math.max(1, run.actionBudget)) * 2),
  );

  const lieReactions = caseFile.npcs.flatMap((n) =>
    n.reactions.filter((r) => r.exposesLie).map((r) => r.id),
  );
  const branches = template.branches
    .filter((b) =>
      b.kind === 'flag'
        ? run.flags.includes(b.flag)
        : lieReactions.length > 0 &&
          lieReactions.every((id) => run.firedReactions.includes(id)),
    )
    .map((b) => b.id);
  const branchPoints = template.branches
    .filter((b) => branches.includes(b.id))
    .reduce((sum, b) => sum + b.points, 0);

  const breakdown = {
    truth: Math.round(weights.truth * truthRatio),
    coverage: Math.round(weights.coverage * coverageRatio),
    efficiency: Math.round(weights.efficiency * efficiencyRatio * truthRatio),
    branch: Math.min(weights.branch, branchPoints),
    // 首版解谜不含战斗，战斗权重按满分计入。
    combat: weights.combat,
  };
  const total =
    breakdown.truth +
    breakdown.coverage +
    breakdown.efficiency +
    breakdown.branch +
    breakdown.combat;
  return {
    answers,
    correct,
    breakdown,
    maxBreakdown: { ...weights },
    total,
    tier: mysteryTierForScore(total),
    branches,
    keyCluesFound,
    keyCluesTotal: keyClues.length,
  };
}

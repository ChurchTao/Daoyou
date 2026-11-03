import type {
  MysteryAnswers,
  MysteryCaseFile,
  MysteryConfrontationOutcome,
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
 * 结案后是否进入对决：模板配置了结尾对决，且 `finale.when` 中的问题全部答对
 * （如指认对真凶、找对藏处与法门）。答错时对方不会翻脸。返回对决的人物，否则 null。
 */
export function mysteryConfrontationTarget(
  caseFile: MysteryCaseFile,
  template: MysteryScenarioTemplate,
  answers: MysteryAnswers,
  run?: Pick<MysteryRunState, 'flags'>,
) {
  const finale = template.finale;
  if (!finale || finale.points <= 0) return null;
  // 保留身份：manifest 为异变化形；opposed 按抉择决定对手。
  const opposed = () => {
    const side = answers.side;
    if (side === 'side_a')
      return caseFile.npcs.find((n) => n.role === 'envoy_b');
    if (side === 'side_b')
      return caseFile.npcs.find((n) => n.role === 'envoy_a');
    // 调停只有揭穿了中间人才会与他摊牌，否则不起冲突。
    return run?.flags.includes('broker_exposed')
      ? caseFile.npcs.find((n) => n.role === 'broker')
      : undefined;
  };
  const target =
    finale.role === 'manifest'
      ? caseFile.manifest && {
          id: 'manifest',
          name: caseFile.manifest.name,
          role: 'manifest',
        }
      : finale.role === 'opposed'
        ? opposed()
        : caseFile.npcs.find((n) => n.role === finale.role);
  if (!target) return null;
  const solved = finale.when.every((id) => {
    const q = caseFile.questions.find((x) => x.id === id);
    return Boolean(q) && answers[id] === q!.answer;
  });
  return solved ? target : null;
}

/**
 * 战斗分：结尾对决战胜得 `finale.points`；其余按通过守卫（化解与击败同分）的比例计，
 * 没有守卫的案卷这部分按满额计。
 */
function combatPoints(
  template: MysteryScenarioTemplate,
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
  confrontation: MysteryConfrontationOutcome,
) {
  const finale = template.finale?.points ?? 0;
  const guardShare = template.scoring.combat - finale;
  const total = caseFile.guards?.length ?? 0;
  const passed = Math.min(total, run.passedGuards?.length ?? 0);
  return (
    (confrontation === 'won' ? finale : 0) +
    (total === 0 ? guardShare : Math.round((guardShare * passed) / total))
  );
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
  confrontation: MysteryConfrontationOutcome = 'none',
): MysteryResult {
  const weights = template.scoring;
  // 抉择题没有标准答案，不计对错。
  const judged = new Set(
    template.questions.filter((q) => q.judgement).map((q) => q.id),
  );
  const correct: Record<string, boolean> = {};
  for (const q of caseFile.questions)
    if (!judged.has(q.id)) correct[q.id] = answers[q.id] === q.answer;
  const truthRatio =
    Object.keys(correct).length === 0
      ? 0
      : Object.values(correct).filter(Boolean).length /
        Object.keys(correct).length;

  const keyClues = caseFile.clues.filter((c) => c.key);
  const keyCluesFound = keyClues.filter((c) => run.clues.includes(c.id)).length;
  const coverageRatio =
    keyClues.length === 0 ? 1 : keyCluesFound / keyClues.length;

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
    combat: combatPoints(template, caseFile, run, confrontation),
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
    ...(template.finale ? { confrontation } : {}),
    ...(caseFile.guards?.length
      ? {
          guards: {
            passed: run.passedGuards?.length ?? 0,
            total: caseFile.guards.length,
          },
        }
      : {}),
  };
}

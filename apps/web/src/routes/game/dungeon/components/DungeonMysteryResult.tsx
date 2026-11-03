import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';

const CONFRONTATION_LABELS = {
  won: '对决获胜，擒下对手',
  lost: '对决落败，对手脱逃',
  spared: '未曾出手，对手遁走',
  none: '未触发对决',
} as const;

const SCORE_LABELS = {
  truth: '真相',
  coverage: '线索',
  efficiency: '效率',
  branch: '分支',
  combat: '战斗',
} as const;

/** 结算时展示评分明细与真相，让玩家知道下次如何做得更好。 */
export function DungeonMysteryResult({
  result,
}: {
  result: NonNullable<MysteryPlayerView['result']>;
}) {
  const rows = (Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>)
    .filter((key) => result.maxBreakdown[key] > 0)
    .map((key) => ({
      key,
      label: SCORE_LABELS[key],
      value: result.breakdown[key],
      max: result.maxBreakdown[key],
    }));

  return (
    <div className="space-y-4">
      <div className="border-ink/15 border border-dashed p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-ink-secondary text-sm">推理评分</span>
          <span className="font-mono text-2xl font-semibold tracking-tight">
            {result.total}
            <span className="text-ink-secondary text-sm">/100</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          {rows.map((row) => (
            <div key={row.key} className="flex justify-between">
              <span className="text-ink-secondary">{row.label}</span>
              <span className="font-mono tracking-tight">
                {row.value}/{row.max}
              </span>
            </div>
          ))}
        </div>
        <p className="text-ink-secondary mt-2 text-sm">
          关键线索
          <span className="mx-1 font-mono">
            {result.keyCluesFound}/{result.keyCluesTotal}
          </span>
          {result.guards && (
            <span className="ml-3">
              守卫
              <span className="mx-1 font-mono">
                {result.guards.passed}/{result.guards.total}
              </span>
            </span>
          )}
          {result.confrontation && (
            <span className="ml-3">
              {CONFRONTATION_LABELS[result.confrontation]}
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {result.explanations.map((item) => {
          const correct = result.correct[item.questionId];
          return (
            <div
              key={item.questionId}
              className="border-ink/15 border px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{item.prompt}</span>
                {item.judgement ? (
                  <span className="text-ink-secondary">你的抉择</span>
                ) : (
                  <span className={correct ? 'text-wood' : 'text-crimson'}>
                    {correct ? '推断正确' : '推断有误'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm">
                {item.judgement ? '你选择：' : '答案：'}
                {item.answerLabel}
              </p>
              <p className="text-ink-secondary mt-1 text-sm leading-7">
                {item.explanation}
              </p>
            </div>
          );
        })}
      </div>

      <details className="border-ink/15 border px-3 py-2">
        <summary className="cursor-pointer text-sm">真相</summary>
        <p className="mt-2 text-sm leading-7">{result.truth}</p>
      </details>
    </div>
  );
}

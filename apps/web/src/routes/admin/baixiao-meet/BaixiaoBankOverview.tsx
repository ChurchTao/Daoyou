import {
  categoryLabels,
  difficultyLabels,
} from '@app/components/feature/baixiao/questionLabels';
import type { BaixiaoAdminView } from '@daoyou/contracts/baixiao/meet';
import { categories, difficulties } from './presentation';

const phases = {
  waiting: '待开场',
  open: '开放入场',
  closing: '入场截止',
  closed: '待封榜',
  settled: '已封榜',
  unavailable: '准备不足',
} satisfies Record<BaixiaoAdminView['phase'], string>;

export function BaixiaoRoundStatus({ data }: { data: BaixiaoAdminView }) {
  return (
    <section
      aria-label="当期赛况"
      className="border-ink/15 bg-paper-2 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-l-2 py-3 pr-3 pl-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold">当期赛况</h3>
        <span className="text-ink-secondary font-mono text-sm">
          {data.week}
        </span>
        <span
          className={
            data.phase === 'unavailable'
              ? 'text-crimson font-semibold'
              : 'text-ink font-semibold'
          }
        >
          {phases[data.phase]}
        </span>
      </div>
      <dl className="text-ink-secondary flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt>冻结题目</dt>
          <dd className="text-ink font-mono font-semibold">
            {data.frozenQuestions}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>典籍奖励池</dt>
          <dd className="text-ink font-mono font-semibold">{data.materials}</dd>
        </div>
      </dl>
    </section>
  );
}

export function BaixiaoBankOverview({ data }: { data: BaixiaoAdminView }) {
  const enabled = data.bank.filter(({ status }) => status === 'published');
  const counts = new Map<string, number>();
  for (const { category, difficulty } of enabled) {
    const key = `${category}:${difficulty}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const quotas = new Map(
    data.quotas.map((quota) => [
      `${quota.category}:${quota.difficulty}`,
      quota,
    ]),
  );
  const missing = data.quotas.filter(
    ({ available, count }) => available < count,
  ).length;
  return (
    <section aria-labelledby="baixiao-bank-overview" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="baixiao-bank-overview" className="text-lg font-semibold">
          题库统计
        </h3>
        <dl className="text-ink-secondary flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt>启用</dt>
            <dd className="text-ink font-mono text-base font-semibold">
              {enabled.length.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>停用</dt>
            <dd className="text-ink font-mono">
              {(data.bank.length - enabled.length).toLocaleString()}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>组卷配额</dt>
            <dd
              className={missing ? 'text-crimson font-semibold' : 'text-teal'}
            >
              {missing ? (
                <>
                  <b className="font-mono">{missing}</b> 项缺题
                </>
              ) : (
                '充足'
              )}
            </dd>
          </div>
        </dl>
      </div>
      <div
        className="border-ink/15 max-h-80 overflow-auto overscroll-contain border-y"
        role="region"
        aria-label="分类与难度分布"
        tabIndex={categories.length > 5 ? 0 : undefined}
      >
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[34%]" />
            {difficulties.map((difficulty) => (
              <col key={difficulty} />
            ))}
          </colgroup>
          <thead className="bg-paper-2 sticky top-0">
            <tr>
              <th scope="col" className="px-2 py-2 text-left sm:px-3">
                分类
              </th>
              {difficulties.map((difficulty) => (
                <th
                  scope="col"
                  key={difficulty}
                  className="px-1 py-2 text-left"
                >
                  {difficultyLabels[difficulty]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category} className="align-top">
                <th
                  scope="row"
                  className="border-ink/10 border-t px-2 py-2 text-left font-medium break-words sm:px-3"
                >
                  {categoryLabels[category]}
                </th>
                {difficulties.map((difficulty) => {
                  const key = `${category}:${difficulty}`;
                  const quota = quotas.get(key);
                  const short = quota && quota.available < quota.count;
                  const count = counts.get(key) ?? 0;
                  return (
                    <td
                      key={difficulty}
                      className="border-ink/10 border-t px-1 py-2"
                    >
                      <b
                        className={`font-mono ${count ? 'text-ink' : 'text-ink-secondary'}`}
                      >
                        {count.toLocaleString()}
                      </b>
                      {quota && (
                        <span
                          className={`block text-xs ${short ? 'text-crimson font-semibold' : 'text-ink-secondary'}`}
                        >
                          <span className="font-mono">
                            {quota.available}/{quota.count}
                          </span>
                          {short && ' 缺题'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-ink-secondary text-sm">
        主数字为启用题数。下方比例为可组卷题数／每卷需求，已计入是非题上限。
      </p>
    </section>
  );
}

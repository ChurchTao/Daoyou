import {
  categoryLabels,
  difficultyLabels,
} from '@app/components/feature/baixiao/questionLabels';
import { InkButton, InkInput, InkSelect } from '@app/components/ui';
import type { BaixiaoQuestionStatus } from '@daoyou/contracts/baixiao/meet';
import { useMemo, useState } from 'react';
import {
  categories,
  difficulties,
  statusLabels,
  type BankQuestion,
} from './presentation';

const pageSize = 50;
const initialFilters = { query: '', category: '', difficulty: '', status: '' };
const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\s]/gu, '');

function QuestionDetails({ item }: { item: BankQuestion }) {
  return (
    <details className="group min-w-0 flex-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-2 py-1.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-medium [overflow-wrap:anywhere]">
            {item.prompt}
          </span>
          <span className="text-ink-secondary mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
            <span>{categoryLabels[item.category]}</span>
            <span>{difficultyLabels[item.difficulty]}</span>
            <span>{item.kind === 'choice' ? '单选' : '是非'}</span>
            <span
              className={item.status === 'published' ? 'text-teal' : undefined}
            >
              {statusLabels[item.status]}
            </span>
          </span>
        </span>
        <span
          className="text-ink-secondary shrink-0 text-sm"
          aria-hidden="true"
        >
          <span className="group-open:hidden">展开</span>
          <span className="hidden group-open:inline">收起</span>
        </span>
      </summary>
      <div className="border-ink/10 space-y-3 border-t pt-3 pb-2 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          {item.options.map((option, index) => (
            <li
              key={option}
              className={
                index === item.correct ? 'text-teal font-semibold' : undefined
              }
            >
              {option}
              {index === item.correct && '（正确）'}
            </li>
          ))}
        </ol>
        <dl className="text-ink-secondary grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 [overflow-wrap:anywhere]">
          <dt>解析</dt>
          <dd>{item.explanation}</dd>
          <dt>出处</dt>
          <dd>{item.source}</dd>
          <dt>知识点</dt>
          <dd className="font-mono">{item.knowledgeKey}</dd>
        </dl>
      </div>
    </details>
  );
}

export function BaixiaoBankList({
  bank,
  pending,
  changeStatus,
}: {
  bank: BankQuestion[];
  pending: boolean;
  changeStatus: (
    ids: string[],
    status: BaixiaoQuestionStatus,
  ) => Promise<boolean>;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [checked, setChecked] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const tokens = filters.query
    .trim()
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean);
  const indexed = useMemo(
    () => bank.map((item) => ({ item, prompt: normalize(item.prompt) })),
    [bank],
  );
  const rows = indexed
    .filter(
      ({ item, prompt }) =>
        (!filters.category || item.category === filters.category) &&
        (!filters.difficulty || item.difficulty === filters.difficulty) &&
        (!filters.status || item.status === filters.status) &&
        tokens.every((token) => prompt.includes(token)),
    )
    .map(({ item }) => item);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(current * pageSize, (current + 1) * pageSize);
  const selected = visible.filter(({ id }) => checked.includes(id));
  const allSelected = visible.length > 0 && selected.length === visible.length;
  const filtered = Object.values(filters).some(Boolean);

  function updateFilters(next: typeof filters) {
    setFilters(next);
    setChecked([]);
    setPage(0);
  }

  function movePage(next: number) {
    setPage(next);
    setChecked([]);
  }

  async function applyStatus(status: BaixiaoQuestionStatus) {
    const ids = selected
      .filter((item) => item.status !== status)
      .map(({ id }) => id);
    if (ids.length > 0 && (await changeStatus(ids, status))) setChecked([]);
  }

  return (
    <section aria-labelledby="baixiao-bank-list" className="space-y-3">
      <h3 id="baixiao-bank-list" className="text-lg font-semibold">
        题目列表
      </h3>
      <div className="border-ink/15 bg-paper-2 grid grid-cols-2 items-end gap-3 border-y p-3 sm:grid-cols-[minmax(10rem,2fr)_minmax(7.5rem,1fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)]">
        <InkInput
          label="搜索题干"
          type="search"
          placeholder="输入题干关键词"
          containerClassName="col-span-2 min-w-0 sm:col-span-1"
          value={filters.query}
          onChange={(query) => updateFilters({ ...filters, query })}
        />
        <InkSelect
          label="分类"
          value={filters.category}
          onChange={(category) => updateFilters({ ...filters, category })}
        >
          <option value="">全部分类</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {categoryLabels[category]}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="难度"
          value={filters.difficulty}
          onChange={(difficulty) => updateFilters({ ...filters, difficulty })}
        >
          <option value="">全部难度</option>
          {difficulties.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficultyLabels[difficulty]}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="状态"
          value={filters.status}
          onChange={(status) => updateFilters({ ...filters, status })}
        >
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </InkSelect>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-3">
          {visible.length > 0 && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={pending}
                onChange={(event) =>
                  setChecked(
                    event.target.checked ? visible.map(({ id }) => id) : [],
                  )
                }
              />
              选中本页
            </label>
          )}
          <p role="status">
            找到 <b className="font-mono">{rows.length.toLocaleString()}</b> 题
          </p>
          {filtered && (
            <InkButton
              variant="secondary"
              className="min-h-11"
              onClick={() => updateFilters(initialFilters)}
            >
              清除筛选
            </InkButton>
          )}
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-ink-secondary">
              已选 <b className="font-mono">{selected.length}</b> 题
            </span>
            <InkButton
              disabled={
                pending || !selected.some(({ status }) => status === 'retired')
              }
              className="min-h-11"
              onClick={() => void applyStatus('published')}
            >
              恢复所选
            </InkButton>
            <InkButton
              disabled={
                pending ||
                !selected.some(({ status }) => status === 'published')
              }
              className="min-h-11"
              onClick={() => void applyStatus('retired')}
            >
              停用所选
            </InkButton>
          </div>
        )}
      </div>
      {visible.length ? (
        <ul className="divide-ink/15 border-ink/15 divide-y border-y">
          {visible.map((item) => (
            <li className="flex items-start gap-2 py-1 sm:gap-3" key={item.id}>
              <label className="flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center sm:w-11">
                <input
                  type="checkbox"
                  checked={checked.includes(item.id)}
                  disabled={pending}
                  aria-label={`选中 ${item.prompt}`}
                  onChange={(event) =>
                    setChecked(
                      event.target.checked
                        ? [...checked, item.id]
                        : checked.filter((id) => id !== item.id),
                    )
                  }
                />
              </label>
              <QuestionDetails item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-ink/15 text-ink-secondary border-y py-5 text-center text-sm">
          {bank.length ? '没有符合当前筛选的题目。' : '题库暂无题目。'}
        </p>
      )}
      {pageCount > 1 && (
        <nav
          aria-label="题库分页"
          className="flex items-center justify-end gap-3"
        >
          <InkButton
            className="min-h-11"
            disabled={current === 0}
            onClick={() => movePage(current - 1)}
          >
            上一页
          </InkButton>
          <span className="font-mono text-sm">
            {current + 1} / {pageCount}
          </span>
          <InkButton
            className="min-h-11"
            disabled={current + 1 === pageCount}
            onClick={() => movePage(current + 1)}
          >
            下一页
          </InkButton>
        </nav>
      )}
    </section>
  );
}

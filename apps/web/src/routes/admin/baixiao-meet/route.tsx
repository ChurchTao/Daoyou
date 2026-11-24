import { InkButton, InkNotice } from '@app/components/ui';
import { baixiaoPost, requestBaixiao } from '@app/lib/api/baixiao';
import type {
  BaixiaoAdminView,
  BaixiaoImportResult,
  BaixiaoQuestionStatus,
} from '@daoyou/contracts/baixiao/meet';
import { BaixiaoImportSchema } from '@daoyou/contracts/baixiao/meet';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';
import { BaixiaoPractice } from './BaixiaoPractice';

const endpoint = '/api/admin/baixiao-meet';
const categories = {
  literature: '文学与文史',
  history: '历史地理',
  riddle: '脑洞与谜语',
};
const difficulties = { easy: '易', medium: '中', hard: '难' };
const states = { published: '启用', retired: '停用' };
const PAGE_SIZE = 50;
const phases = {
  waiting: '待开场',
  open: '开放入场',
  closing: '入场截止',
  closed: '待封榜',
  settled: '已封榜',
  unavailable: '准备不足',
};
const template = JSON.stringify(
  {
    questions: [
      {
        knowledgeKey: 'example-unique-key',
        category: 'literature',
        difficulty: 'medium',
        kind: 'choice',
        prompt: '题干',
        options: ['正确选项', '干扰项甲', '干扰项乙', '干扰项丙'],
        correct: 0,
        explanation: '答案解析',
        source: '原典或资料出处',
      },
    ],
  },
  null,
  2,
);

export default function BaixiaoAdminRoute() {
  const [data, setData] = useState<BaixiaoAdminView | null>(null);
  const [bulk, setBulk] = useState('');
  const [filter, setFilter] = useState<BaixiaoQuestionStatus | 'all'>('all');
  const [checked, setChecked] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    void requestBaixiao<BaixiaoAdminView>(endpoint, { signal: request.signal })
      .then((result) => {
        if (!request.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (!request.signal.aborted)
          setError(cause instanceof Error ? cause.message : '题库读取失败。');
      });
    return () => request.abort();
  }, []);

  async function submit(action: 'import' | 'status', body: object) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'import') {
        const result = await requestBaixiao<BaixiaoImportResult>(
          `${endpoint}/import`,
          baixiaoPost(body),
        );
        setBulk('');
        setFilter('published');
        setNotice(
          `已导入并启用 ${result.inserted} 题，跳过 ${result.skipped} 道已有启用题。`,
        );
        setData(await requestBaixiao<BaixiaoAdminView>(endpoint));
      } else {
        setData(
          await requestBaixiao<BaixiaoAdminView>(
            `${endpoint}/status`,
            baixiaoPost(body),
          ),
        );
      }
      setChecked([]);
      setPage(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '题库操作失败。');
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file: File) {
    setBusy(true);
    setError('');
    setBulk('');
    try {
      setBulk(await file.text());
    } catch {
      setError('读取题库文件失败。');
    } finally {
      setBusy(false);
    }
  }

  function importQuestions() {
    try {
      const candidate: unknown = JSON.parse(bulk);
      const parsed = BaixiaoImportSchema.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        setError(`${issue.path.join('.')} ${issue.message}`);
        return;
      }
      void submit('import', parsed.data);
    } catch {
      setError('请提交有效的 JSON。');
    }
  }

  const rows =
    data?.bank.filter(
      (question) => filter === 'all' || question.status === filter,
    ) ?? [];
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="百晓盛会题库"
        description="导入的题目立即启用。已经冻结的当期题卷继续使用原题。"
      />
      {error && <InkNotice>{error}</InkNotice>}
      {notice && (
        <p role="status" className="text-teal text-sm">
          {notice}
        </p>
      )}
      {data && (
        <>
          <BaixiaoPractice bank={data.bank} />
          <section className="border-ink/20 space-y-3 border-b pb-4">
            <h2 className="font-semibold">{data.week} 当期赛况</h2>
            <p>
              {phases[data.phase]} · 已冻结 {data.frozenQuestions} 题 ·
              典籍奖励池 {data.materials} 件
            </p>
            <ul className="grid gap-2 text-sm sm:grid-cols-3">
              {data.quotas.map(({ category, difficulty, available, count }) => (
                <li key={`${category}:${difficulty}`}>
                  {categories[category]} · {difficulties[difficulty]}{' '}
                  <b
                    className={`font-mono ${available < count ? 'text-crimson' : ''}`}
                  >
                    {available} / {count}
                  </b>
                </li>
              ))}
            </ul>
            <p className="text-ink-secondary text-sm">
              各格为可用题数／每卷需求，已计入是非题上限。
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">批量导入</h2>
            <p className="text-ink-secondary text-sm">
              每批最多 350 题，可选择 JSON 文件或粘贴内容。正确项从 0 编号。
            </p>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="选择题库 JSON 文件"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = '';
              }}
            />
            <textarea
              aria-label="题库 JSON"
              className="border-ink/20 bg-paper w-full resize-y border p-3 font-mono text-sm"
              rows={7}
              placeholder={template}
              value={bulk}
              onChange={(event) => setBulk(event.target.value)}
            />
            <InkButton
              pending={busy}
              disabled={!bulk.trim()}
              onClick={importQuestions}
            >
              批量导入
            </InkButton>
          </section>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">题库（{rows.length}）</h2>
              <select
                aria-label="题目状态"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as typeof filter);
                  setChecked([]);
                  setPage(0);
                }}
                className="border-ink/20 bg-paper border p-2"
              >
                <option value="all">全部</option>
                {Object.entries(states).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <InkButton
                disabled={busy || !checked.length}
                onClick={() =>
                  void submit('status', { ids: checked, status: 'published' })
                }
              >
                恢复所选
              </InkButton>
              <InkButton
                disabled={busy || !checked.length}
                onClick={() =>
                  void submit('status', { ids: checked, status: 'retired' })
                }
              >
                停用所选
              </InkButton>
            </div>
            <ul className="divide-ink/15 border-ink/15 divide-y border-y">
              {rows
                .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                .map((item) => (
                  <li className="flex items-start gap-3 py-2.5" key={item.id}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked.includes(item.id)}
                      aria-label={`选中 ${item.prompt}`}
                      onChange={(event) =>
                        setChecked((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer">
                        {item.prompt}{' '}
                        <span className="text-ink-secondary text-sm">
                          · {states[item.status]}
                        </span>
                      </summary>
                      <div className="mt-2 space-y-1 text-sm">
                        <p>
                          {categories[item.category]} ·{' '}
                          {difficulties[item.difficulty]} · {item.knowledgeKey}
                        </p>
                        <ol className="list-decimal pl-5">
                          {item.options.map((option, index) => (
                            <li
                              key={option}
                              className={
                                index === item.correct
                                  ? 'text-teal font-semibold'
                                  : ''
                              }
                            >
                              {option}
                              {index === item.correct && '（正确）'}
                            </li>
                          ))}
                        </ol>
                        <p>{item.explanation}</p>
                        <p className="text-ink-secondary">{item.source}</p>
                      </div>
                    </details>
                  </li>
                ))}
            </ul>
            {rows.length > PAGE_SIZE && (
              <nav aria-label="题库分页" className="flex items-center gap-3">
                <InkButton
                  disabled={page === 0}
                  onClick={() => {
                    setPage(page - 1);
                    setChecked([]);
                  }}
                >
                  上一页
                </InkButton>
                <span className="font-mono">
                  {page + 1} / {Math.ceil(rows.length / PAGE_SIZE)}
                </span>
                <InkButton
                  disabled={(page + 1) * PAGE_SIZE >= rows.length}
                  onClick={() => {
                    setPage(page + 1);
                    setChecked([]);
                  }}
                >
                  下一页
                </InkButton>
              </nav>
            )}
          </section>
        </>
      )}
    </div>
  );
}

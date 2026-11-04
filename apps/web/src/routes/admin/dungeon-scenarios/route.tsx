import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { InkTabs } from '@app/components/ui/InkTabs';
import { InkTag } from '@app/components/ui/InkTag';
import { apiFetch } from '@app/lib/api/fetch';
import type {
  AdminDungeonEnqueueResult,
  AdminDungeonJob,
  AdminDungeonJobList,
  AdminDungeonScenarioDetail,
  AdminDungeonScenarioList,
  AdminDungeonSlotsView,
} from '@daoyou/contracts/admin/dungeon-scenarios';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';

type Tab = 'slots' | 'library' | 'jobs';

const JOB_STATUS = {
  queued: '排队',
  running: '生成中',
  succeeded: '成功',
  failed: '失败',
} as const;

const JOB_REASON: Record<string, string> = {
  exhausted: '玩家玩完',
  low_stock: '库存偏低',
  cold_start: '冷启动',
  warmup: '预热',
  admin: '后台投递',
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    cache: 'no-store',
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init?.headers,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? '请求失败');
  return payload.data as T;
}

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const enqueueMessage = (r: AdminDungeonEnqueueResult) =>
  r.skipped > 0
    ? `已投递 ${r.enqueued} 个任务，${r.skipped} 个因所在节点队列已满跳过（待生成 ${r.pendingTotal}）。`
    : `已投递 ${r.enqueued} 个任务（待生成 ${r.pendingTotal}）。`;

export default function DungeonScenariosRoute() {
  const [tab, setTab] = useState<Tab>('slots');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<string>) => {
    setError('');
    setMessage('');
    try {
      setMessage(await action());
      setRefresh((n) => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败');
    }
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="云游剧本管理"
        description="解谜副本剧本库的库存、剧本与生成任务。停用只是不再被选中，不删除。"
        actions={
          <InkButton onClick={() => setRefresh((n) => n + 1)}>刷新</InkButton>
        }
      />
      <InkTabs
        items={[
          { value: 'slots', label: '库存总览' },
          { value: 'library', label: '剧本库' },
          { value: 'jobs', label: '生成任务' },
        ]}
        activeValue={tab}
        onChange={(value) => setTab(value as Tab)}
      />
      {message ? <InkNotice tone="info">{message}</InkNotice> : null}
      {error ? <InkNotice tone="danger">{error}</InkNotice> : null}

      {tab === 'slots' ? (
        <SlotsTab refresh={refresh} run={run} onError={setError} />
      ) : tab === 'library' ? (
        <LibraryTab refresh={refresh} onOpen={setDetailId} onError={setError} />
      ) : (
        <JobsTab refresh={refresh} run={run} onError={setError} />
      )}

      <ScenarioDetail
        id={detailId}
        refresh={refresh}
        onClose={() => setDetailId(null)}
        run={run}
        onError={setError}
      />
    </div>
  );
}

type Run = (action: () => Promise<string>) => Promise<void>;

function useLoad<T>(
  path: string | null,
  refresh: number,
  onError: (message: string) => void,
) {
  const key = path ? `${path}#${refresh}` : null;
  // 记下已加载完成的请求键；与当前键不同即在加载中。
  const [state, setState] = useState<{ key: string | null; data: T | null }>({
    key: null,
    data: null,
  });
  useEffect(() => {
    if (!path || !key) return;
    let cancelled = false;
    request<T>(path)
      .then((data) => !cancelled && setState({ key, data }))
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, key }));
        onError(cause instanceof Error ? cause.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [path, key, onError]);
  return { data: state.data, loading: key !== null && state.key !== key };
}

/** 列表分页：只有一页时不显示。 */
function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <InkButton
        variant="ghost"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </InkButton>
      <span className="font-mono">
        {page} / {pages}
      </span>
      <InkButton
        variant="ghost"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </InkButton>
    </div>
  );
}

function SlotsTab({
  refresh,
  run,
  onError,
}: {
  refresh: number;
  run: Run;
  onError: (message: string) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, loading } = useLoad<AdminDungeonSlotsView>(
    `/api/admin/dungeon-scenarios/slots?page=${page}`,
    refresh,
    onError,
  );
  if (!data) return <p className="text-ink-secondary text-sm">加载中……</p>;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-ink-secondary">
          生成版本 <span className="font-mono">{data.generatorVersion}</span> ·
          库存位 <span className="font-mono">{data.total}</span>
          ，空位 <span className="font-mono">{data.emptyTotal}</span> · 待生成{' '}
          <span className="font-mono">{data.pendingTotal}</span>
          （每节点最多{' '}
          <span className="font-mono">{data.maxPendingPerNode}</span>
          ，节点间并发）
        </span>
        <InkButton
          variant="primary"
          disabled={loading}
          onClick={() =>
            void run(async () =>
              enqueueMessage(
                await request<AdminDungeonEnqueueResult>(
                  '/api/admin/dungeon-scenarios/warmup',
                  {
                    method: 'POST',
                    body: JSON.stringify({ perSlot: data.warmupPerSlot }),
                  },
                ),
              ),
            )
          }
        >
          全部预热到 {data.warmupPerSlot} 本
        </InkButton>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-ink-secondary border-ink/15 border-b">
            <tr>
              <th className="py-2 pr-3 font-normal">节点</th>
              <th className="py-2 pr-3 font-normal">案型</th>
              <th className="py-2 pr-3 font-normal">在用</th>
              <th className="py-2 pr-3 font-normal">排队／生成中</th>
              <th className="py-2 pr-3 font-normal">最近失败</th>
              <th className="py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {data.slots.map((slot) => (
              <tr
                key={`${slot.mapNodeId}|${slot.templateId}`}
                className="border-ink/10 border-b"
              >
                <td className="py-2 pr-3">{slot.nodeName}</td>
                <td className="py-2 pr-3">{slot.templateName}</td>
                <td
                  className={`py-2 pr-3 font-mono ${
                    slot.active < data.warmupPerSlot ? 'text-crimson' : ''
                  }`}
                >
                  {slot.active}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {slot.queued} / {slot.running}
                </td>
                <td
                  className="text-ink-secondary max-w-[240px] truncate py-2 pr-3"
                  title={slot.lastFailure?.error ?? undefined}
                >
                  {slot.lastFailure
                    ? `${day(slot.lastFailure.at)} ${slot.lastFailure.error ?? ''}`
                    : '—'}
                </td>
                <td className="py-2 text-right">
                  <InkButton
                    variant="ghost"
                    onClick={() =>
                      void run(async () =>
                        enqueueMessage(
                          await request<AdminDungeonEnqueueResult>(
                            '/api/admin/dungeon-scenarios/restock',
                            {
                              method: 'POST',
                              body: JSON.stringify({
                                mapNodeId: slot.mapNodeId,
                                templateId: slot.templateId,
                              }),
                            },
                          ),
                        ),
                      )
                    }
                  >
                    补一本
                  </InkButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={data.page}
        total={data.total}
        pageSize={data.pageSize}
        onChange={setPage}
      />
    </section>
  );
}

function LibraryTab({
  refresh,
  onOpen,
  onError,
}: {
  refresh: number;
  onOpen: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [filters, setFilters] = useState({
    templateId: '',
    status: 'active',
    source: '',
    page: 1,
  });
  // 只取筛选项：节点与案型取自全部库存位，与页码无关。
  const { data: slots } = useLoad<AdminDungeonSlotsView>(
    '/api/admin/dungeon-scenarios/slots?page=1',
    0,
    onError,
  );
  const [mapNodeId, setMapNodeId] = useState('');
  const query = new URLSearchParams(
    Object.entries({ ...filters, mapNodeId, page: String(filters.page) })
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
  const { data, loading } = useLoad<AdminDungeonScenarioList>(
    `/api/admin/dungeon-scenarios?${query}`,
    refresh,
    onError,
  );
  const set = (patch: Partial<typeof filters>) =>
    setFilters((prev) => ({ ...prev, page: 1, ...patch }));

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <InkSelect
          label="节点"
          value={mapNodeId}
          onChange={(value) => {
            setMapNodeId(value);
            set({});
          }}
        >
          <option value="">全部</option>
          {(slots?.nodes ?? []).map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="案型"
          value={filters.templateId}
          onChange={(value) => set({ templateId: value })}
        >
          <option value="">全部</option>
          {(slots?.templates ?? []).map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="状态"
          value={filters.status}
          onChange={(value) => set({ status: value })}
        >
          <option value="">全部</option>
          <option value="active">在用</option>
          <option value="retired">停用</option>
        </InkSelect>
        <InkSelect
          label="来源"
          value={filters.source}
          onChange={(value) => set({ source: value })}
        >
          <option value="">全部</option>
          <option value="generated">生成</option>
          <option value="seed">保底</option>
        </InkSelect>
      </div>
      <p className="text-ink-secondary text-sm">
        共 <span className="font-mono">{data?.total ?? 0}</span> 本
        {loading ? '，加载中……' : ''}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-ink-secondary border-ink/15 border-b">
            <tr>
              <th className="py-2 pr-3 font-normal">标题</th>
              <th className="py-2 pr-3 font-normal">节点·案型</th>
              <th className="py-2 pr-3 font-normal">变体</th>
              <th className="py-2 pr-3 font-normal">版本</th>
              <th className="py-2 pr-3 font-normal">审校</th>
              <th className="py-2 pr-3 font-normal">游玩／完成</th>
              <th className="py-2 pr-3 font-normal">均分</th>
              <th className="py-2 pr-3 font-normal">创建</th>
              <th className="py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id} className="border-ink/10 border-b">
                <td className="py-2 pr-3">
                  {row.title}
                  {row.status === 'retired' ? (
                    <InkTag className="ml-2" tone="neutral">
                      停用
                    </InkTag>
                  ) : null}
                  {row.source === 'seed' ? (
                    <InkTag className="ml-2" tone="neutral">
                      保底
                    </InkTag>
                  ) : null}
                </td>
                <td className="text-ink-secondary py-2 pr-3">
                  {row.nodeName}·{row.templateName}
                </td>
                <td className="py-2 pr-3 font-mono">{row.variant}</td>
                <td className="py-2 pr-3 font-mono">{row.generatorVersion}</td>
                <td className="py-2 pr-3 font-mono">{row.reviewIssueCount}</td>
                <td className="py-2 pr-3 font-mono">
                  {row.playCount} / {row.completionCount}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {row.averageScore ?? '—'}
                </td>
                <td className="text-ink-secondary py-2 pr-3">
                  {day(row.createdAt)}
                </td>
                <td className="py-2 text-right">
                  <InkButton variant="ghost" onClick={() => onOpen(row.id)}>
                    详情
                  </InkButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data ? (
        <Pager
          page={filters.page}
          total={data.total}
          pageSize={data.pageSize}
          onChange={(page) => setFilters((p) => ({ ...p, page }))}
        />
      ) : null}
    </section>
  );
}

function JobsTab({
  refresh,
  run,
  onError,
}: {
  refresh: number;
  run: Run;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading } = useLoad<AdminDungeonJobList>(
    `/api/admin/dungeon-scenarios/jobs?${new URLSearchParams({
      page: String(page),
      ...(status ? { status } : {}),
    })}`,
    refresh,
    onError,
  );
  const duration = (job: AdminDungeonJob) =>
    job.startedAt && job.finishedAt
      ? `${Math.round(
          (Date.parse(job.finishedAt) - Date.parse(job.startedAt)) / 1000,
        )} 秒`
      : '—';
  return (
    <section className="space-y-4">
      <div className="max-w-xs">
        <InkSelect
          label="状态"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <option value="">全部</option>
          {Object.entries(JOB_STATUS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </InkSelect>
      </div>
      <p className="text-ink-secondary text-sm">
        共 <span className="font-mono">{data?.total ?? 0}</span> 条
        {loading ? '，加载中……' : ''}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-ink-secondary border-ink/15 border-b">
            <tr>
              <th className="py-2 pr-3 font-normal">节点·案型</th>
              <th className="py-2 pr-3 font-normal">原因</th>
              <th className="py-2 pr-3 font-normal">状态</th>
              <th className="py-2 pr-3 font-normal">尝试</th>
              <th className="py-2 pr-3 font-normal">耗时</th>
              <th className="py-2 pr-3 font-normal">创建</th>
              <th className="py-2 pr-3 font-normal">报错</th>
              <th className="py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((job) => (
              <tr key={job.id} className="border-ink/10 border-b">
                <td className="py-2 pr-3">
                  {job.nodeName}·{job.templateName}
                </td>
                <td className="text-ink-secondary py-2 pr-3">
                  {JOB_REASON[job.reason] ?? job.reason}
                </td>
                <td
                  className={`py-2 pr-3 ${
                    job.status === 'failed' ? 'text-crimson' : ''
                  }`}
                >
                  {JOB_STATUS[job.status]}
                </td>
                <td className="py-2 pr-3 font-mono">{job.attempts}</td>
                <td className="py-2 pr-3 font-mono">{duration(job)}</td>
                <td className="text-ink-secondary py-2 pr-3">
                  {day(job.createdAt)}
                </td>
                <td
                  className="text-ink-secondary max-w-[260px] truncate py-2 pr-3"
                  title={job.error ?? undefined}
                >
                  {job.error ?? '—'}
                </td>
                <td className="py-2 text-right">
                  {job.status === 'failed' ? (
                    <InkButton
                      variant="ghost"
                      onClick={() =>
                        void run(async () => {
                          await request(
                            `/api/admin/dungeon-scenarios/jobs/${job.id}/retry`,
                            { method: 'POST' },
                          );
                          return '任务已重新排队。';
                        })
                      }
                    >
                      重试
                    </InkButton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data ? (
        <Pager
          page={data.page}
          total={data.total}
          pageSize={data.pageSize}
          onChange={setPage}
        />
      ) : null}
    </section>
  );
}

function ScenarioDetail({
  id,
  refresh,
  onClose,
  run,
  onError,
}: {
  id: string | null;
  refresh: number;
  onClose: () => void;
  run: Run;
  onError: (message: string) => void;
}) {
  const { data } = useLoad<AdminDungeonScenarioDetail>(
    id ? `/api/admin/dungeon-scenarios/${id}` : null,
    refresh,
    onError,
  );
  const shown = data && data.id === id ? data : null;
  const c = shown?.caseFile;
  const nameOf = (npcId: string) =>
    c?.npcs.find((n) => n.id === npcId)?.name ?? npcId;
  const labelOf = (questionId: string, answer: string) =>
    c?.questions
      .find((q) => q.id === questionId)
      ?.options?.find((o) => o.id === answer)?.label ?? nameOf(answer);
  const roleOf = (role: string) => shown?.labels.roles[role] ?? role;
  const promptOf = (questionId: string) =>
    shown?.labels.questions[questionId] ?? questionId;
  const liars = c?.npcs.filter((n) => n.reactions.some((r) => r.exposesLie));

  return (
    <InkDetailDrawer
      isOpen={id !== null}
      onClose={onClose}
      size="lg"
      title={shown?.title ?? '剧本详情'}
      description={
        shown
          ? `${shown.nodeName} · ${shown.templateName} · 变体 ${shown.variant} · 版本 ${shown.generatorVersion}`
          : undefined
      }
      footer={
        shown ? (
          <InkButton
            variant={shown.status === 'active' ? 'secondary' : 'primary'}
            onClick={() =>
              void run(async () => {
                const next = shown.status === 'active' ? 'retired' : 'active';
                await request(
                  `/api/admin/dungeon-scenarios/${shown.id}/status`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ status: next }),
                  },
                );
                return next === 'retired'
                  ? '已停用：之后不会再被选中。'
                  : '已恢复为在用。';
              })
            }
          >
            {shown.status === 'active' ? '停用此本' : '恢复在用'}
          </InkButton>
        ) : null
      }
    >
      {!c ? (
        <p className="text-ink-secondary text-sm">加载中……</p>
      ) : (
        <div className="space-y-5 text-sm leading-7">
          <p className="text-ink-secondary">
            游玩 {shown.playCount} · 完成 {shown.completionCount} · 均分{' '}
            {shown.averageScore ?? '—'} · 审校问题 {shown.reviewIssueCount} ·
            创建 {day(shown.createdAt)}
            {shown.retiredAt ? ` · 停用 ${day(shown.retiredAt)}` : ''}
          </p>
          <section>
            <h4 className="font-semibold">真相</h4>
            <p>{c.truth}</p>
          </section>
          <section>
            <h4 className="font-semibold">开场</h4>
            <p>{c.brief.opening}</p>
          </section>
          <section>
            <h4 className="font-semibold">人物</h4>
            <ul className="space-y-1">
              {c.npcs.map((n) => (
                <li key={n.id}>
                  <span className="font-semibold">{n.name}</span>
                  <span className="text-ink-secondary">
                    {' '}
                    · {n.title} · {roleOf(n.role)}
                    {n.portrait ? ` · 立绘 ${n.portrait}` : ''}
                    {liars?.some((l) => l.id === n.id) ? ' · 说谎者' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="font-semibold">结案题</h4>
            <ul className="space-y-1">
              {c.questions.map((q) => (
                <li key={q.id}>
                  <span className="text-ink-secondary">{promptOf(q.id)}：</span>
                  {labelOf(q.id, q.answer)}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="font-semibold">关键线索</h4>
            <ul className="space-y-1">
              {c.clues
                .filter((x) => x.key)
                .map((x) => (
                  <li key={x.id}>
                    <span className="font-semibold">{x.name}</span>
                    <span className="text-ink-secondary">
                      {' '}
                      → {x.supports.map(promptOf).join('、') || '—'}
                    </span>
                    <div className="text-ink-secondary">{x.text}</div>
                  </li>
                ))}
            </ul>
          </section>
          {c.guards?.length || c.events?.length ? (
            <section>
              <h4 className="font-semibold">守卫与事件</h4>
              <ul className="space-y-1">
                {(c.guards ?? []).map((g) => (
                  <li key={g.id}>守卫：{g.name}</li>
                ))}
                {(c.events ?? []).map((e) => (
                  <li key={e.id}>
                    事件 {e.id}（第 {e.warnAt} 回合预兆，第 {e.at} 回合发生）：
                    {e.text}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </InkDetailDrawer>
  );
}

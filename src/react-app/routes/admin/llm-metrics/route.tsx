import { InkButton, InkSelect } from '@app/components/ui';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useEffect, useMemo, useState } from 'react';

type LlmMetricsSummaryRow = {
  key: string;
  label: string;
  calls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number;
  avgSystemChars: number;
  avgUserChars: number;
  avgSchemaChars: number;
  avgRetryCount: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
    cacheWriteInputTokens: number;
  };
  cacheHitCalls: number;
  cacheObservedCalls: number;
  cacheHitCallRate: number | null;
  cacheCoverageRate: number | null;
};

type LlmCallMetricEvent = {
  recordedAt: string;
  sceneId: string;
  provider: string;
  model: string;
  systemChars: number;
  userChars: number;
  schemaChars: number;
  retryCount: number;
  usage: Record<string, number>;
  status: 'success' | 'failure';
};

type LlmMetricsSnapshot = {
  source: 'redis' | 'memory';
  generatedAt: string;
  oldestRecordedAt: string | null;
  latestRecordedAt: string | null;
  usageKeys: string[];
  sceneIds: string[];
  overview: LlmMetricsSummaryRow;
  scenes: LlmMetricsSummaryRow[];
  recentCalls: LlmCallMetricEvent[];
};

type MetricsResponse = {
  success?: boolean;
  error?: string;
  data?: LlmMetricsSnapshot;
};

function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '暂无';
  return new Date(value).toLocaleString();
}

function formatUsage(usage: Record<string, number>): string {
  const entries = Object.entries(usage);
  if (entries.length === 0) return '无';
  return entries.map(([key, value]) => `${key}:${value}`).join(' / ');
}

function SummaryCard(props: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-ink/15 bg-bgpaper/85 border border-dashed p-4">
      <p className="text-ink-secondary text-xs tracking-[0.2em]">{props.title}</p>
      <p className="text-ink mt-2 text-2xl font-semibold">{props.value}</p>
      {props.hint ? (
        <p className="text-ink-secondary mt-2 text-xs leading-6">{props.hint}</p>
      ) : null}
    </div>
  );
}

export default function AdminLlmMetricsPage() {
  const { pushToast } = useInkUI();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<LlmMetricsSnapshot | null>(null);
  const [limit, setLimit] = useState('300');
  const [sceneId, setSceneId] = useState('all');

  const fetchSnapshot = async (nextLimit = limit, nextSceneId = sceneId) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('limit', nextLimit);
      if (nextSceneId !== 'all') {
        query.set('sceneId', nextSceneId);
      }

      const response = await fetch(`/api/admin/llm-metrics?${query.toString()}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as MetricsResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '加载 LLM 指标失败');
      }

      setSnapshot(payload.data);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载 LLM 指标失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSnapshot(limit, sceneId);
    const timer = window.setInterval(() => {
      void fetchSnapshot(limit, sceneId);
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [limit, sceneId]);

  const overview = snapshot?.overview;
  const sceneOptions = useMemo(() => {
    return ['all', ...(snapshot?.sceneIds ?? [])];
  }, [snapshot]);

  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">LLM OPS</p>
        <h2 className="font-heading text-ink mt-2 text-4xl">LLM 调用观测</h2>
        <p className="text-ink-secondary mt-2 max-w-3xl text-sm leading-7">
          这里看的是最近窗口内的 LLM 调用统计。重点关注场景维度的
          `system/user/schema chars`、`input/output tokens`，以及 provider
          usage 中是否出现 `cachedInputTokens` 等缓存字段。
        </p>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-6">
        <div className="flex flex-wrap items-center gap-3">
          <InkSelect
            size="sm"
            value={limit}
            onChange={(value) => setLimit(value)}
          >
            <option value="100">最近 100 次</option>
            <option value="300">最近 300 次</option>
            <option value="1000">最近 1000 次</option>
          </InkSelect>
          <InkSelect
            size="sm"
            value={sceneId}
            onChange={(value) => setSceneId(value)}
          >
            {sceneOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? '全部场景' : option}
              </option>
            ))}
          </InkSelect>
          <InkButton
            variant="secondary"
            onClick={() => void fetchSnapshot(limit, sceneId)}
          >
            刷新
          </InkButton>
          <p className="text-ink-secondary text-xs">
            数据源：{snapshot?.source ?? '未知'}，
            最近刷新：{formatDateTime(snapshot?.generatedAt ?? null)}
          </p>
        </div>

        {loading && !snapshot ? (
          <p className="text-ink-secondary text-sm">加载中...</p>
        ) : null}

        {overview ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="调用总数"
                value={String(overview.calls)}
                hint={`成功 ${overview.successCalls} / 失败 ${overview.failureCalls}`}
              />
              <SummaryCard
                title="成功率"
                value={formatPercent(overview.successRate)}
                hint={`平均重试 ${overview.avgRetryCount}`}
              />
              <SummaryCard
                title="平均输入体积"
                value={`${Math.round(overview.avgSystemChars + overview.avgUserChars + overview.avgSchemaChars)} chars`}
                hint={`system ${overview.avgSystemChars} / user ${overview.avgUserChars} / schema ${overview.avgSchemaChars}`}
              />
              <SummaryCard
                title="缓存观察"
                value={formatPercent(overview.cacheHitCallRate)}
                hint={
                  overview.cacheObservedCalls > 0
                    ? `命中调用 ${overview.cacheHitCalls} / 可观察调用 ${overview.cacheObservedCalls}`
                    : '当前窗口内 provider 未返回缓存字段'
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="输入 Tokens"
                value={String(overview.usage.inputTokens)}
                hint="仅统计 provider 上报的 inputTokens/promptTokens"
              />
              <SummaryCard
                title="输出 Tokens"
                value={String(overview.usage.outputTokens)}
                hint={`总 tokens ${overview.usage.totalTokens}`}
              />
              <SummaryCard
                title="缓存读 Tokens"
                value={String(overview.usage.cachedInputTokens)}
                hint={`缓存覆盖率 ${formatPercent(overview.cacheCoverageRate)}`}
              />
              <SummaryCard
                title="缓存写 Tokens"
                value={String(overview.usage.cacheWriteInputTokens)}
                hint="若 provider 支持 prompt cache 写入，这里会增长"
              />
            </div>

            <div className="text-ink-secondary flex flex-wrap gap-6 text-xs">
              <span>窗口起点：{formatDateTime(snapshot?.oldestRecordedAt ?? null)}</span>
              <span>窗口终点：{formatDateTime(snapshot?.latestRecordedAt ?? null)}</span>
              <span>
                usage 字段：{snapshot?.usageKeys.length ? snapshot.usageKeys.join(', ') : '无'}
              </span>
            </div>
          </>
        ) : null}
      </section>

      <section className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <h3 className="text-ink text-xl font-semibold">按场景汇总</h3>
        <p className="text-ink-secondary mt-2 text-sm">
          看这里最容易判断这次降本是否生效：`dungeon-round`、
          `dungeon-settlement` 的平均 chars 和 input tokens 是否明显下降。
        </p>
        <div className="border-ink/15 mt-4 overflow-x-auto border border-dashed">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-ink/10 text-ink-secondary border-b text-left">
              <tr>
                <th className="px-3 py-2">场景</th>
                <th className="px-3 py-2">调用</th>
                <th className="px-3 py-2">成功率</th>
                <th className="px-3 py-2">平均 chars</th>
                <th className="px-3 py-2">input/output</th>
                <th className="px-3 py-2">缓存读/写</th>
                <th className="px-3 py-2">缓存命中率</th>
              </tr>
            </thead>
            <tbody>
              {snapshot?.scenes.length ? (
                snapshot.scenes.map((row) => (
                  <tr key={row.key} className="border-ink/8 border-b">
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2">{row.calls}</td>
                    <td className="px-3 py-2">{formatPercent(row.successRate)}</td>
                    <td className="px-3 py-2">
                      {Math.round(row.avgSystemChars + row.avgUserChars + row.avgSchemaChars)}
                      <div className="text-ink-secondary text-xs">
                        s {row.avgSystemChars} / u {row.avgUserChars} / sc {row.avgSchemaChars}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {row.usage.inputTokens} / {row.usage.outputTokens}
                    </td>
                    <td className="px-3 py-2">
                      {row.usage.cachedInputTokens} / {row.usage.cacheWriteInputTokens}
                    </td>
                    <td className="px-3 py-2">
                      {formatPercent(row.cacheHitCallRate)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-ink-secondary px-3 py-4" colSpan={7}>
                    当前筛选下暂无 LLM 调用记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <h3 className="text-ink text-xl font-semibold">最近调用</h3>
        <p className="text-ink-secondary mt-2 text-sm">
          这里用于排查单次异常：某个场景突然 chars 暴涨、usage 不返回缓存字段、或某模型重试异常增多。
        </p>
        <div className="border-ink/15 mt-4 overflow-x-auto border border-dashed">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="border-ink/10 text-ink-secondary border-b text-left">
              <tr>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">场景</th>
                <th className="px-3 py-2">模型</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">chars</th>
                <th className="px-3 py-2">retry</th>
                <th className="px-3 py-2">usage</th>
              </tr>
            </thead>
            <tbody>
              {snapshot?.recentCalls.length ? (
                snapshot.recentCalls.map((call) => (
                  <tr key={`${call.recordedAt}-${call.sceneId}-${call.model}`} className="border-ink/8 border-b">
                    <td className="px-3 py-2">{formatDateTime(call.recordedAt)}</td>
                    <td className="px-3 py-2">{call.sceneId}</td>
                    <td className="px-3 py-2">
                      <div>{call.provider}</div>
                      <div className="text-ink-secondary text-xs">{call.model}</div>
                    </td>
                    <td className="px-3 py-2">{call.status}</td>
                    <td className="px-3 py-2">
                      {call.systemChars + call.userChars + call.schemaChars}
                      <div className="text-ink-secondary text-xs">
                        s {call.systemChars} / u {call.userChars} / sc {call.schemaChars}
                      </div>
                    </td>
                    <td className="px-3 py-2">{call.retryCount}</td>
                    <td className="px-3 py-2 text-xs">{formatUsage(call.usage)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-ink-secondary px-3 py-4" colSpan={7}>
                    暂无最近调用
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

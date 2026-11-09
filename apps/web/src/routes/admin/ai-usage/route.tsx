import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import { apiFetch } from '@app/lib/api/fetch';
import type { AdminAiUsageSnapshot } from '@daoyou/contracts/admin/ai-usage';
import { useEffect, useState, type FormEvent } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';
import { AiPricingSettingsPanel } from './AiPricingSettingsPanel';
import {
  DailyUsageTrend,
  SceneUsageTable,
  UsageEventTable,
  UsageOverview,
} from './AiUsageViews';

type Period = 'today' | '7' | '30' | 'custom';
type Filters = {
  from: string;
  to: string;
  sceneId: string;
  provider: string;
  modelId: string;
};
type ResponseState = {
  key: string;
  query: string;
  data: AdminAiUsageSnapshot | null;
  error: string;
};
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const refreshTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function periodDates(period: Exclude<Period, 'custom'>) {
  const parts = dateFormatter.formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const to = `${part('year')}-${part('month')}-${part('day')}`;
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(
    start.getUTCDate() - (period === 'today' ? 0 : Number(period) - 1),
  );
  return { from: start.toISOString().slice(0, 10), to };
}

function initialFilters(): Filters {
  return {
    ...periodDates('7'),
    sceneId: '',
    provider: '',
    modelId: '',
  };
}

export default function AdminAiUsagePage() {
  const [period, setPeriod] = useState<Period>('7');
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [refresh, setRefresh] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [response, setResponse] = useState<ResponseState>({
    key: '',
    query: '',
    data: null,
    error: '',
  });

  const query = new URLSearchParams({
    from: applied.from,
    to: applied.to,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (applied.sceneId) query.set('sceneId', applied.sceneId);
  if (applied.provider) query.set('provider', applied.provider);
  if (applied.modelId) query.set('modelId', applied.modelId);
  const queryString = query.toString();
  const requestKey = `${queryString}#${refresh}`;
  const loading = response.key !== requestKey;
  const snapshot = response.query === queryString ? response.data : null;
  const error = loading ? '' : response.error;
  const options = response.data?.options;
  const models = (options?.models ?? []).filter(
    (model) => !filters.provider || model.provider === filters.provider,
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await apiFetch(`/api/admin/ai-usage?${queryString}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = (await result.json()) as {
          success: boolean;
          data?: AdminAiUsageSnapshot;
          error?: string;
          message?: string;
        };
        if (!result.ok || !payload.success || !payload.data)
          throw new Error(
            payload.error ?? payload.message ?? '加载 AI 用量失败',
          );
        if (!controller.signal.aborted)
          setResponse({
            key: requestKey,
            query: queryString,
            data: payload.data,
            error: '',
          });
      } catch (cause) {
        if (!controller.signal.aborted)
          setResponse({
            key: requestKey,
            query: queryString,
            data: null,
            error: cause instanceof Error ? cause.message : '加载 AI 用量失败',
          });
      }
    })();
    return () => controller.abort();
  }, [queryString, requestKey]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const from = Date.parse(`${filters.from}T00:00:00Z`);
    const to = Date.parse(`${filters.to}T00:00:00Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      setValidationError('请选择有效日期，开始日期不能晚于结束日期。');
      return;
    }
    if ((to - from) / 86_400_000 + 1 > 366) {
      setValidationError('一次最多查询 366 天，请缩小日期范围。');
      return;
    }
    setValidationError('');
    setApplied({ ...filters });
    setPage(1);
    setRefresh((value) => value + 1);
  };

  return (
    <div className="space-y-7">
      <AdminPageHeader
        title="AI 用量"
        description="仅统计已完成的模型步骤。费用按调用时的定价估算，不等同供应商账单；失败和中断调用的用量可能不完整。"
        actions={
          <InkButton
            pending={loading}
            pendingLabel="加载中……"
            onClick={() => setRefresh((value) => value + 1)}
          >
            刷新
          </InkButton>
        }
      />

      <AiPricingSettingsPanel />

      <form
        onSubmit={applyFilters}
        className="border-ink/15 space-y-4 border-b pb-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <InkSelect
            label="日期（北京时间）"
            value={period}
            onChange={(value) => {
              const next = value as Period;
              setPeriod(next);
              if (next !== 'custom')
                setFilters((previous) => ({
                  ...previous,
                  ...periodDates(next),
                }));
            }}
          >
            <option value="today">今日</option>
            <option value="7">近 7 日</option>
            <option value="30">近 30 日</option>
            <option value="custom">自定义</option>
          </InkSelect>
          <InkInput
            label="开始日期"
            type="date"
            value={filters.from}
            disabled={period !== 'custom'}
            onChange={(from) =>
              setFilters((previous) => ({ ...previous, from }))
            }
            max={filters.to}
            className="font-mono"
            required
          />
          <InkInput
            label="结束日期"
            type="date"
            value={filters.to}
            disabled={period !== 'custom'}
            onChange={(to) => setFilters((previous) => ({ ...previous, to }))}
            min={filters.from}
            className="font-mono"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <InkSelect
            label="场景"
            value={filters.sceneId}
            onChange={(sceneId) =>
              setFilters((previous) => ({ ...previous, sceneId }))
            }
          >
            <option value="">全部场景</option>
            {filters.sceneId && !options?.sceneIds.includes(filters.sceneId) ? (
              <option value={filters.sceneId}>{filters.sceneId}</option>
            ) : null}
            {options?.sceneIds.map((sceneId) => (
              <option key={sceneId} value={sceneId}>
                {sceneId}
              </option>
            ))}
          </InkSelect>
          <InkSelect
            label="供应商"
            value={filters.provider}
            onChange={(provider) =>
              setFilters((previous) => ({ ...previous, provider, modelId: '' }))
            }
          >
            <option value="">全部供应商</option>
            {filters.provider &&
            !options?.providers.includes(filters.provider) ? (
              <option value={filters.provider}>{filters.provider}</option>
            ) : null}
            {options?.providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </InkSelect>
          <InkSelect
            label="实际模型"
            value={
              filters.modelId
                ? JSON.stringify([filters.provider, filters.modelId])
                : ''
            }
            onChange={(value) => {
              if (!value)
                setFilters((previous) => ({ ...previous, modelId: '' }));
              else {
                const [provider, modelId] = JSON.parse(value) as [
                  string,
                  string,
                ];
                setFilters((previous) => ({ ...previous, provider, modelId }));
              }
            }}
          >
            <option value="">全部模型</option>
            {filters.modelId &&
            !models.some(
              (model) =>
                model.provider === filters.provider &&
                model.modelId === filters.modelId,
            ) ? (
              <option
                value={JSON.stringify([filters.provider, filters.modelId])}
              >
                {filters.provider} / {filters.modelId}
              </option>
            ) : null}
            {models.map((model) => (
              <option
                key={JSON.stringify([model.provider, model.modelId])}
                value={JSON.stringify([model.provider, model.modelId])}
              >
                {model.provider} / {model.modelId}
              </option>
            ))}
          </InkSelect>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <InkButton type="submit" variant="primary">
            应用筛选
          </InkButton>
          <p className="text-ink-secondary text-xs">起止日期均包含当天。</p>
        </div>
        {validationError ? (
          <p role="alert" className="text-crimson text-sm">
            {validationError}
          </p>
        ) : null}
      </form>

      <div aria-live="polite" aria-busy={loading}>
        {loading && !snapshot ? (
          <p className="text-ink-secondary py-10 text-center text-sm">
            正在加载 AI 用量……
          </p>
        ) : null}
        {loading && snapshot ? (
          <p role="status" className="text-ink-secondary mb-4 text-sm">
            正在刷新，以下为上次查询结果……
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="border-crimson/25 border p-5">
            <p className="text-crimson text-sm">{error}</p>
            <InkButton
              className="mt-2"
              onClick={() => setRefresh((value) => value + 1)}
            >
              重新加载
            </InkButton>
          </div>
        ) : null}
        {snapshot ? (
          <div className="space-y-8">
            <p className="text-ink-secondary text-xs">
              统计范围：
              <span className="font-mono">
                {snapshot.query.from} — {snapshot.query.to}
              </span>
              （北京） · 更新于{' '}
              <span className="font-mono">
                {refreshTime.format(new Date(snapshot.generatedAt))}
              </span>
            </p>
            <UsageOverview totals={snapshot.overview} />
            {snapshot.overview.steps === 0 ? (
              <p className="border-ink/10 text-ink-secondary border-y py-6 text-center text-sm">
                所选日期和筛选条件暂无已完成步骤。可调整条件或稍后刷新。
              </p>
            ) : null}
            <SceneUsageTable scenes={snapshot.scenes} />
            <DailyUsageTrend daily={snapshot.daily} />
            <UsageEventTable
              events={snapshot.events}
              pagination={snapshot.pagination}
              disabled={loading}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

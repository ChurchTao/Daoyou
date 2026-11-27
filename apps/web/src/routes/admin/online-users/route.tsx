import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { cn } from '@app/lib/cn';
import type {
  AdminOnlineCharactersPage,
  AdminOnlineTrend,
  AdminOnlineTrendRange,
  AdminOnlineUsersSnapshot,
} from '@daoyou/contracts/admin/online-users';
import { useState, type FormEvent } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';
import { MINUTE_MS, OnlineTrendChart } from './OnlineTrendChart';
import { useMonitoringQuery } from './useMonitoringQuery';

const ENDPOINT = '/api/admin/online-users';
const CURRENT_REFRESH_MS = 30_000;
const DISPLAY_TIME = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const RANGE_OPTIONS: { value: AdminOnlineTrendRange; label: string }[] = [
  { value: '1h', label: '近 1 小时' },
  { value: '24h', label: '近 24 小时' },
];

function formatTime(at: string | number) {
  return DISPLAY_TIME.format(typeof at === 'string' ? new Date(at) : at);
}

function SummaryStat({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string | number;
  primary?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1 px-3 py-3 sm:px-5">
      <dt className="text-ink-secondary text-xs sm:text-sm">{label}</dt>
      <dd
        className={cn(
          'font-mono text-2xl font-semibold tracking-tight sm:text-3xl',
          primary && 'text-teal',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function OnlineCharacters({ refresh }: { refresh: number }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);
  const result = useMonitoringQuery<AdminOnlineCharactersPage>(
    `${ENDPOINT}/characters?${params}`,
    refresh,
    CURRENT_REFRESH_MS,
  );
  const snapshot = result?.data;
  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draft.trim());
    setPage(1);
  }

  return (
    <section
      aria-label="在线角色"
      className="border-ink/15 space-y-4 border-t pt-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-heading text-xl">在线角色</h3>
        <form
          onSubmit={applySearch}
          className="flex w-full items-center gap-2 sm:w-auto"
        >
          <div className="min-w-0 flex-1 sm:w-52">
            <InkInput
              value={draft}
              onChange={setDraft}
              type="search"
              aria-label="搜索道号"
              placeholder="输入道号"
              maxLength={100}
            />
          </div>
          <InkButton type="submit">搜索</InkButton>
          {search ? (
            <InkButton
              variant="secondary"
              onClick={() => {
                setDraft('');
                setSearch('');
                setPage(1);
              }}
            >
              清除
            </InkButton>
          ) : null}
        </form>
      </div>
      {result?.error ? (
        <InkNotice tone="warning">
          角色明细刷新失败。
          {snapshot
            ? ` 上次成功读取 ${formatTime(snapshot.generatedAt)}。`
            : ` ${result.error}`}
        </InkNotice>
      ) : null}
      {snapshot?.source === 'memory' ? (
        <InkNotice tone="warning">明细仅覆盖当前 API 实例。</InkNotice>
      ) : null}
      {!result ? (
        <p role="status" className="text-ink-secondary text-sm">
          正在读取在线角色……
        </p>
      ) : null}
      {snapshot ? (
        <>
          {snapshot.items.length > 0 ? (
            <div className="border-ink/15 border">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-ink/5 text-ink-secondary">
                  <tr>
                    <th scope="col" className="w-2/5 px-3 py-2">
                      道号
                    </th>
                    <th scope="col" className="w-[30%] px-3 py-2">
                      境界
                    </th>
                    <th scope="col" className="px-3 py-2">
                      宗门
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.items.map((character) => (
                    <tr
                      key={character.id}
                      className="border-ink/10 border-t align-top"
                    >
                      <th
                        scope="row"
                        className="px-3 py-2 font-semibold [overflow-wrap:anywhere]"
                      >
                        {character.name}
                      </th>
                      <td className="px-3 py-2 [overflow-wrap:anywhere]">
                        {character.realm} · {character.realmStage}
                      </td>
                      <td className="px-3 py-2 [overflow-wrap:anywhere]">
                        {character.sectName ?? '未入宗门'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-ink-secondary py-4 text-sm">
              {page > 1
                ? '当前页暂无在线角色。'
                : search
                  ? '没有找到匹配的在线角色。'
                  : '当前暂无在线角色。'}
            </p>
          )}
          {page > 1 || snapshot.hasNext ? (
            <nav
              aria-label="在线角色分页"
              className="flex items-center justify-end gap-3"
            >
              <InkButton
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </InkButton>
              <span className="text-ink-secondary text-sm">
                第 <span className="font-mono">{page}</span> 页
              </span>
              <InkButton
                variant="secondary"
                disabled={!snapshot.hasNext}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </InkButton>
            </nav>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function AdminOnlineUsersPage() {
  const [range, setRange] = useState<AdminOnlineTrendRange>('1h');
  const [compare, setCompare] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const summary = useMonitoringQuery<AdminOnlineUsersSnapshot>(
    ENDPOINT,
    refresh,
    CURRENT_REFRESH_MS,
  );
  const trend = useMonitoringQuery<AdminOnlineTrend>(
    `${ENDPOINT}/trend?range=${range}`,
    refresh,
    MINUTE_MS,
  );
  const snapshot = summary?.data;
  const global = snapshot?.source === 'redis';
  const sampledAt = snapshot
    ? Math.floor(Date.parse(snapshot.generatedAt) / MINUTE_MS) * MINUTE_MS
    : 0;
  const earlier = trend?.data?.points.find(
    (point) => point.at === sampledAt - 15 * MINUTE_MS,
  )?.current;
  const delta =
    snapshot && global && earlier != null
      ? snapshot.currentOnline - earlier
      : null;
  const hasCurrent = trend?.data?.points.some(
    (point) => point.current !== null,
  );
  const hasYesterday = trend?.data?.points.some(
    (point) => point.yesterday !== null,
  );
  const showTrend = hasCurrent || (compare && hasYesterday);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="在线监测"
        description="按有效游戏连接统计，同一角色打开多个页面只计一人。"
        actions={
          <InkButton
            variant="secondary"
            onClick={() => setRefresh((current) => current + 1)}
          >
            刷新
          </InkButton>
        }
      />
      <section aria-label="在线摘要" className="space-y-3">
        {summary?.error ? (
          <InkNotice tone="warning">
            在线摘要刷新失败。
            {snapshot
              ? ` 上次成功读取 ${formatTime(snapshot.generatedAt)}。`
              : ` ${summary.error}`}
          </InkNotice>
        ) : !summary ? (
          <p role="status" className="text-ink-secondary text-sm">
            正在读取在线人数……
          </p>
        ) : null}
        {snapshot?.source === 'memory' ? (
          <InkNotice tone="warning">
            全服数据暂不可用，当前在线仅覆盖本 API 实例。
          </InkNotice>
        ) : null}
        <dl className="border-ink/15 divide-ink/15 grid grid-cols-3 divide-x border">
          <SummaryStat
            label="当前在线"
            value={snapshot?.currentOnline ?? '—'}
            primary
          />
          <SummaryStat
            label="较 15 分钟前"
            value={delta === null ? '—' : delta > 0 ? `+${delta}` : delta}
          />
          <SummaryStat
            label="今日峰值"
            value={global ? snapshot.todayPeakOnline : '—'}
          />
        </dl>
        {snapshot ? (
          <div className="text-ink-secondary flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
            <span>
              {global ? '全服' : '当前实例'} · 更新于{' '}
              <time className="font-mono" dateTime={snapshot.generatedAt}>
                {formatTime(snapshot.generatedAt)}
              </time>
            </span>
            {global ? (
              <span>
                历史峰值{' '}
                <span className="font-mono">{snapshot.allTimePeakOnline}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
      <section
        aria-label="在线趋势"
        className="border-ink/15 space-y-3 border-t pt-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-xl">在线趋势</h3>
          <div
            role="group"
            aria-label="趋势时间范围"
            className="border-ink/15 inline-flex divide-x divide-current rounded-sm border"
          >
            {RANGE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={range === value}
                onClick={() => setRange(value)}
                className={cn(
                  'px-3 py-2 text-sm',
                  range === value
                    ? 'bg-teal/10 text-teal font-semibold'
                    : 'text-ink-secondary hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-ink-secondary flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="bg-teal h-0.5 w-4" />
              当前区间
            </span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-teal"
                checked={compare}
                onChange={(event) => setCompare(event.target.checked)}
              />
              <span
                aria-hidden="true"
                className="w-4 border-t border-dashed border-current"
              />
              昨天同期
            </label>
          </div>
          <span>每分钟采样 · 北京时间</span>
        </div>
        {trend?.error ? (
          <InkNotice tone="warning">
            {trend.error}
            {trend.data
              ? `，图中为 ${formatTime(trend.data.to)} 前的采样。`
              : '。'}
          </InkNotice>
        ) : null}
        {!trend ? (
          <p role="status" className="text-ink-secondary py-8 text-sm">
            正在读取在线趋势……
          </p>
        ) : null}
        {trend?.data ? (
          showTrend ? (
            <>
              <OnlineTrendChart
                key={range}
                trend={trend.data}
                compare={compare}
              />
              {compare && !hasYesterday ? (
                <p className="text-ink-secondary text-xs">昨天同期暂无采样。</p>
              ) : null}
            </>
          ) : (
            <p className="text-ink-secondary py-8 text-sm">
              所选时段暂无在线采样。
            </p>
          )
        ) : null}
      </section>
      <OnlineCharacters refresh={refresh} />
    </div>
  );
}

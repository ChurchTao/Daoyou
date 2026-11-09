import { InkButton } from '@app/components/ui/InkButton';
import { InkSelect } from '@app/components/ui/InkSelect';
import type { AdminAiUsageSnapshot } from '@daoyou/contracts/admin/ai-usage';
import { Fragment, useState, type ReactNode } from 'react';

type Totals = AdminAiUsageSnapshot['overview'];
type UsageEvent = AdminAiUsageSnapshot['events'][number];
type DailyUsage = AdminAiUsageSnapshot['daily'][number];

const numbers = new Intl.NumberFormat('zh-CN');
const costNumbers = new Intl.NumberFormat('zh-CN', {
  maximumSignificantDigits: 12,
});
const axisNumbers = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});
const beijingTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const cell = 'px-3 py-3 text-left align-top';
const numberCell = `${cell} text-right font-mono`;

function decimal(value: string) {
  if (!/^\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value)) return value;
  const amount = Number(value);
  const nonzero = /[1-9]/.test(value.split(/[eE]/)[0]);
  if (Number.isFinite(amount) && (amount > 0 || !nonzero)) {
    return costNumbers.format(amount);
  }
  // Preserve positive values outside Number's range instead of showing zero.
  if (/[eE]/.test(value)) return value;
  const [whole, fraction = ''] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

function duration(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  return milliseconds < 1_000
    ? `${numbers.format(milliseconds)} ms`
    : `${numbers.format(Math.round(milliseconds / 10) / 100)} s`;
}

function Costs({ totals }: { totals: Totals }) {
  return (
    <div className="space-y-1">
      {totals.costs.map((cost) => (
        <div key={cost.currency} className="font-mono break-all">
          {cost.currency} {decimal(cost.estimatedCost)}
        </div>
      ))}
      {totals.costs.length === 0 ? (
        <span className="text-ink-secondary">
          {totals.steps ? '未计价' : '—'}
        </span>
      ) : null}
      {totals.unpricedSteps > 0 && totals.costs.length > 0 ? (
        <p className="text-ink-secondary text-xs">
          另有{' '}
          <span className="font-mono">
            {numbers.format(totals.unpricedSteps)}
          </span>{' '}
          步未计价
        </p>
      ) : null}
    </div>
  );
}

function OverviewStat({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="border-ink/15 min-w-0 border-l pl-4">
      <p className="text-ink-secondary text-sm">{label}</p>
      <div className="mt-2 text-xl font-semibold tracking-tight">
        {children}
      </div>
      {hint ? (
        <p className="text-ink-secondary mt-2 text-xs leading-5">{hint}</p>
      ) : null}
    </div>
  );
}

export function UsageOverview({ totals }: { totals: Totals }) {
  return (
    <section
      aria-label="用量概览"
      className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-5"
    >
      <OverviewStat label="已完成步骤" hint="一个模型步骤计一条记录">
        <span className="font-mono">{numbers.format(totals.steps)}</span>
      </OverviewStat>
      <OverviewStat
        label="输入 tokens"
        hint={
          <>
            含缓存读取{' '}
            <span className="font-mono">
              {numbers.format(totals.cachedInputTokens)}
            </span>
          </>
        }
      >
        <span className="font-mono">{numbers.format(totals.inputTokens)}</span>
      </OverviewStat>
      <OverviewStat
        label="输出 tokens"
        hint={
          <>
            其中推理{' '}
            <span className="font-mono">
              {numbers.format(totals.reasoningTokens)}
            </span>
          </>
        }
      >
        <span className="font-mono">{numbers.format(totals.outputTokens)}</span>
      </OverviewStat>
      <OverviewStat label="估算费用" hint="各币种分别展示，不换算汇总">
        <Costs totals={totals} />
      </OverviewStat>
      <OverviewStat
        label="计价覆盖"
        hint={
          <>
            未计价{' '}
            <span className="font-mono">
              {numbers.format(totals.unpricedSteps)}
            </span>{' '}
            步
          </>
        }
      >
        <span className="font-mono">
          {numbers.format(totals.pricedSteps)} / {numbers.format(totals.steps)}
        </span>
      </OverviewStat>
    </section>
  );
}

export function SceneUsageTable({
  scenes,
}: {
  scenes: AdminAiUsageSnapshot['scenes'];
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <section className="space-y-3">
      <h3 className="font-heading text-xl">按场景汇总</h3>
      {scenes.length === 0 ? (
        <p className="text-ink-secondary py-6 text-sm">
          所选范围暂无场景记录。
        </p>
      ) : (
        <div className="border-ink/15 overflow-x-auto border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink/5 text-ink-secondary">
              <tr>
                <th className={cell}>场景 / 模型</th>
                <th className={numberCell}>步骤</th>
                <th className={numberCell}>输入 tokens</th>
                <th className={numberCell}>输出 tokens</th>
                <th className={numberCell}>平均耗时</th>
                <th className={numberCell}>估算费用</th>
              </tr>
            </thead>
            {scenes.map((scene) => {
              const open = expanded.includes(scene.sceneId);
              return (
                <tbody key={scene.sceneId} className="border-ink/10 border-t">
                  <tr>
                    <td className={cell}>
                      <p className="max-w-64 font-semibold break-words">
                        {scene.sceneId}
                      </p>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded((previous) =>
                            open
                              ? previous.filter((id) => id !== scene.sceneId)
                              : [...previous, scene.sceneId],
                          )
                        }
                        className="text-crimson mt-1 cursor-pointer text-xs underline-offset-4 hover:underline"
                      >
                        {open ? '收起模型' : '展开模型'}{' '}
                        <span className="font-mono">
                          ({scene.models.length})
                        </span>
                      </button>
                    </td>
                    <td className={numberCell}>
                      {numbers.format(scene.steps)}
                    </td>
                    <td className={numberCell}>
                      {numbers.format(scene.inputTokens)}
                    </td>
                    <td className={numberCell}>
                      {numbers.format(scene.outputTokens)}
                    </td>
                    <td className={numberCell}>
                      {duration(scene.averageDurationMs)}
                    </td>
                    <td className={`${cell} text-right`}>
                      <Costs totals={scene} />
                    </td>
                  </tr>
                  {open
                    ? scene.models.map((model) => (
                        <tr
                          key={JSON.stringify([
                            model.provider,
                            model.modelId,
                            model.modelAlias,
                          ])}
                          className="bg-ink/[0.025] border-ink/5 border-t"
                        >
                          <td className={`${cell} pl-6`}>
                            <p className="text-ink-secondary text-xs">
                              {model.provider}
                            </p>
                            <p className="max-w-64 break-all">
                              {model.modelId}
                            </p>
                            <p className="text-ink-secondary mt-1 text-xs">
                              别名：{model.modelAlias ?? '未设置'}
                            </p>
                          </td>
                          <td className={numberCell}>
                            {numbers.format(model.steps)}
                          </td>
                          <td className={numberCell}>
                            {numbers.format(model.inputTokens)}
                          </td>
                          <td className={numberCell}>
                            {numbers.format(model.outputTokens)}
                          </td>
                          <td className={numberCell}>
                            {duration(model.averageDurationMs)}
                          </td>
                          <td className={`${cell} text-right`}>
                            <Costs totals={model} />
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </section>
  );
}

function DailyChart({
  daily,
  currency,
}: {
  daily: DailyUsage[];
  currency?: string;
}) {
  const series = currency
    ? [
        {
          label: currency,
          color: 'stroke-crimson',
          values: daily.map((day) => {
            const cost = day.costs.find((item) => item.currency === currency);
            if (cost) return Number(cost.estimatedCost);
            return day.steps > 0 && day.unpricedSteps > 0 ? null : 0;
          }),
        },
      ]
    : [
        {
          label: '输入 tokens',
          color: 'stroke-ink',
          values: daily.map((day) => day.inputTokens),
        },
        {
          label: '输出 tokens',
          color: 'stroke-crimson',
          values: daily.map((day) => day.outputTokens),
        },
      ];
  const maximum = Math.max(
    0,
    ...series.flatMap((item) =>
      item.values.filter((value): value is number => value !== null),
    ),
  );
  const ceiling = maximum || 1;
  const x = (index: number) =>
    daily.length <= 1 ? 365 : 60 + (index / (daily.length - 1)) * 610;
  const y = (value: number) => 125 - (value / ceiling) * 110;
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
        <h4>{currency ? `每日估算费用 · ${currency}` : '每日 tokens'}</h4>
        {!currency ? (
          <p className="text-ink-secondary">
            <span className="text-ink">━ 输入</span>
            <span className="text-crimson ml-4">━ 输出</span>
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 690 155"
          className="w-full min-w-[360px]"
          role="img"
          aria-label={
            currency
              ? `${currency} 每日估算费用趋势`
              : '每日输入与输出 tokens 趋势'
          }
        >
          <desc>
            日期按北京时间。悬停数据点或展开每日数值查看明细；未计价步骤不计入费用曲线。
          </desc>
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1="60"
                x2="670"
                y1={y(ceiling * fraction)}
                y2={y(ceiling * fraction)}
                className="stroke-ink/10"
              />
              <text
                x="52"
                y={y(ceiling * fraction) + 3}
                textAnchor="end"
                className="fill-ink-secondary font-mono text-[10px]"
              >
                {axisNumbers.format(maximum * fraction)}
              </text>
            </g>
          ))}
          {series.map((item) => (
            <g key={item.label}>
              <path
                d={item.values
                  .map((value, index) =>
                    value === null
                      ? ''
                      : `${index > 0 && item.values[index - 1] !== null ? 'L' : 'M'}${x(index)},${y(value)}`,
                  )
                  .join(' ')}
                fill="none"
                strokeWidth="2"
                className={item.color}
              />
              {daily.map((day, index) => {
                const value = item.values[index];
                if (value === null) return null;
                return (
                  <circle
                    key={day.date}
                    cx={x(index)}
                    cy={y(value)}
                    r={daily.length > 31 ? 2 : 3}
                    strokeWidth="2"
                    className={`${item.color} fill-paper`}
                  >
                    <title>
                      {day.date} · {item.label}{' '}
                      {currency
                        ? decimal(
                            day.costs.find((cost) => cost.currency === currency)
                              ?.estimatedCost ?? '0',
                          )
                        : numbers.format(value)}
                      {currency && day.unpricedSteps > 0
                        ? `；另有 ${numbers.format(day.unpricedSteps)} 步未计价`
                        : ''}
                    </title>
                  </circle>
                );
              })}
            </g>
          ))}
          {daily.length > 0 ? (
            <>
              <text
                x="60"
                y="148"
                className="fill-ink-secondary font-mono text-[10px]"
              >
                {daily[0].date}
              </text>
              <text
                x="670"
                y="148"
                textAnchor="end"
                className="fill-ink-secondary font-mono text-[10px]"
              >
                {daily[daily.length - 1].date}
              </text>
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

export function DailyUsageTrend({
  daily,
}: {
  daily: AdminAiUsageSnapshot['daily'];
}) {
  const currencies = [
    ...new Set(daily.flatMap((day) => day.costs.map((cost) => cost.currency))),
  ].sort();
  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-heading text-xl">每日趋势</h3>
        <p className="text-ink-secondary mt-1 text-xs">
          北京时间；费用曲线仅含已计价部分，各币种独立展示。缺少定价的日期留空。
        </p>
      </div>
      <DailyChart daily={daily} />
      {currencies.length > 0 ? (
        currencies.map((currency) => (
          <DailyChart key={currency} daily={daily} currency={currency} />
        ))
      ) : (
        <p className="text-ink-secondary text-sm">
          所选范围暂无已计价记录，费用趋势暂不可用。
        </p>
      )}
      <details className="border-ink/10 border-t pt-3">
        <summary className="text-ink-secondary cursor-pointer text-sm">
          查看每日数值
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="text-ink-secondary">
              <tr>
                <th className={cell}>日期</th>
                <th className={numberCell}>步骤</th>
                <th className={numberCell}>输入 tokens</th>
                <th className={numberCell}>输出 tokens</th>
                <th className={numberCell}>未计价步骤</th>
                <th className={numberCell}>估算费用</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.date} className="border-ink/10 border-t">
                  <td className={`${cell} font-mono`}>{day.date}</td>
                  <td className={numberCell}>{numbers.format(day.steps)}</td>
                  <td className={numberCell}>
                    {numbers.format(day.inputTokens)}
                  </td>
                  <td className={numberCell}>
                    {numbers.format(day.outputTokens)}
                  </td>
                  <td className={numberCell}>
                    {numbers.format(day.unpricedSteps)}
                  </td>
                  <td className={`${cell} text-right`}>
                    <Costs totals={day} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function EventDetails({ event }: { event: UsageEvent }) {
  const rows = [
    ['实际模型', event.modelId],
    ['模型别名', event.modelAlias ?? '未设置'],
    ['缓存读取 tokens', numbers.format(event.cachedInputTokens)],
    ['推理 tokens', numbers.format(event.reasoningTokens)],
    ['耗时', duration(event.durationMs)],
    ['结束原因（finishReason）', event.finishReason],
    ['步骤序号 / 尝试序号', `${event.step} / ${event.attempt}`],
    [
      '调用方式',
      `${event.stream ? '流式' : '非流式'}${event.fallback ? ' · 已回退模型' : ''}`,
    ],
    ['记录 ID', event.id],
  ];
  const pricing = event.pricingSnapshot;
  if (pricing) {
    const source =
      pricing.source === 'default'
        ? '默认估算价'
        : pricing.source === 'app_settings:ai_model_pricing_v1'
          ? '配置价（API 启动快照）'
          : `历史计价快照${pricing.source ? ` · ${pricing.source}` : ''}`;
    rows.push(
      ['计价来源', source],
      [
        '输入 / 输出单价（每百万 tokens）',
        `${event.currency ?? '未知币种'} ${decimal(String(pricing.input))} / ${decimal(String(pricing.output))}`,
      ],
      [
        '缓存输入单价（每百万 tokens）',
        pricing.cachedInput === undefined
          ? '按普通输入价'
          : `${event.currency ?? '未知币种'} ${decimal(String(pricing.cachedInput))}`,
      ],
    );
    if (pricing.condition) rows.push(['计价说明', pricing.condition]);
  }
  return (
    <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-ink-secondary text-xs">{label}</dt>
          <dd className="mt-1 font-mono text-sm break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function UsageEventTable({
  events,
  pagination,
  disabled,
  onPageChange,
  onPageSizeChange,
}: {
  events: AdminAiUsageSnapshot['events'];
  pagination: AdminAiUsageSnapshot['pagination'];
  disabled: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-xl">步骤明细</h3>
        <p className="text-ink-secondary text-sm">
          共{' '}
          <span className="font-mono">{numbers.format(pagination.total)}</span>{' '}
          条
        </p>
      </div>
      {events.length === 0 ? (
        <p className="text-ink-secondary py-6 text-sm">
          所选条件暂无已完成步骤。
        </p>
      ) : (
        <div className="border-ink/15 overflow-x-auto border">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-ink/5 text-ink-secondary">
              <tr>
                <th className={cell}>时间（北京）</th>
                <th className={cell}>场景</th>
                <th className={cell}>供应商 / 实际模型</th>
                <th className={numberCell}>输入 / 输出 tokens</th>
                <th className={numberCell}>估算费用</th>
                <th className={cell}>详情</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <Fragment key={event.id}>
                  <tr className="border-ink/10 border-t">
                    <td
                      className={`${cell} font-mono text-xs whitespace-nowrap`}
                    >
                      <time dateTime={event.recordedAt}>
                        {beijingTime.format(new Date(event.recordedAt))}
                      </time>
                    </td>
                    <td className={`${cell} max-w-44 break-words`}>
                      {event.sceneId}
                    </td>
                    <td className={`${cell} max-w-60 break-all`}>
                      <p className="text-ink-secondary text-xs">
                        {event.provider}
                      </p>
                      <p>{event.modelId}</p>
                      {event.modelAlias ? (
                        <p className="text-ink-secondary mt-1 text-xs">
                          别名：{event.modelAlias}
                        </p>
                      ) : null}
                    </td>
                    <td className={numberCell}>
                      {numbers.format(event.inputTokens)} /{' '}
                      {numbers.format(event.outputTokens)}
                    </td>
                    <td className={`${cell} text-right`}>
                      {event.estimatedCost !== null && event.currency ? (
                        <span className="font-mono">
                          {event.currency} {decimal(event.estimatedCost)}
                        </span>
                      ) : (
                        <span className="text-ink-secondary">未计价</span>
                      )}
                    </td>
                    <td className={cell}>
                      <button
                        type="button"
                        aria-expanded={expandedId === event.id}
                        onClick={() =>
                          setExpandedId((previous) =>
                            previous === event.id ? null : event.id,
                          )
                        }
                        className="text-crimson cursor-pointer whitespace-nowrap underline-offset-4 hover:underline"
                      >
                        {expandedId === event.id ? '收起' : '详情'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === event.id ? (
                    <tr className="bg-ink/[0.025]">
                      <td colSpan={6}>
                        <EventDetails event={event} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InkSelect
          aria-label="每页条数"
          size="sm"
          value={String(pagination.pageSize)}
          disabled={disabled}
          onChange={(value) => onPageSizeChange(Number(value))}
          containerClassName="w-32"
        >
          <option value="25">每页 25 条</option>
          <option value="50">每页 50 条</option>
          <option value="100">每页 100 条</option>
        </InkSelect>
        <div className="flex items-center gap-3">
          <InkButton
            disabled={disabled || pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            上一页
          </InkButton>
          <span className="text-ink-secondary text-sm">
            第 <span className="font-mono">{pagination.page}</span> /{' '}
            <span className="font-mono">
              {Math.max(1, pagination.totalPages)}
            </span>{' '}
            页
          </span>
          <InkButton
            disabled={disabled || pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            下一页
          </InkButton>
        </div>
      </div>
    </section>
  );
}

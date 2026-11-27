import type {
  AdminOnlineTrend,
  AdminOnlineTrendPoint,
} from '@daoyou/contracts/admin/online-users';
import { useEffect, useRef, useState } from 'react';

export const MINUTE_MS = 60_000;

const shortTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const fullTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function drawSeries(
  ctx: CanvasRenderingContext2D,
  points: readonly AdminOnlineTrendPoint[],
  series: 'current' | 'yesterday',
  x: (at: number) => number,
  y: (count: number) => number,
) {
  const samples = points.flatMap((point) => {
    const count = point[series];
    return count === null ? [] : [{ at: point.at, count }];
  });
  ctx.beginPath();
  for (const [index, sample] of samples.entries()) {
    if (samples[index - 1]?.at === sample.at - MINUTE_MS)
      ctx.lineTo(x(sample.at), y(sample.count));
    else ctx.moveTo(x(sample.at), y(sample.count));
  }
  ctx.stroke();

  for (const [index, sample] of samples.entries()) {
    if (
      samples[index - 1]?.at === sample.at - MINUTE_MS ||
      samples[index + 1]?.at === sample.at + MINUTE_MS
    )
      continue;
    ctx.beginPath();
    ctx.arc(x(sample.at), y(sample.count), 2.5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function paintChart(
  canvas: HTMLCanvasElement,
  trend: AdminOnlineTrend,
  compare: boolean,
  selectedAt: number,
) {
  const { clientWidth: width, clientHeight: height } = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx || width < 80 || height < 80) return;

  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.scale(scale, scale);
  const theme = getComputedStyle(canvas);
  const green = theme.getPropertyValue('--color-teal').trim();
  const ink = theme.getPropertyValue('--color-ink-secondary').trim();
  const border = theme.getPropertyValue('--color-ink-border').trim();
  const largest = trend.points.reduce(
    (max, point) =>
      Math.max(max, point.current ?? 0, compare ? (point.yesterday ?? 0) : 0),
    0,
  );
  const step = Math.max(1, Math.ceil(largest / 4));
  ctx.font = '11px monospace';
  const left = Math.max(24, ctx.measureText(String(step * 4)).width + 11);
  const right = width - 12;
  const top = 10;
  const bottom = height - 26;
  const x = (at: number) =>
    left + ((at - trend.from) / (trend.to - trend.from)) * (right - left);
  const y = (count: number) => bottom - (count / (step * 4)) * (bottom - top);

  ctx.strokeStyle = border;
  ctx.fillStyle = ink;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let count = 0; count <= step * 4; count += step) {
    const at = y(count);
    ctx.beginPath();
    ctx.moveTo(left, at);
    ctx.lineTo(right, at);
    ctx.stroke();
    ctx.fillText(String(count), left - 7, at);
  }

  const intervals = width < 480 ? 2 : 4;
  for (let index = 0; index <= intervals; index += 1) {
    const at = trend.from + ((trend.to - trend.from) * index) / intervals;
    ctx.textAlign =
      index === 0 ? 'left' : index === intervals ? 'right' : 'center';
    ctx.fillText(shortTime.format(at), x(at), height - 10);
  }

  ctx.beginPath();
  ctx.moveTo(x(selectedAt), top);
  ctx.lineTo(x(selectedAt), bottom);
  ctx.stroke();

  if (compare) {
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.setLineDash([5, 4]);
    drawSeries(ctx, trend.points, 'yesterday', x, y);
  }
  ctx.fillStyle = green;
  ctx.strokeStyle = green;
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  drawSeries(ctx, trend.points, 'current', x, y);
}

export function OnlineTrendChart({
  trend,
  compare,
}: {
  trend: AdminOnlineTrend;
  compare: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);
  const selectedAt =
    selectedMinute === null
      ? trend.to
      : Math.max(trend.from, Math.min(trend.to, selectedMinute));
  const point = trend.points.find((sample) => sample.at === selectedAt);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const paint = () => paintChart(canvas, trend, compare, selectedAt);
    const size = new ResizeObserver(paint);
    size.observe(canvas);
    const theme = new MutationObserver(paint);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    paint();
    return () => {
      size.disconnect();
      theme.disconnect();
    };
  }, [compare, selectedAt, trend]);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="block h-56 w-full"
        role="img"
        aria-label="按分钟统计的在线角色趋势，缺失采样显示为空档"
      />
      <div className="border-ink/10 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-3 text-sm">
        <label className="text-ink-secondary flex min-w-52 items-center gap-2">
          查看分钟
          <input
            className="accent-teal min-w-24 flex-1"
            type="range"
            min={trend.from}
            max={trend.to}
            step={MINUTE_MS}
            value={selectedAt}
            aria-valuetext={fullTime.format(selectedAt)}
            onChange={(event) => setSelectedMinute(Number(event.target.value))}
          />
        </label>
        <span className="text-ink-secondary font-mono text-xs">
          {fullTime.format(selectedAt)}
        </span>
        <span>
          当前{' '}
          <span className="font-mono font-semibold">
            {point?.current ?? '—'}
          </span>
        </span>
        {compare ? (
          <span>
            昨天同期{' '}
            <span className="font-mono font-semibold">
              {point?.yesterday ?? '—'}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

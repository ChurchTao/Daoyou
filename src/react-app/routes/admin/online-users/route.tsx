import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import type {
  AdminOnlineUsersResponse,
  AdminOnlineUsersSnapshot,
} from '@shared/contracts/adminOnlineUsers';
import { useCallback, useEffect, useRef, useState } from 'react';

const REFRESH_INTERVAL_MS = 30_000;

function formatDateTime(value: string | null): string {
  if (!value) {
    return '暂无';
  }
  return new Date(value).toLocaleString();
}

async function fetchOnlineUsersSnapshot(): Promise<AdminOnlineUsersSnapshot> {
  const response = await fetch('/api/admin/online-users', {
    cache: 'no-store',
  });
  const payload = (await response.json()) as
    | AdminOnlineUsersResponse
    | { success?: false; error?: string };

  if (!response.ok || !payload.success || !('data' in payload)) {
    const errorPayload = payload as { error?: string };
    throw new Error(errorPayload.error ?? '加载在线人数失败');
  }

  return payload.data;
}

function SummaryCard(props: {
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="border-ink/15 bg-bgpaper/85 border border-dashed p-5">
      <p className="text-ink-secondary text-xs tracking-[0.2em]">
        {props.title}
      </p>
      <p className="text-ink mt-3 text-4xl font-semibold tabular-nums">
        {props.value}
      </p>
      <p className="text-ink-secondary mt-3 text-xs leading-6">{props.hint}</p>
    </div>
  );
}

export default function AdminOnlineUsersPage() {
  const { pushToast } = useInkUI();
  const [snapshot, setSnapshot] = useState<AdminOnlineUsersSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSnapshot = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchOnlineUsersSnapshot();
      setSnapshot(data);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载在线人数失败',
        tone: 'danger',
      });
    } finally {
      setRefreshing(false);
    }
  }, [pushToast]);

  const loadRef = useRef(loadSnapshot);
  useEffect(() => {
    loadRef.current = loadSnapshot;
  }, [loadSnapshot]);

  useEffect(() => {
    void loadRef.current();
    const timer = window.setInterval(() => {
      void loadRef.current();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          ONLINE PRESENCE
        </p>
        <h2 className="font-heading text-ink mt-2 text-3xl">在线人数</h2>
        <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
          这里按活跃角色去重统计实时在线人数。同一角色打开多个页面或重连时只计为一人。
        </p>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-5 border border-dashed p-6">
        <div className="flex flex-wrap items-center gap-3">
          <InkButton
            type="button"
            variant="secondary"
            disabled={refreshing}
            onClick={() => void loadSnapshot()}
          >
            {refreshing ? '刷新中...' : '刷新'}
          </InkButton>
          <p className="text-ink-secondary text-xs">
            数据源：{snapshot?.source === 'redis' ? 'Redis' : '本实例内存'}，
            今日：{snapshot?.today ?? '暂无'}，
            最近刷新：{formatDateTime(snapshot?.generatedAt ?? null)}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="当前在线"
            value={snapshot?.currentOnline ?? 0}
            hint="当前已建立实时连接的去重角色数"
          />
          <SummaryCard
            title="今日最高"
            value={snapshot?.todayPeakOnline ?? 0}
            hint="按服务器本地日期统计的今日峰值"
          />
          <SummaryCard
            title="历史最高"
            value={snapshot?.allTimePeakOnline ?? 0}
            hint="Redis 持久保存的历史最高在线人数"
          />
        </div>

        {snapshot?.source === 'memory' ? (
          <div className="border-gold/30 bg-gold/10 text-ink-secondary border border-dashed p-4 text-sm leading-7">
            Redis 当前不可用，页面展示的是本后端实例内存统计。多实例汇总与持久峰值会在
            Redis 恢复后继续使用 Redis 数据。
          </div>
        ) : null}
      </section>
    </div>
  );
}

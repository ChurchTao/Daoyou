import {
  REALTIME_CHANNEL_META,
  REALTIME_STATE_DOT_CLASS,
  REALTIME_STATE_LABEL,
  describeRealtimeStatus,
} from '@app/components/game-shell/realtimeStatusView';
import {
  realtimeClient,
  type RealtimeChannelStatus,
  type RealtimeStatusSnapshot,
} from '@app/lib/realtime/realtimeClient';
import type { RealtimeChannel } from '@shared/contracts/realtime';
import { cn } from '@shared/lib/cn';
import { useEffect, useState } from 'react';
import { SettingsSection, settingsLabelClass } from './SettingsFields';

function formatTime(timestamp: number | null) {
  if (!timestamp) {
    return '—';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

function ConnectionStatusRow({
  channel,
  status,
}: {
  channel: RealtimeChannel;
  status: RealtimeChannelStatus;
}) {
  const detail = status.enabled ? describeRealtimeStatus(status) : '未启用';
  const shouldShowDetail = detail !== REALTIME_STATE_LABEL[status.state];

  return (
    <div className="border-ink/15 grid gap-3 border-b border-dashed py-4 last:border-b-0 md:grid-cols-[8rem_minmax(0,1fr)] md:items-start">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            REALTIME_STATE_DOT_CLASS[status.state],
          )}
        />
        <span className="text-ink text-sm font-semibold">
          {REALTIME_CHANNEL_META[channel].label}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-crimson text-sm font-semibold">
            {REALTIME_STATE_LABEL[status.state]}
          </span>
          {shouldShowDetail ? (
            <span className="text-ink-secondary text-sm">{detail}</span>
          ) : null}
        </div>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          <div>
            <dt className={settingsLabelClass}>最近连接</dt>
            <dd className="text-ink mt-1">{formatTime(status.lastConnectedAt)}</dd>
          </div>
          <div>
            <dt className={settingsLabelClass}>最近断开</dt>
            <dd className="text-ink mt-1">
              {formatTime(status.lastDisconnectedAt)}
            </dd>
          </div>
          <div>
            <dt className={settingsLabelClass}>重连次数</dt>
            <dd className="text-ink mt-1">{status.reconnectAttempt}</dd>
          </div>
        </dl>
        {status.lastError ? (
          <p className="text-ink-secondary mt-3 text-sm leading-6">
            {status.lastError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ConnectionStatusTab() {
  const [status, setStatus] = useState<RealtimeStatusSnapshot>(() =>
    realtimeClient.getStatus(),
  );

  useEffect(() => realtimeClient.subscribeStatus(setStatus), []);

  return (
    <SettingsSection
      title="连接状态"
      description="当前浏览器与聊天、游戏实时服务器的连接情况。"
    >
      <div>
        {(Object.keys(REALTIME_CHANNEL_META) as RealtimeChannel[]).map(
          (channel) => (
            <ConnectionStatusRow
              key={channel}
              channel={channel}
              status={status.channels[channel]}
            />
          ),
        )}
      </div>
    </SettingsSection>
  );
}

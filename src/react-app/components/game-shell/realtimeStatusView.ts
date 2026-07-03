import type { RealtimeChannelStatus } from '@app/lib/realtime/realtimeClient';
import type { RealtimeChannel } from '@shared/contracts/realtime';

export const REALTIME_CHANNEL_META: Record<RealtimeChannel, { label: string }> = {
  'world-chat': { label: '聊天服务器' },
  'player-state': { label: '游戏服务器' },
};

export const REALTIME_STATE_LABEL: Record<
  RealtimeChannelStatus['state'],
  string
> = {
  idle: '待命',
  connecting: '连接中',
  online: '已连接',
  reconnecting: '重连中',
  offline: '离线',
  blocked: '受限',
};

export const REALTIME_STATE_DOT_CLASS: Record<
  RealtimeChannelStatus['state'],
  string
> = {
  idle: 'bg-ink/30',
  connecting: 'bg-wood',
  online: 'bg-teal',
  reconnecting: 'bg-wood',
  offline: 'bg-crimson',
  blocked: 'bg-crimson',
};

export function describeRealtimeStatus(status: RealtimeChannelStatus) {
  const pieces = [REALTIME_STATE_LABEL[status.state]];
  if (status.nextReconnectAt) {
    const seconds = Math.max(
      1,
      Math.ceil((status.nextReconnectAt - Date.now()) / 1_000),
    );
    pieces.push(`${seconds} 秒后重试`);
  }
  if (status.lastError) {
    pieces.push(status.lastError);
  }
  return pieces.join(' · ');
}

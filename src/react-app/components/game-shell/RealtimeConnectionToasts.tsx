import { useInkUI } from '@app/components/providers/InkUIProvider';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import type { RealtimeChannel } from '@shared/contracts/realtime';
import { useEffect, useRef } from 'react';
import { REALTIME_CHANNEL_META } from './realtimeStatusView';

export function RealtimeConnectionToasts() {
  const { pushToast } = useInkUI();
  const seenOnline = useRef<Record<RealtimeChannel, boolean>>({
    'world-chat': false,
    'player-state': false,
  });
  const disconnectToastActive = useRef(false);
  const restoreToastActive = useRef(false);

  useEffect(() => {
    return realtimeClient.subscribeStatus((next) => {
      let hasEnabledOfflineChannel = false;
      let hasEnabledOnlineChannel = false;
      let hasSeenAnyOnline = false;
      let hasBlockedChannel = false;

      for (const channel of Object.keys(REALTIME_CHANNEL_META) as RealtimeChannel[]) {
        const channelStatus = next.channels[channel];
        if (!channelStatus.enabled) {
          continue;
        }

        if (channelStatus.state === 'online') {
          hasEnabledOnlineChannel = true;
          seenOnline.current[channel] = true;
        }
        hasSeenAnyOnline = hasSeenAnyOnline || seenOnline.current[channel];

        if (
          channelStatus.state === 'reconnecting' ||
          channelStatus.state === 'offline' ||
          channelStatus.state === 'blocked'
        ) {
          hasEnabledOfflineChannel = true;
          hasBlockedChannel = hasBlockedChannel || channelStatus.state === 'blocked';
        }
      }

      if (hasSeenAnyOnline && hasEnabledOfflineChannel) {
        restoreToastActive.current = false;
        if (!disconnectToastActive.current) {
          disconnectToastActive.current = true;
          pushToast({
            message: hasBlockedChannel
              ? '实时服务器连接受限'
              : '实时服务器断开，正在重连',
            tone: hasBlockedChannel ? 'danger' : 'warning',
            duration: 3600,
          });
        }
        return;
      }

      if (disconnectToastActive.current && hasEnabledOnlineChannel) {
        disconnectToastActive.current = false;
        if (!restoreToastActive.current) {
          restoreToastActive.current = true;
          pushToast({
            message: '实时服务器连接已恢复',
            tone: 'success',
            duration: 2600,
          });
        }
        return;
      }

      if (!hasEnabledOfflineChannel) {
        restoreToastActive.current = false;
      }
    });
  }, [pushToast]);

  return null;
}

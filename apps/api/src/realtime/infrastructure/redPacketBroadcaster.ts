import type { RedPacketSummary } from '@daoyou/contracts/world-chat';
import { subscribeNatsCoreSubject } from './natsCorePubSub.js';

export type RedPacketUpdate = {
  channel: 'world' | 'sect';
  sectId: string | null;
  packet: RedPacketSummary;
};

export function subscribeRedPacketUpdates(
  listener: (update: RedPacketUpdate) => void,
) {
  return subscribeNatsCoreSubject('daoyou.realtime.red-packets', (raw) => {
    try {
      const update = JSON.parse(raw) as RedPacketUpdate;
      if (
        (update.channel === 'world' || update.channel === 'sect') &&
        typeof update.packet?.id === 'string' &&
        Number.isSafeInteger(update.packet.revision)
      )
        listener(update);
    } catch {
      /* Malformed internal notification is ignored. */
    }
  });
}

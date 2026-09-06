import { arenaView } from '@shared/combat-v6/arena';
import type {
  ArenaRuntime,
  ArenaSocketMessage,
} from '@shared/contracts/combatV6Arena';
import {
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
  waitForNatsCoreSubjectReady,
} from '../natsCorePubSub';

const subject = (id: string) => `daoyou.realtime.combat-v6.arena.${id}`;
export async function subscribeArenaV6(
  id: string,
  listener: (revision: number) => void,
) {
  const dispose = subscribeNatsCoreSubject(subject(id), (raw) => {
    const value = Number(raw);
    if (Number.isSafeInteger(value)) listener(value);
  });
  try {
    await waitForNatsCoreSubjectReady(subject(id));
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
export async function broadcastArenaV6(runtime: ArenaRuntime) {
  await publishNatsCoreMessage(
    subject(runtime.battleId),
    String(runtime.revision),
  );
}
export function arenaSocketState(
  runtime: ArenaRuntime,
  viewer: string,
): ArenaSocketMessage {
  const result = runtime.lastResults[viewer];
  const session =
    result?.revision === runtime.revision
      ? { ...result, serverNow: Date.now() }
      : arenaView(runtime, viewer, Date.now());
  const message: ArenaSocketMessage = { type: 'state', session };
  return JSON.stringify(message).length > 512000
    ? { type: 'resync', revision: runtime.revision }
    : message;
}

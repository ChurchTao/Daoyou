import { arenaView } from '@shared/combat-v6/arena';
import type {
  ArenaRuntime,
  ArenaSocketMessage,
} from '@shared/contracts/combatV6Arena';
import { ARENA_PUBLIC_VIEW } from '@shared/contracts/combatV6Arena';
import { ArenaRoomService } from '../ArenaRoomService';
import {
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
  waitForNatsCoreSubjectReady,
} from '../natsCorePubSub';
import { CombatV6ArenaStore } from './CombatV6ArenaStore';

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
  const message: ArenaSocketMessage = {
    type: 'state',
    session: {
      ...session,
      events: session.playback
        ? session.events.filter((e) => e.seq > session.playback!.fromEventSeq)
        : [],
    },
  };
  return JSON.stringify(message).length > 512000
    ? { type: 'resync', revision: runtime.revision }
    : message;
}

type SpectatorListener = {
  userId: string;
  cultivatorId: string;
  send: (message: string) => void;
  close: () => void;
};
type SpectatorGroup = {
  listeners: Set<SpectatorListener>;
  subscription: Promise<() => void>;
};
const spectators = new Map<string, SpectatorGroup>();

/** One authoritative read and serialization per battle notification, not per viewer. */
export async function subscribeArenaSpectators(
  id: string,
  listener: SpectatorListener,
) {
  let group = spectators.get(id);
  if (!group) {
    const listeners = new Set<SpectatorListener>();
    let dirty = false;
    let running = false;
    let sentRevision = -1;
    const pump = async (revision: number) => {
      if (revision <= sentRevision) return;
      dirty = true;
      if (running) return;
      running = true;
      try {
        while (dirty && listeners.size) {
          dirty = false;
          const runtime = await new CombatV6ArenaStore().get(id);
          // Resolving and result notifications can both observe the same committed result.
          if (runtime && runtime.revision <= sentRevision) continue;
          const room = runtime
            ? await new ArenaRoomService().getRoom(runtime.roomId)
            : null;
          const message = runtime
            ? JSON.stringify(arenaSocketState(runtime, ARENA_PUBLIC_VIEW))
            : '';
          for (const current of listeners) {
            if (
              !runtime ||
              room?.battleMatchId !== id ||
              !room.spectators?.some(
                (s) =>
                  s.userId === current.userId &&
                  s.cultivatorId === current.cultivatorId,
              )
            )
              current.close();
            else {
              try {
                current.send(message);
              } catch {
                current.close();
              }
            }
          }
          if (runtime) sentRevision = runtime.revision;
        }
      } catch {
        for (const current of listeners) current.close();
      } finally {
        running = false;
      }
    };
    group = {
      listeners,
      subscription: subscribeArenaV6(id, (revision) => {
        void pump(revision);
      }),
    };
    spectators.set(id, group);
  }
  group.listeners.add(listener);
  const current = group;
  const remove = () => {
    current.listeners.delete(listener);
    if (!current.listeners.size && spectators.get(id) === current) {
      spectators.delete(id);
      void current.subscription.then(
        (dispose) => dispose(),
        () => {},
      );
    }
  };
  try {
    await current.subscription;
    return remove;
  } catch (error) {
    remove();
    throw error;
  }
}

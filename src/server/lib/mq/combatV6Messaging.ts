import { getJetStreamClient } from '@server/lib/nats';
import { archiveCombatV6Replay, CombatV6ReplayConflictError } from '@server/lib/repositories/combatV6ReplayRepository';
import { combatV6TrainingSessionStore } from '@server/lib/services/combat-v6/CombatV6TrainingSessionService';
import { CombatV6RuntimeStore } from '@server/lib/services/combat-v6/CombatV6RuntimeStore';
import {
  COMBAT_V6_REPLAY_STREAM,
  COMBAT_V6_REPLAY_SUBJECT,
  CombatV6ReplayArchiveMessageV1Schema,
  parseCombatV6Replay,
  type CombatV6ReplayArchiveMessageV1,
  type CombatV6ReplayV1,
} from '@shared/contracts/combatV6Runtime';
import { DOMAIN_EVENT_STREAM, parseDomainEventEnvelope } from '@shared/contracts/domainEvents';
import { JSONCodec, type ConsumerMessages, type JsMsg } from 'nats';
import { COMBAT_V6_REPLAY_ARCHIVE_CONSUMER, consumerRetryDelayMs } from './natsTopology';

const store = new CombatV6RuntimeStore();
const codec = JSONCodec<unknown>();
let timer: NodeJS.Timeout | undefined;
let messages: ConsumerMessages | undefined;
let consumerTask: Promise<void> | undefined;
let healthy = false;
let stopping = false;

async function publishOutboxes(): Promise<void> {
  await combatV6TrainingSessionStore.expireDue();
  const jetStream = await getJetStreamClient();
  for (const battleId of await store.pending('terminal')) {
    const value = await store.outbox('terminal', battleId); if (!value) { await store.acknowledge('terminal', battleId); continue; }
    const event = parseDomainEventEnvelope((value as { event?: unknown }).event);
    await jetStream.publish(event.subject, codec.encode(event), { msgID: event.id, expect: { streamName: DOMAIN_EVENT_STREAM }, timeout: 5_000 });
    await store.markTerminalPublished(battleId);
  }
  for (const battleId of await store.pending('replay')) {
    const value = await store.outbox('replay', battleId); if (!value) { await store.acknowledge('replay', battleId); continue; }
    parseCombatV6Replay(value);
    const message: CombatV6ReplayArchiveMessageV1 = { version: 'combat_v6_replay_archive_message_v1', battleId };
    await jetStream.publish(COMBAT_V6_REPLAY_SUBJECT, codec.encode(message), { msgID: `${battleId}:combat-v6-replay`, expect: { streamName: COMBAT_V6_REPLAY_STREAM }, timeout: 5_000 });
    await store.markReplayPublished(battleId);
  }
}

async function processReplay(message: JsMsg): Promise<void> {
  try {
    const wire = CombatV6ReplayArchiveMessageV1Schema.parse(message.json());
    const value = await store.outbox('replay', wire.battleId);
    if (!value) {
      console.error('[combat-v6-replay] Redis replay payload expired before archival', { battleId: wire.battleId });
      message.term();
      return;
    }
    const replay = parseCombatV6Replay(value) as CombatV6ReplayV1;
    await archiveCombatV6Replay(replay);
    await store.acknowledge('replay', wire.battleId);
    if (!(await message.ackAck({ timeout: 5_000 }))) throw new Error('combat-v6 replay ACK was not confirmed');
  } catch (error) {
    if (error instanceof CombatV6ReplayConflictError) {
      console.error('[combat-v6-replay] permanent idempotency conflict', { sourceType: error.sourceType, idempotencyKey: error.idempotencyKey });
      message.term();
      return;
    }
    console.error('[combat-v6-replay] archive failed; retrying', { error, deliveryCount: message.info.deliveryCount });
    message.nak(consumerRetryDelayMs(message.info.deliveryCount));
  }
}

export async function startCombatV6Messaging(): Promise<void> {
  if (consumerTask) return;
  stopping = false;
  const jetStream = await getJetStreamClient();
  const consumer = await jetStream.consumers.get(COMBAT_V6_REPLAY_STREAM, COMBAT_V6_REPLAY_ARCHIVE_CONSUMER.name);
  healthy = true;
  consumerTask = (async () => {
    while (!stopping) {
      try {
        messages = await consumer.consume({ max_messages: COMBAT_V6_REPLAY_ARCHIVE_CONSUMER.concurrency });
        for await (const message of messages) {
          if (stopping) break;
          await processReplay(message);
        }
      } catch (error) {
        if (!stopping) {
          healthy = false;
          console.error('[combat-v6-replay] consumer stopped; restarting', { error });
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          healthy = true;
        }
      }
    }
  })().finally(() => { healthy = false; });
  timer = setInterval(() => void publishOutboxes().catch((error) => console.warn('[combat-v6] outbox publish failed', { error })), 10_000);
  timer.unref();
  void publishOutboxes().catch((error) => console.warn('[combat-v6] initial outbox publish failed', { error }));
}

export async function stopCombatV6Messaging(): Promise<void> {
  stopping = true; if (timer) clearInterval(timer); timer = undefined; messages?.stop(); await consumerTask; consumerTask = undefined; messages = undefined; healthy = false;
}
export function isCombatV6MessagingHealthy(): boolean { return healthy && !stopping; }

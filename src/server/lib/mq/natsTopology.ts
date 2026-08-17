import { getJetStreamManager } from '@server/lib/nats';
import {
  BACKGROUND_COMMAND_STREAM,
  BACKGROUND_COMMAND_SUBJECT_PREFIX,
} from '@shared/contracts/backgroundCommands';
import {
  DOMAIN_EVENT_STREAM,
  DOMAIN_EVENT_SUBJECT_PREFIX,
} from '@shared/contracts/domainEvents';
import {
  BATTLE_REPLAY_STREAM,
  BATTLE_REPLAY_SUBJECT,
} from '@shared/contracts/battleReplay';
import {
  BATTLE_TERMINAL_STREAM,
  BATTLE_TERMINAL_SUBJECT,
} from '@shared/contracts/battleTerminal';
import {
  BATTLE_RESOLUTION_STREAM,
  BATTLE_RESOLUTION_SUBJECT,
} from '@shared/contracts/battleResolutionTask';
import {
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  nanos,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  type ConsumerConfig,
  type ConsumerUpdateConfig,
  type StreamConfig,
} from 'nats';

export const DEAD_LETTER_STREAM = 'DAOYOU_DOMAIN_EVENT_DLQ';
export const DEAD_LETTER_SUBJECT_PREFIX = 'daoyou.dead-letter';
export const COMMAND_DEAD_LETTER_STREAM = 'DAOYOU_BACKGROUND_COMMAND_DLQ';
export const COMMAND_DEAD_LETTER_SUBJECT_PREFIX = 'daoyou.command-dead-letter';

export const BATTLE_REPLAY_ARCHIVE_CONSUMER = {
  stream: BATTLE_REPLAY_STREAM,
  name: 'battle-replay-postgres-archiver-v1',
  filterSubject: BATTLE_REPLAY_SUBJECT,
  concurrency: 2,
} as const;

export const BATTLE_TERMINAL_FINALIZER_CONSUMER = {
  stream: BATTLE_TERMINAL_STREAM,
  name: 'battle-terminal-finalizer-v1',
  filterSubject: BATTLE_TERMINAL_SUBJECT,
  concurrency: 4,
} as const;

export const BATTLE_RESOLUTION_CONSUMER = {
  stream: BATTLE_RESOLUTION_STREAM,
  name: 'battle-resolution-worker-v1',
  filterSubject: BATTLE_RESOLUTION_SUBJECT,
  concurrency: 4,
} as const;

export const BACKGROUND_COMMAND_CONSUMER = {
  stream: BACKGROUND_COMMAND_STREAM,
  name: 'background-command-worker-v1',
  filterSubject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.>`,
  concurrency: 4,
} as const;

export const DOMAIN_EVENT_CONSUMERS = {
  sectFacilityProjector: {
    name: 'sect-facility-projector-v1',
    filterSubject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.sect.construction-donated.v1`,
    concurrency: 4,
  },
  taskProjector: {
    name: 'task-projector-v1',
    filterSubject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.activity.*.v1`,
    concurrency: 8,
  },
  yieldRewardProjector: {
    name: 'yield-reward-projector-v1',
    filterSubject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.activity.yield-claimed.v1`,
    concurrency: 2,
  },
  worldRumorProjector: {
    name: 'world-rumor-projector-v1',
    filterSubject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.*.v1`,
    concurrency: 4,
  },
  rankingRealmProjector: {
    name: 'ranking-realm-projector-v1',
    filterSubject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.cultivator-realm-changed.v1`,
    concurrency: 4,
  },
  mailNotificationProjector: {
    name: 'mail-notification-projector-v1',
    filterSubject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.communication.mail-created.v1`,
    concurrency: 8,
  },
  sponsorshipOrderProjector: {
    name: 'sponsorship-order-projector-v1',
    filterSubject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.sponsorship.order-received.v1`,
    concurrency: 4,
  },
} as const;

const DOMAIN_EVENT_STREAM_CONFIG: Partial<StreamConfig> = {
  name: DOMAIN_EVENT_STREAM,
  description: 'Daoyou versioned domain integration events',
  subjects: [`${DOMAIN_EVENT_SUBJECT_PREFIX}.>`],
  retention: RetentionPolicy.Limits,
  storage: StorageType.File,
  discard: DiscardPolicy.Old,
  max_age: nanos(14 * 24 * 60 * 60 * 1_000),
  max_bytes: 2_560 * 1_024 * 1_024,
  max_msg_size: 256 * 1_024,
  duplicate_window: nanos(2 * 60 * 1_000),
  num_replicas: 1,
  allow_direct: true,
};

const DEAD_LETTER_STREAM_CONFIG: Partial<StreamConfig> = {
  name: DEAD_LETTER_STREAM,
  description: 'Daoyou terminal domain event processing failures',
  subjects: [`${DEAD_LETTER_SUBJECT_PREFIX}.>`],
  retention: RetentionPolicy.Limits,
  storage: StorageType.File,
  discard: DiscardPolicy.Old,
  max_age: nanos(30 * 24 * 60 * 60 * 1_000),
  max_bytes: 768 * 1_024 * 1_024,
  max_msg_size: 512 * 1_024,
  duplicate_window: nanos(2 * 60 * 1_000),
  num_replicas: 1,
  allow_direct: true,
};

const BACKGROUND_COMMAND_STREAM_CONFIG: Partial<StreamConfig> = {
  name: BACKGROUND_COMMAND_STREAM,
  description: 'Daoyou durable one-to-one background commands',
  subjects: [`${BACKGROUND_COMMAND_SUBJECT_PREFIX}.>`],
  retention: RetentionPolicy.Workqueue,
  storage: StorageType.File,
  discard: DiscardPolicy.Old,
  max_age: nanos(7 * 24 * 60 * 60 * 1_000),
  max_bytes: 384 * 1_024 * 1_024,
  max_msg_size: 256 * 1_024,
  duplicate_window: nanos(10 * 60 * 1_000),
  num_replicas: 1,
  allow_direct: true,
};

const COMMAND_DEAD_LETTER_STREAM_CONFIG: Partial<StreamConfig> = {
  name: COMMAND_DEAD_LETTER_STREAM,
  description: 'Daoyou terminal background command failures',
  subjects: [`${COMMAND_DEAD_LETTER_SUBJECT_PREFIX}.>`],
  retention: RetentionPolicy.Limits,
  storage: StorageType.File,
  discard: DiscardPolicy.Old,
  max_age: nanos(30 * 24 * 60 * 60 * 1_000),
  max_bytes: 128 * 1_024 * 1_024,
  max_msg_size: 512 * 1_024,
  duplicate_window: nanos(10 * 60 * 1_000),
  num_replicas: 1,
  allow_direct: true,
};

const BATTLE_REPLAY_STREAM_CONFIG: Partial<StreamConfig> = {
  name: BATTLE_REPLAY_STREAM,
  description: 'Finished battle replay archive jobs',
  subjects: [BATTLE_REPLAY_SUBJECT],
  retention: RetentionPolicy.Workqueue,
  storage: StorageType.File,
  discard: DiscardPolicy.Old,
  max_age: nanos(30 * 24 * 60 * 60 * 1_000),
  max_bytes: 512 * 1_024 * 1_024,
  max_msg_size: 64 * 1_024,
  duplicate_window: nanos(24 * 60 * 60 * 1_000),
  num_replicas: 1,
  allow_direct: true,
};

const BATTLE_TERMINAL_STREAM_CONFIG: Partial<StreamConfig> = {
  name: BATTLE_TERMINAL_STREAM,
  description: 'Durable online battle terminal cleanup events',
  subjects: [BATTLE_TERMINAL_SUBJECT],
  retention: RetentionPolicy.Workqueue,
  storage: StorageType.File,
  discard: DiscardPolicy.Old,
  max_age: nanos(30 * 24 * 60 * 60 * 1_000),
  max_bytes: 128 * 1_024 * 1_024,
  max_msg_size: 32 * 1_024,
  duplicate_window: nanos(24 * 60 * 60 * 1_000),
  num_replicas: 1,
  allow_direct: true,
};

const BATTLE_RESOLUTION_STREAM_CONFIG: Partial<StreamConfig> = {
  name: BATTLE_RESOLUTION_STREAM,
  description: 'Small durable pointers for online battle round resolution',
  subjects: [BATTLE_RESOLUTION_SUBJECT],
  retention: RetentionPolicy.Workqueue,
  storage: StorageType.File,
  discard: DiscardPolicy.Old,
  max_age: nanos(24 * 60 * 60 * 1_000),
  max_bytes: 64 * 1_024 * 1_024,
  max_msg_size: 4 * 1_024,
  duplicate_window: nanos(10 * 60 * 1_000),
  num_replicas: 1,
  allow_direct: true,
};

export const CONSUMER_RETRY_DELAYS_MS = [
  1_000,
  5_000,
  15_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
] as const;

export function consumerRetryDelayMs(deliveryCount: number): number {
  const index = Math.min(
    Math.max(0, deliveryCount - 1),
    CONSUMER_RETRY_DELAYS_MS.length - 1,
  );
  return CONSUMER_RETRY_DELAYS_MS[index]!;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String(error.code) === '404'
  );
}

async function ensureStream(config: Partial<StreamConfig> & { name: string }) {
  const manager = await getJetStreamManager();
  try {
    const current = await manager.streams.info(config.name);
    await manager.streams.update(config.name, {
      ...current.config,
      ...config,
    });
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await manager.streams.add(config);
  }
}

async function ensureConsumer(input: {
  name: string;
  filterSubject: string;
  concurrency: number;
}) {
  const manager = await getJetStreamManager();
  const mutableConfig: Partial<ConsumerUpdateConfig> = {
    description: `Daoyou domain event consumer ${input.name}`,
    ack_wait: nanos(2 * 60 * 1_000),
    max_deliver: -1,
    max_ack_pending: input.concurrency,
    max_batch: input.concurrency,
    // Keep ACK timeout independent from business retry delays. JetStream uses
    // the first backoff value as ack_wait, so an empty list is required here
    // to clear older consumer configs that accidentally reduced it to 1s.
    backoff: [],
    filter_subject: input.filterSubject,
  };
  try {
    await manager.consumers.info(DOMAIN_EVENT_STREAM, input.name);
    await manager.consumers.update(
      DOMAIN_EVENT_STREAM,
      input.name,
      mutableConfig,
    );
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await manager.consumers.add(DOMAIN_EVENT_STREAM, {
      ...mutableConfig,
      durable_name: input.name,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
    } satisfies Partial<ConsumerConfig>);
  }
}

async function ensureBackgroundCommandConsumer() {
  const manager = await getJetStreamManager();
  const mutableConfig: Partial<ConsumerUpdateConfig> = {
    description: `Daoyou command consumer ${BACKGROUND_COMMAND_CONSUMER.name}`,
    ack_wait: nanos(15 * 60 * 1_000),
    max_deliver: -1,
    max_ack_pending: BACKGROUND_COMMAND_CONSUMER.concurrency,
    max_batch: BACKGROUND_COMMAND_CONSUMER.concurrency,
    backoff: [],
    filter_subject: BACKGROUND_COMMAND_CONSUMER.filterSubject,
  };
  try {
    await manager.consumers.info(
      BACKGROUND_COMMAND_STREAM,
      BACKGROUND_COMMAND_CONSUMER.name,
    );
    await manager.consumers.update(
      BACKGROUND_COMMAND_STREAM,
      BACKGROUND_COMMAND_CONSUMER.name,
      mutableConfig,
    );
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await manager.consumers.add(BACKGROUND_COMMAND_STREAM, {
      ...mutableConfig,
      durable_name: BACKGROUND_COMMAND_CONSUMER.name,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
    } satisfies Partial<ConsumerConfig>);
  }
}

async function ensureBattleReplayConsumer() {
  const manager = await getJetStreamManager();
  const mutableConfig: Partial<ConsumerUpdateConfig> = {
    description: 'Archive finished battle replays to PostgreSQL',
    ack_wait: nanos(2 * 60 * 1_000),
    max_deliver: -1,
    max_ack_pending: BATTLE_REPLAY_ARCHIVE_CONSUMER.concurrency,
    max_batch: BATTLE_REPLAY_ARCHIVE_CONSUMER.concurrency,
    backoff: [],
    filter_subject: BATTLE_REPLAY_ARCHIVE_CONSUMER.filterSubject,
  };
  try {
    await manager.consumers.info(
      BATTLE_REPLAY_STREAM,
      BATTLE_REPLAY_ARCHIVE_CONSUMER.name,
    );
    await manager.consumers.update(
      BATTLE_REPLAY_STREAM,
      BATTLE_REPLAY_ARCHIVE_CONSUMER.name,
      mutableConfig,
    );
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await manager.consumers.add(BATTLE_REPLAY_STREAM, {
      ...mutableConfig,
      durable_name: BATTLE_REPLAY_ARCHIVE_CONSUMER.name,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
    } satisfies Partial<ConsumerConfig>);
  }
}

async function ensureBattleTerminalConsumer() {
  const manager = await getJetStreamManager();
  const mutableConfig: Partial<ConsumerUpdateConfig> = {
    description: 'Release all online battle occupancy after terminal state',
    ack_wait: nanos(2 * 60 * 1_000),
    max_deliver: -1,
    max_ack_pending: BATTLE_TERMINAL_FINALIZER_CONSUMER.concurrency,
    max_batch: BATTLE_TERMINAL_FINALIZER_CONSUMER.concurrency,
    backoff: [],
    filter_subject: BATTLE_TERMINAL_FINALIZER_CONSUMER.filterSubject,
  };
  try {
    await manager.consumers.info(
      BATTLE_TERMINAL_STREAM,
      BATTLE_TERMINAL_FINALIZER_CONSUMER.name,
    );
    await manager.consumers.update(
      BATTLE_TERMINAL_STREAM,
      BATTLE_TERMINAL_FINALIZER_CONSUMER.name,
      mutableConfig,
    );
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await manager.consumers.add(BATTLE_TERMINAL_STREAM, {
      ...mutableConfig,
      durable_name: BATTLE_TERMINAL_FINALIZER_CONSUMER.name,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
    } satisfies Partial<ConsumerConfig>);
  }
}

async function ensureBattleResolutionConsumer() {
  const manager = await getJetStreamManager();
  const mutableConfig: Partial<ConsumerUpdateConfig> = {
    description: 'Resolve one online battle round from a Redis state pointer',
    ack_wait: nanos(2 * 60 * 1_000),
    max_deliver: -1,
    max_ack_pending: BATTLE_RESOLUTION_CONSUMER.concurrency,
    max_batch: BATTLE_RESOLUTION_CONSUMER.concurrency,
    backoff: [],
    filter_subject: BATTLE_RESOLUTION_CONSUMER.filterSubject,
  };
  try {
    await manager.consumers.info(
      BATTLE_RESOLUTION_STREAM,
      BATTLE_RESOLUTION_CONSUMER.name,
    );
    await manager.consumers.update(
      BATTLE_RESOLUTION_STREAM,
      BATTLE_RESOLUTION_CONSUMER.name,
      mutableConfig,
    );
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await manager.consumers.add(BATTLE_RESOLUTION_STREAM, {
      ...mutableConfig,
      durable_name: BATTLE_RESOLUTION_CONSUMER.name,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
    } satisfies Partial<ConsumerConfig>);
  }
}

export async function ensureBattleReplayStream(): Promise<void> {
  await ensureStream(
    BATTLE_REPLAY_STREAM_CONFIG as Partial<StreamConfig> & { name: string },
  );
}

export async function ensureMessageTopology(): Promise<void> {
  await ensureStream(
    DOMAIN_EVENT_STREAM_CONFIG as Partial<StreamConfig> & { name: string },
  );
  await ensureStream(
    DEAD_LETTER_STREAM_CONFIG as Partial<StreamConfig> & { name: string },
  );
  await ensureStream(
    BACKGROUND_COMMAND_STREAM_CONFIG as Partial<StreamConfig> & {
      name: string;
    },
  );
  await ensureStream(
    COMMAND_DEAD_LETTER_STREAM_CONFIG as Partial<StreamConfig> & {
      name: string;
    },
  );
  await ensureBattleReplayStream();
  await ensureStream(
    BATTLE_TERMINAL_STREAM_CONFIG as Partial<StreamConfig> & { name: string },
  );
  await ensureStream(
    BATTLE_RESOLUTION_STREAM_CONFIG as Partial<StreamConfig> & { name: string },
  );
  await Promise.all([
    ...Object.values(DOMAIN_EVENT_CONSUMERS).map(ensureConsumer),
    ensureBackgroundCommandConsumer(),
    ensureBattleReplayConsumer(),
    ensureBattleTerminalConsumer(),
    ensureBattleResolutionConsumer(),
  ]);
  console.info('[nats] JetStream topology ready', {
    stream: DOMAIN_EVENT_STREAM,
    consumers: Object.values(DOMAIN_EVENT_CONSUMERS).map(
      (consumer) => consumer.name,
    ),
    commandStream: BACKGROUND_COMMAND_STREAM,
    commandConsumer: BACKGROUND_COMMAND_CONSUMER.name,
    battleReplayStream: BATTLE_REPLAY_STREAM,
    battleReplayConsumer: BATTLE_REPLAY_ARCHIVE_CONSUMER.name,
    battleTerminalStream: BATTLE_TERMINAL_STREAM,
    battleTerminalConsumer: BATTLE_TERMINAL_FINALIZER_CONSUMER.name,
    battleResolutionStream: BATTLE_RESOLUTION_STREAM,
    battleResolutionConsumer: BATTLE_RESOLUTION_CONSUMER.name,
  });
}

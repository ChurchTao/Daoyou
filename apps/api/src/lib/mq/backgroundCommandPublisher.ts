import { getJetStreamClient } from '@server/lib/nats/index.js';
import {
  BACKGROUND_COMMAND_DEFINITIONS,
  BACKGROUND_COMMAND_STREAM,
  parseBackgroundCommandEnvelope,
  type BackgroundCommandType,
} from '@daoyou/shared/contracts/backgroundCommands';
import { JSONCodec } from 'nats';
import { randomUUID } from 'node:crypto';

const codec = JSONCodec();

export async function publishScheduledBackgroundCommand(
  type: BackgroundCommandType,
  requestedAt = new Date(),
): Promise<{ id: string; deduplicationKey: string }> {
  const definition = BACKGROUND_COMMAND_DEFINITIONS[type];
  const scheduleBucketStartedAt = new Date(
    Math.floor(requestedAt.getTime() / definition.scheduleBucketMs) *
      definition.scheduleBucketMs,
  ).toISOString();
  const deduplicationKey = `${type}:${scheduleBucketStartedAt}`;
  const command = parseBackgroundCommandEnvelope({
    id: randomUUID(),
    type,
    version: definition.version,
    subject: definition.subject,
    requestedAt: requestedAt.toISOString(),
    scheduleBucketStartedAt,
    deduplicationKey,
  });
  const jetStream = await getJetStreamClient();
  await jetStream.publish(command.subject, codec.encode(command), {
    msgID: deduplicationKey,
    expect: { streamName: BACKGROUND_COMMAND_STREAM },
    timeout: 5_000,
  });
  return { id: command.id, deduplicationKey };
}

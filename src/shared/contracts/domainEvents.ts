import {
  QUALITY_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import { SPIRIT_FIELD_CARE_ACTIONS } from '@shared/engine/spirit-field/types';
import { ALCHEMY_MODE_VALUES } from '@shared/types/consumable';
import { z } from 'zod';

export const DOMAIN_EVENT_STREAM = 'DAOYOU_DOMAIN_EVENTS';
export const DOMAIN_EVENT_SUBJECT_PREFIX = 'daoyou.domain';

export const DOMAIN_EVENT_TYPES = [
  'sect.construction.donated',
  'alchemy.craft.completed',
  'ranking.challenge.completed',
  'dungeon.run.settled',
  'yield.claimed',
  'spirit-field.sown',
  'spirit-field.care.performed',
  'spirit-field.harvest.completed',
  'spirit-field.upgraded',
  'cultivator.realm.changed',
  'mail.created',
  'craft.item.created',
  'market.material.revealed',
  'bet-battle.created',
  'bet-battle.settled',
  'ranking.position.changed',
  'sponsorship.order.received',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export const DomainEventTypeSchema = z.enum(DOMAIN_EVENT_TYPES);

export const DomainEventDataSchemas = {
  'sect.construction.donated': z
    .object({
      cultivatorId: z.uuid(),
      sectId: z.string().min(1).max(64),
      facilityKey: z.string().min(1).max(32),
      spiritStones: z.number().int().positive(),
      constructionPoints: z.number().int().positive(),
      contribution: z.number().int().positive(),
      referenceId: z.string().min(1).max(256),
    })
    .strict(),
  'alchemy.craft.completed': z
    .object({
      cultivatorId: z.uuid(),
      actionInstanceId: z.uuid(),
      mode: z.enum(ALCHEMY_MODE_VALUES),
    })
    .strict(),
  'ranking.challenge.completed': z
    .object({
      cultivatorId: z.uuid(),
      opponentCultivatorId: z.uuid(),
      battleRecordId: z.uuid(),
    })
    .strict(),
  'dungeon.run.settled': z
    .object({
      cultivatorId: z.uuid(),
      runId: z.uuid(),
      mapNodeId: z.string().min(1).max(100),
      outcome: z.enum([
        'completed',
        'retreated_after_battle',
        'abandoned_before_battle',
      ]),
    })
    .strict(),
  'yield.claimed': z
    .object({
      cultivatorId: z.uuid(),
      actionInstanceId: z.uuid(),
      realm: z.enum(REALM_VALUES),
      materialCount: z.number().int().positive().max(100),
    })
    .strict(),
  'spirit-field.sown': z
    .object({
      cultivatorId: z.uuid(),
      spiritFieldId: z.uuid(),
      plotIndex: z.number().int().min(0).max(5),
      seedMaterialId: z.uuid(),
      plantName: z.string().min(1).max(100),
      seedQuality: z.enum(QUALITY_VALUES),
    })
    .strict(),
  'spirit-field.care.performed': z
    .object({
      cultivatorId: z.uuid(),
      spiritFieldId: z.uuid(),
      plotIndex: z.number().int().min(0).max(5),
      requestId: z.string().min(8).max(128),
      action: z.enum(SPIRIT_FIELD_CARE_ACTIONS),
      plantName: z.string().min(1).max(100),
      seedQuality: z.enum(QUALITY_VALUES),
      careGrade: z.enum(['excellent', 'good', 'poor']),
      careScore: z.number().int().min(0).max(100),
      qiCost: z.number().int().min(0).max(100),
    })
    .strict(),
  'spirit-field.harvest.completed': z
    .object({
      cultivatorId: z.uuid(),
      spiritFieldId: z.uuid(),
      plotIndex: z.number().int().min(0).max(5),
      requestId: z.string().min(8).max(128),
      mode: z.enum(['focused', 'broad']),
      plantName: z.string().min(1).max(100),
      seedQuality: z.enum(QUALITY_VALUES),
      highestQuality: z.enum(QUALITY_VALUES),
      careScore: z.number().int().min(0).max(100),
      herbQuantity: z.number().int().positive().max(10_000),
      seedReturned: z.number().int().nonnegative().max(100),
    })
    .strict(),
  'spirit-field.upgraded': z
    .object({
      cultivatorId: z.uuid(),
      spiritFieldId: z.uuid(),
      requestId: z.string().min(8).max(128),
      fromLevel: z.number().int().min(0).max(6),
      toLevel: z.number().int().min(0).max(6),
      spentSpiritStones: z.number().int().nonnegative(),
    })
    .strict(),
  'cultivator.realm.changed': z
    .object({
      userId: z.uuid(),
      cultivatorId: z.uuid(),
      actionInstanceId: z.uuid(),
      cultivatorName: z.string().min(1).max(100),
      fromRealm: z.enum(REALM_VALUES),
      fromStage: z.enum(REALM_STAGE_VALUES),
      toRealm: z.enum(REALM_VALUES),
      toStage: z.enum(REALM_STAGE_VALUES),
      major: z.boolean(),
    })
    .strict(),
  'mail.created': z
    .object({
      mailId: z.uuid(),
      cultivatorId: z.uuid(),
      mailType: z.enum(['system', 'reward']),
      attachmentCount: z.number().int().nonnegative().max(100),
    })
    .strict(),
  'craft.item.created': z
    .object({
      userId: z.uuid(),
      cultivatorId: z.uuid(),
      cultivatorName: z.string().min(1).max(100),
      itemType: z.enum(['artifact', 'skill', 'gongfa', 'consumable']),
      itemId: z.uuid(),
      itemName: z.string().min(1).max(200),
      quality: z.enum(QUALITY_VALUES),
      snapshot: z.record(z.string(), z.unknown()),
      outputs: z.array(z.record(z.string(), z.unknown())).max(8).optional(),
    })
    .strict(),
  'market.material.revealed': z
    .object({
      userId: z.uuid(),
      cultivatorId: z.uuid(),
      cultivatorName: z.string().min(1).max(100),
      materialId: z.uuid(),
      materialName: z.string().min(1).max(200),
      quality: z.enum(QUALITY_VALUES),
      snapshot: z.record(z.string(), z.unknown()),
    })
    .strict(),
  'bet-battle.created': z
    .object({
      userId: z.uuid(),
      cultivatorId: z.uuid(),
      cultivatorName: z.string().min(1).max(100),
      battleId: z.uuid(),
      taunt: z.string().min(1).max(500).optional(),
    })
    .strict(),
  'bet-battle.settled': z
    .object({
      userId: z.uuid(),
      cultivatorId: z.uuid(),
      battleId: z.uuid(),
      rumor: z.string().min(1).max(1_000),
    })
    .strict(),
  'ranking.position.changed': z
    .object({
      userId: z.uuid(),
      cultivatorId: z.uuid(),
      challengerName: z.string().min(1).max(100),
      targetName: z.string().min(1).max(100).optional(),
      realm: z.enum(REALM_VALUES),
      rank: z.number().int().positive(),
      changeType: z.enum(['direct_entry', 'challenge_win', 'vacancy_entry']),
    })
    .strict(),
  'sponsorship.order.received': z
    .object({
      orderId: z.uuid(),
      provider: z.literal('afdian'),
      providerOrderId: z.string().min(1).max(80),
    })
    .strict(),
} as const;

export type DomainEventData<TType extends DomainEventType> = z.infer<
  (typeof DomainEventDataSchemas)[TType]
>;

export const DOMAIN_EVENT_DEFINITIONS = {
  'sect.construction.donated': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.sect.construction-donated.v1`,
  },
  'alchemy.craft.completed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.activity.alchemy-craft-completed.v1`,
  },
  'ranking.challenge.completed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.activity.ranking-challenge-completed.v1`,
  },
  'dungeon.run.settled': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.activity.dungeon-run-settled.v1`,
  },
  'yield.claimed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.activity.yield-claimed.v1`,
  },
  'spirit-field.sown': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.spirit-field.sown.v1`,
  },
  'spirit-field.care.performed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.spirit-field.care-performed.v1`,
  },
  'spirit-field.harvest.completed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.spirit-field.harvest-completed.v1`,
  },
  'spirit-field.upgraded': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.spirit-field.upgraded.v1`,
  },
  'cultivator.realm.changed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.cultivator-realm-changed.v1`,
  },
  'mail.created': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.communication.mail-created.v1`,
  },
  'craft.item.created': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.craft-item-created.v1`,
  },
  'market.material.revealed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.market-material-revealed.v1`,
  },
  'bet-battle.created': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.bet-battle-created.v1`,
  },
  'bet-battle.settled': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.bet-battle-settled.v1`,
  },
  'ranking.position.changed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.ranking-position-changed.v1`,
  },
  'sponsorship.order.received': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.sponsorship.order-received.v1`,
  },
} as const satisfies Record<
  DomainEventType,
  { version: number; subject: string }
>;

const DomainEventEnvelopeBaseSchema = z
  .object({
    id: z.uuid(),
    type: DomainEventTypeSchema,
    version: z.number().int().positive(),
    subject: z.string().min(1).max(160),
    occurredAt: z.string().datetime(),
    aggregate: z
      .object({
        type: z.string().min(1).max(64),
        id: z.string().min(1).max(128),
      })
      .strict(),
    correlationId: z.string().min(1).max(128).optional(),
    causationId: z.string().min(1).max(128).optional(),
    data: z.unknown(),
  })
  .strict();

export type DomainEventEnvelope<
  TType extends DomainEventType = DomainEventType,
> = {
  id: string;
  type: TType;
  version: number;
  subject: string;
  occurredAt: string;
  aggregate: { type: string; id: string };
  correlationId?: string;
  causationId?: string;
  data: DomainEventData<TType>;
};

export function parseDomainEventEnvelope(input: unknown): DomainEventEnvelope {
  const envelope = DomainEventEnvelopeBaseSchema.parse(input);
  const definition = DOMAIN_EVENT_DEFINITIONS[envelope.type];
  if (
    envelope.version !== definition.version ||
    envelope.subject !== definition.subject
  ) {
    throw new Error(
      `领域事件定义不匹配: ${envelope.type}@v${envelope.version} subject=${envelope.subject}`,
    );
  }

  return {
    ...envelope,
    data: DomainEventDataSchemas[envelope.type].parse(envelope.data),
  } as DomainEventEnvelope;
}

export function isDomainEventType<TType extends DomainEventType>(
  event: DomainEventEnvelope,
  type: TType,
): event is DomainEventEnvelope<TType> {
  return event.type === type;
}

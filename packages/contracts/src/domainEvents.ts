import {
  DomainEventTypeSchema,
  type DomainEventType,
  type DomainEventData,
  type createDomainEventDataSchemas,
} from '@daoyou/game-domain/events';

import { z } from 'zod';

export const DOMAIN_EVENT_STREAM = 'DAOYOU_DOMAIN_EVENTS';

export const DOMAIN_EVENT_SUBJECT_PREFIX = 'daoyou.domain';

export const DOMAIN_EVENT_DEFINITIONS = {
  'cultivator.mail-audience.observed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.system-mail.audience-observed.v1`,
  },
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
  'equipment.forged': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.equipment-forged.v1`,
  },
  'market.material.revealed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.market-material-revealed.v1`,
  },
  'ranking.position.changed': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.ranking-position-changed.v1`,
  },
  'beast.exceptional.acquired': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.gameplay.beast-exceptional-acquired.v1`,
  },
  'sponsorship.order.received': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.sponsorship.order-received.v1`,
  },
  'combat.v6.battle.finished': {
    version: 1,
    subject: `${DOMAIN_EVENT_SUBJECT_PREFIX}.battle.combat-v6-battle-finished.v1`,
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

export function createDomainEventParser(
  DomainEventDataSchemas: ReturnType<typeof createDomainEventDataSchemas>,
) {
  function parseDomainEventEnvelope(input: unknown): DomainEventEnvelope {
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
  return parseDomainEventEnvelope;
}

export function isDomainEventType<TType extends DomainEventType>(
  event: DomainEventEnvelope,
  type: TType,
): event is DomainEventEnvelope<TType> {
  return event.type === type;
}

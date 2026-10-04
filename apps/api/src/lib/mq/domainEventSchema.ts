import { createDomainEventParser } from '@daoyou/contracts/events';
import { DomainEventDataSchemas } from '@daoyou/game-rules/events';

export const parseDomainEventEnvelope = createDomainEventParser(
  DomainEventDataSchemas,
);

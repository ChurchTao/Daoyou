import type { DbTransaction } from '@server/lib/drizzle/db';
import { spiritFields } from '@server/lib/drizzle/schema';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import { eq, sql } from 'drizzle-orm';
import type { FeatureCommandResult } from './CommandExecutors';

export async function projectSpiritFieldProgressionDomainEvent(
  event: DomainEventEnvelope,
  tx: DbTransaction,
): Promise<FeatureCommandResult<{ status: 'applied' | 'ignored'; gained?: number }>> {
  let cultivatorId: string;
  let spiritFieldId: string;
  let gained: number;

  if (isDomainEventType(event, 'spirit-field.sown')) {
    cultivatorId = event.data.cultivatorId;
    spiritFieldId = event.data.spiritFieldId;
    gained = 1;
  } else if (isDomainEventType(event, 'spirit-field.care.performed')) {
    cultivatorId = event.data.cultivatorId;
    spiritFieldId = event.data.spiritFieldId;
    gained =
      event.data.careGrade === 'excellent'
        ? 3
        : event.data.careGrade === 'good'
          ? 2
          : 1;
  } else if (isDomainEventType(event, 'spirit-field.harvest.completed')) {
    cultivatorId = event.data.cultivatorId;
    spiritFieldId = event.data.spiritFieldId;
    gained = 2 + Math.floor(event.data.careScore / 25);
  } else if (isDomainEventType(event, 'spirit-field.upgraded')) {
    cultivatorId = event.data.cultivatorId;
    spiritFieldId = event.data.spiritFieldId;
    gained = 5;
  } else {
    return { result: { status: 'ignored' }, resourceChanges: [] };
  }

  await lockCultivatorForStateMutation(tx, cultivatorId);
  await tx
    .update(spiritFields)
    .set({
      proficiency: sql`${spiritFields.proficiency} + ${gained}`,
      version: sql`${spiritFields.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(spiritFields.id, spiritFieldId));

  return {
    result: { status: 'applied', gained },
    resourceChanges: [],
  };
}

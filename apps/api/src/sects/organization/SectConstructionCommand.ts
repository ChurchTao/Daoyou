import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import {
  releaseSectConstructionDaily,
  reserveSectConstructionDaily,
  type SectConstructionDailyRecord,
} from '@server/lib/redis/sectConstructionDaily.js';
import { quoteSectConstructionDonation } from '@daoyou/shared/engine/sect';
import { sectOrganizationFacade } from '@server/sects/organization/index.js';
import { SectError } from '@server/sects/application/SectError.js';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from '@server/sects/organization/commandSupport.js';
import { createPostgresSectConstructionCommandContext } from '@server/sects/organization/PostgresSectOrganizationAdapters.js';
import { getSectDateKey } from '@server/sects/organization/SectOrganizationClock.js';

export async function executeSectConstructionDonationCommand(
  args: SectCommandArgs & {
    facilityKey: string;
    spiritStones: number;
  },
) {
  const quote = quoteSectConstructionDonation(args.spiritStones);
  const dateKey = getSectDateKey();
  const record: SectConstructionDailyRecord = {
    requestId: args.idempotency.key,
    facilityKey: args.facilityKey,
    spiritStones: quote.spiritStones,
    constructionPoints: quote.constructionPoints,
    contribution: quote.contribution,
  };
  const reservation = await reserveSectConstructionDaily(
    args.userId,
    dateKey,
    record,
  );
  if (reservation === 'conflict')
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      '今日已经完成过一次设施建设',
      409,
    );

  let committed;
  try {
    committed = await executeSectPlayerCommand(args, (tx) =>
      sectOrganizationFacade.construction.donate(
        args.cultivatorId,
        {
          facilityKey: args.facilityKey,
          spiritStones: quote.spiritStones,
          referenceId: args.idempotency.key,
          dailyStatus: {
            dateKey,
            constructedToday: true,
            facilityKey: args.facilityKey,
            spiritStones: quote.spiritStones,
            constructionPoints: quote.constructionPoints,
            contribution: quote.contribution,
          },
        },
        createPostgresSectConstructionCommandContext({
          q: tx,
          runtime: args.runtime,
        }),
      ),
    );
  } catch (error) {
    if (reservation === 'created') {
      try {
        await releaseSectConstructionDaily(args.userId, dateKey, record);
      } catch (releaseError) {
        console.error(
          '[sect-construction] failed to release daily reservation',
          {
            userId: args.userId,
            dateKey,
            releaseError,
          },
        );
      }
    }
    throw error;
  }

  publishTransactionalMessageBestEffort(committed.result.eventId, {
    source: 'sect_construction',
  });
  return committed;
}

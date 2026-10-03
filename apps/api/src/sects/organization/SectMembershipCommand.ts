import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import type { RealmStage, RealmType } from '@daoyou/shared/types/constants';
import { eq } from 'drizzle-orm';
import { SectError } from '@server/sects/application/SectError.js';
import { StoryService } from '@server/story/application/StoryService.js';
import { sectOrganizationFacade } from '@server/sects/organization/index.js';
import { createPostgresSectMembershipCommandContext } from '@server/sects/organization/PostgresSectOrganizationAdapters.js';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from '@server/sects/organization/commandSupport.js';

export function executeSectPromotionCommand(args: SectCommandArgs) {
  return executeSectPlayerCommand(args, async (tx) => {
    const cultivator = await requireCultivatorSectFacts(
      args.cultivatorId,
      tx,
    );
    return sectOrganizationFacade.membership.promote(
      {
        id: args.cultivatorId,
        realm: cultivator.realm as RealmType,
        realm_stage: cultivator.realm_stage as RealmStage,
      },
      createPostgresSectMembershipCommandContext({
        q: tx,
        runtime: args.runtime,
      }),
    );
  });
}

export function executeSectJoinCommand(
  args: SectCommandArgs & {
    sectId: string;
    admission: (
      tx: DbTransaction,
    ) => ReturnType<typeof sectOrganizationFacade.admission>;
  },
) {
  return executeSectPlayerCommand(args, async (tx) => {
    const joined = await args.admission(tx).joinCommand(
      args.cultivatorId,
      args.sectId,
    );
    const story = await StoryService.reconcile(args.cultivatorId, tx);
    return {
      result: joined.result,
      resourceChanges: [
        ...joined.resourceChanges,
        ...(story?.changes ?? []),
      ],
    };
  });
}

async function requireCultivatorSectFacts(
  cultivatorId: string,
  tx: DbTransaction,
) {
  const row = await tx.query.cultivators.findFirst({
    columns: { id: true, realm: true, realm_stage: true },
    where: eq(cultivators.id, cultivatorId),
  });
  if (!row) throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在');
  return row;
}

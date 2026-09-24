import type { DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { eq } from 'drizzle-orm';
import { SectError } from '../SectError';
import { StoryService } from '../StoryService';
import { sectOrganizationFacade } from '.';
import { createPostgresSectMembershipCommandContext } from './PostgresSectOrganizationAdapters';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from './commandSupport';

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

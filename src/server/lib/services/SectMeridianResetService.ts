import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  sectMemberships,
  sectMeridianLoadouts,
} from '@server/lib/drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';

export class SectMeridianResetServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SectMeridianResetServiceError';
  }
}

export const SectMeridianResetService = {
  async resetSelectedNodes(args: {
    cultivatorId: string;
    tx: DbTransaction;
  }): Promise<{ resetLoadoutCount: number }> {
    const [membership] = await args.tx
      .select({ id: sectMemberships.id })
      .from(sectMemberships)
      .where(
        and(
          eq(sectMemberships.cultivatorId, args.cultivatorId),
          eq(sectMemberships.status, 'active'),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new SectMeridianResetServiceError('尚未拜入宗门，无法重置流派节点');
    }

    const resetRows = await args.tx
      .update(sectMeridianLoadouts)
      .set({
        nodeIds: [],
        version: sql`${sectMeridianLoadouts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sectMeridianLoadouts.membershipId, membership.id),
          sql`jsonb_array_length(${sectMeridianLoadouts.nodeIds}) > 0`,
        ),
      )
      .returning({ id: sectMeridianLoadouts.id });

    if (resetRows.length === 0) {
      throw new SectMeridianResetServiceError('当前宗门流派没有已选择的节点');
    }

    return { resetLoadoutCount: resetRows.length };
  },
};

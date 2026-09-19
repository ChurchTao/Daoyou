import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  sectCombatStates,
  sectMeridianLoadouts,
  sectMeridianNodes,
} from '@server/lib/drizzle/schema';
import { readActiveSectCombatProgress } from '@server/lib/repositories/sectCombatRepository';
import { eq, inArray, sql } from 'drizzle-orm';
import { assertInventoryIdle } from './InventoryService';

export class SectMeridianResetServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SectMeridianResetServiceError';
  }
}

export const SectMeridianResetService = {
  // Caller owns the cultivator mutation lock and transaction, including talisman consumption.
  async resetSelectedNodes(args: {
    cultivatorId: string;
    tx: DbTransaction;
  }): Promise<{ resetLoadoutCount: number }> {
    await assertInventoryIdle(args.cultivatorId);
    const build = await readActiveSectCombatProgress(args.cultivatorId, args.tx);
    if (!build) throw new SectMeridianResetServiceError('请先启用新版宗门传承');
    const paths = build.sect.meridianLoadouts
      .filter((loadout) => loadout.nodeIds.length > 0)
      .map((loadout) => loadout.pathId);
    if (!paths.length)
      throw new SectMeridianResetServiceError('当前宗门流派没有已选择的节点');
    const rows = await args.tx
      .select({ id: sectMeridianLoadouts.id })
      .from(sectMeridianLoadouts)
      .where(eq(sectMeridianLoadouts.membershipId, build.membershipId));
    const ids = rows.map((row) => row.id);
    await args.tx
      .delete(sectMeridianNodes)
      .where(inArray(sectMeridianNodes.loadoutId, ids));
    await args.tx
      .update(sectMeridianLoadouts)
      .set({ revision: sql`${sectMeridianLoadouts.revision} + 1` })
      .where(inArray(sectMeridianLoadouts.id, ids));
    await args.tx
      .update(sectCombatStates)
      .set({ revision: build.revision + 1 })
      .where(eq(sectCombatStates.membershipId, build.membershipId));
    return { resetLoadoutCount: paths.length };
  },
};

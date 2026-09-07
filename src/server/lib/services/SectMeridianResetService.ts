import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  combatV6BuildProfiles,
  combatV6MeridianLoadouts,
  combatV6MeridianNodes,
} from '@server/lib/drizzle/schema';
import { loadActiveCombatV6Build } from '@server/lib/repositories/combatV6BuildRepository';
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
    const build = await loadActiveCombatV6Build(args.cultivatorId, args.tx);
    if (!build) throw new SectMeridianResetServiceError('请先启用新版宗门传承');
    const paths = build.sect.meridianLoadouts
      .filter((loadout) => loadout.nodeIds.length > 0)
      .map((loadout) => loadout.pathId);
    if (!paths.length)
      throw new SectMeridianResetServiceError('当前宗门流派没有已选择的节点');
    const rows = await args.tx
      .select({ id: combatV6MeridianLoadouts.id })
      .from(combatV6MeridianLoadouts)
      .where(eq(combatV6MeridianLoadouts.profileId, build.profileId));
    const ids = rows.map((row) => row.id);
    await args.tx
      .delete(combatV6MeridianNodes)
      .where(inArray(combatV6MeridianNodes.loadoutId, ids));
    await args.tx
      .update(combatV6MeridianLoadouts)
      .set({ revision: sql`${combatV6MeridianLoadouts.revision} + 1` })
      .where(inArray(combatV6MeridianLoadouts.id, ids));
    await args.tx
      .update(combatV6BuildProfiles)
      .set({ revision: build.revision + 1 })
      .where(eq(combatV6BuildProfiles.id, build.profileId));
    return { resetLoadoutCount: paths.length };
  },
};

import type { DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { findActiveCombatV6Membership, findCombatV6Profile } from '@server/lib/repositories/combatV6BuildRepository';
import { rebaseCharacterResources } from '@shared/lib/cultivatorDisplay';
import { evaluateFateContext } from '@shared/lib/fates';
import type { CultivatorCondition } from '@shared/types/condition';
import { eq } from 'drizzle-orm';
import { getCultivatorPreHeavenFates } from '../cultivator/CultivatorProfileRepository';
import { readCombatV6ConditionAuthority } from './CombatV6ConditionAuthority';

/** Runs in the build/profile mutation transaction, before its condition invalidation is published. */
export async function refreshCombatV6CharacterResources(id: string, tx: DbTransaction) {
  const [row] = await tx.select({ condition: cultivators.condition })
    .from(cultivators).where(eq(cultivators.id, id)).for('update');
  if (!row?.condition) return;
  const membership = await findActiveCombatV6Membership(id, tx);
  // Joining/transferring a sect must be able to enter its existing build-initialization flow.
  // The read model still reports "not ready" until initialization supplies an active build.
  if (membership && (await findCombatV6Profile(membership.membershipId, tx))?.status !== 'active') return;
  const condition = row.condition as CultivatorCondition;
  const authority = await readCombatV6ConditionAuthority(id, tx);
  if (condition.resources.hp.max === authority.maxHp && condition.resources.mp.max === authority.maxMp) return;
  const recovery = evaluateFateContext(await getCultivatorPreHeavenFates(id, tx));
  const next = rebaseCharacterResources(condition, authority, new Date(), recovery);
  await tx.update(cultivators).set({ condition: next }).where(eq(cultivators.id, id));
}

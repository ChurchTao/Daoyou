import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { rebaseCharacterResources } from '@daoyou/shared/lib/cultivatorDisplay';
import { evaluateFateContext } from '@daoyou/shared/lib/fates';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import { eq } from 'drizzle-orm';
import { getCultivatorPreHeavenFates } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
import { readCombatV6ConditionAuthority } from '@server/combat/application/CombatV6ConditionAuthority.js';

/** Runs in the build/profile mutation transaction, before its condition invalidation is published. */
export async function refreshCombatV6CharacterResources(id: string, tx: DbTransaction) {
  const [row] = await tx.select({ condition: cultivators.condition })
    .from(cultivators).where(eq(cultivators.id, id)).for('update');
  if (!row?.condition) return;
  const condition = row.condition as CultivatorCondition;
  const authority = await readCombatV6ConditionAuthority(id, tx);
  if (condition.resources.hp.max === authority.maxHp && condition.resources.mp.max === authority.maxMp) return;
  const recovery = evaluateFateContext(await getCultivatorPreHeavenFates(id, tx));
  const next = rebaseCharacterResources(condition, authority, new Date(), recovery);
  await tx.update(cultivators).set({ condition: next }).where(eq(cultivators.id, id));
}

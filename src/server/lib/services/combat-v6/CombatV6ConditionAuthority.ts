import type { DbExecutor } from '@server/lib/drizzle/db';
import {
  findActiveCombatV6Membership,
  findCombatV6Profile,
} from '@server/lib/repositories/combatV6BuildRepository';
import { projectCultivatorMultiSectV5ToCombatV6 } from '@shared/engine/combat-v6/projection';
import { assembleCombatV6TrainingPlayer } from './CombatV6BuildService';
import { CombatV6WildStore } from './CombatV6WildStore';

/** Read-model annotation only. Never persisted into cultivators.condition. */
export async function readCombatV6ConditionAuthority(
  id: string,
  q: DbExecutor,
) {
  const store = new CombatV6WildStore();
  const lock = await store.lock(id);
  if (lock) {
    const summary = await store.summary(lock);
    if (!summary) throw new Error('WILD_SETTLEMENT_MISSING');
    return {
      maxHp: summary.entry.maxHp,
      maxMp: summary.entry.maxMp,
      recoveryPaused: true,
    };
  }
  const membership = await findActiveCombatV6Membership(id, q);
  if (
    !membership ||
    (await findCombatV6Profile(membership.membershipId, q))?.status !== 'active'
  )
    return undefined;
  const { player } = await assembleCombatV6TrainingPlayer(id, q);
  const projected = projectCultivatorMultiSectV5ToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('COMBAT_V6_BUILD_INVALID');
  return {
    maxHp: projected.unit.attrs.maxHp!,
    maxMp: projected.unit.attrs.maxMp!,
    recoveryPaused: false,
  };
}

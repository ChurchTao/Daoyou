import type { BattleEvent, BattleState } from '@daoyou/combat-core/types';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { WildResources, WildSettlement } from '@daoyou/game-domain/wild';
import {
  beastDeathIds,
  settleBeastVitals,
} from '@daoyou/game-rules/beasts/growth';
import { evaluateFateContext } from '@daoyou/game-rules/character/fates';
import { settleWildResources } from '@daoyou/game-rules/combat/wild';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import { getCultivatorPreHeavenFates } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivatorBeasts, cultivators } from '@server/lib/drizzle/schema.js';
import {
  beastFromRow,
  beastIndividualData,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import { and, eq, inArray } from 'drizzle-orm';
import { readCombatV6ConditionAuthority } from './CombatV6ConditionAuthority.js';

export function battleBeastVitals(
  state: BattleState,
  events: readonly BattleEvent[],
  ownerId: string,
) {
  const deaths = new Set(beastDeathIds(events));
  return state.units.flatMap((unit) => {
    if (unit.ownerId !== ownerId || !unit.id.startsWith('beast:')) return [];
    const id = unit.id.slice(6);
    const died = deaths.has(id);
    if (!died && !unit.marks.includes('battle:deployed')) return [];
    return [
      {
        id,
        died,
        hp: Math.floor(unit.attrs.hp),
        mp: Math.floor(unit.attrs.mp),
      },
    ];
  });
}

/** Call inside the owning battle's terminal transaction, after claiming its receipt. */
export async function persistBattleVitals(
  tx: DbTransaction,
  cultivatorId: string,
  final: WildResources,
  beasts: NonNullable<WildSettlement['beasts']>,
  now = new Date(),
) {
  const [row] = await tx
    .select({ condition: cultivators.condition })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId));
  if (!row?.condition) throw new Error('角色资源缺失');
  const resources = settleWildResources(final, final, false);
  const condition = ConditionService.applyCombatV6Resources(
    row.condition as CultivatorCondition,
    resources,
    now,
  );
  await tx
    .update(cultivators)
    .set({ condition })
    .where(eq(cultivators.id, cultivatorId));
  if (!beasts.length) return;
  const outcomes = new Map(beasts.map((beast) => [beast.id, beast]));
  const rows = await tx
    .select()
    .from(cultivatorBeasts)
    .where(
      and(
        eq(cultivatorBeasts.cultivatorId, cultivatorId),
        inArray(cultivatorBeasts.id, [...outcomes.keys()]),
      ),
    );
  for (const pet of rows) {
    const beast = beastFromRow(pet);
    const next = settleBeastVitals(beast, outcomes.get(beast.id)!);
    if (next === beast) continue;
    await tx
      .update(cultivatorBeasts)
      .set({ individual: beastIndividualData(next) })
      .where(eq(cultivatorBeasts.id, beast.id));
  }
}

export async function settlePersistentBattle(
  tx: DbTransaction,
  cultivatorId: string,
  state: BattleState,
  events: readonly BattleEvent[],
  unitId = cultivatorId,
  entry?: { maxHp?: number; maxMp?: number },
) {
  const unit = state.units.find((entry) => entry.id === unitId);
  if (!unit) throw new Error('结算缺少参战人物');
  await persistBattleVitals(
    tx,
    cultivatorId,
    {
      mp: unit.attrs.mp,
      hp: unit.flags.dead || unit.flags.downed ? 0 : unit.attrs.hp,
      maxHp: entry?.maxHp ?? unit.attrs.maxHp,
      maxMp: entry?.maxMp ?? unit.attrs.maxMp,
    },
    battleBeastVitals(state, events, unitId),
  );
}

export async function recoverPersistentBattleCondition(
  cultivatorId: string,
  condition: CultivatorCondition,
  maxima: { maxHp: number; maxMp: number },
  q: DbExecutor,
  now = new Date(),
) {
  return ConditionService.recoverCombatV6Resources(
    condition,
    maxima,
    now,
    evaluateFateContext(await getCultivatorPreHeavenFates(cultivatorId, q)),
  );
}

export async function readPersistentCharacterVitals(
  cultivatorId: string,
  q: DbExecutor,
) {
  const [row] = await q
    .select({ condition: cultivators.condition })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId));
  if (!row?.condition) throw new Error('角色资源缺失');
  const authority = await readCombatV6ConditionAuthority(cultivatorId, q);
  const condition = row.condition as CultivatorCondition;
  const recovered = authority.recoveryPaused
    ? condition
    : await recoverPersistentBattleCondition(
        cultivatorId,
        condition,
        authority,
        q,
      );
  return {
    hp: Math.floor(recovered.resources.hp.current),
    mp: Math.floor(recovered.resources.mp.current),
    maxHp: authority.maxHp,
    maxMp: authority.maxMp,
  };
}

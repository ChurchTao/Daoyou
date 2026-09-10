import {
  db,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  characterIdentityRow,
  loadActiveCombatV6Build,
} from '@server/lib/repositories/combatV6BuildRepository';
import { findCultivatorOwnerStatusById } from '@server/lib/repositories/cultivatorRepository';
import { publicCombatV6Build } from '@shared/combat-v6/public-build';
import type { CultivatorInspectionData } from '@shared/contracts/player';
import type { CultivatorCondition } from '@shared/types/condition';
import { getPlayerIdentityCultivatorById } from './CultivatorProfileRepository';

export async function loadCultivatorInspectionData(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<CultivatorInspectionData | null> {
  if (!executor)
    return db.transaction(
      (tx) => loadCultivatorInspectionData(cultivatorId, tx),
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  const q = executor;
  const owner = await findCultivatorOwnerStatusById(cultivatorId, q);
  if (!owner || owner.status !== 'active') return null;
  const identity = await getPlayerIdentityCultivatorById(
    owner.userId,
    cultivatorId,
    q,
  );
  const row = await characterIdentityRow(cultivatorId, q);
  if (!identity || !row) return null;
  const condition = (row.condition as CultivatorCondition | null) ?? undefined;
  const build = await loadActiveCombatV6Build(cultivatorId, q);
  const publicBuild = build
    ? publicCombatV6Build({ ...identity, condition }, build)
    : { combatPanel: null, build: null };
  return {
    ...publicBuild,
    id: identity.id,
    name: identity.name,
    title: identity.title,
    gender: identity.gender,
    background: identity.background,
    realm: identity.realm,
    realm_stage: identity.realm_stage,
    attributes: identity.attributes,
    spiritual_roots: identity.spiritual_roots,
    pre_heaven_fates: identity.pre_heaven_fates,
    condition,
  };
}

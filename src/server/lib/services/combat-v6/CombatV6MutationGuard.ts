import { hasActiveCombat } from './CombatOccupancy';

const sensitive =
  /^(consumable_use|inn_recovery|body_cultivation|marrow_wash|fate_reshape|active_reincarnate|profile_attribute|task_challenge|tower_battle|retreat_|ranking_challenge|product_equip|artifact_equip|sect[._-]|dungeon|spirit_field)/;
export class CombatV6MutationLockedError extends Error {
  readonly code = 'WILD_SETTLEMENT_LOCKED';
  readonly status = 409;
  constructor() {
    super('战斗或资源结算期间无法进行此操作');
  }
}
export async function assertCombatV6MutationAllowed(
  cultivatorId: string,
  source: string,
) {
  if (!sensitive.test(source)) return;
  // 秘境流程自己会推进或结束其战斗，不能被这场秘境战斗拦住。
  const occupied = await hasActiveCombat(cultivatorId, {
    includeDungeon: !source.startsWith('dungeon'),
  });
  if (occupied) throw new CombatV6MutationLockedError();
}

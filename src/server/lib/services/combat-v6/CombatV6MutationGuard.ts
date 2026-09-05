import { CombatV6WildStore } from './CombatV6WildStore';

const sensitive =
  /^(consumable_use|inn_recovery|body_cultivation|marrow_wash|fate_reshape|active_reincarnate|profile_attribute|task_challenge|tower_battle|retreat_|bet_battle_(create|challenge)|ranking_challenge|product_equip|artifact_equip|sect[._-]|dungeon|spirit_field)/;
export class CombatV6MutationLockedError extends Error {
  readonly code = 'WILD_SETTLEMENT_LOCKED';
  readonly status = 409;
  constructor() {
    super('野外战斗或资源结算期间无法进行此操作');
  }
}
export async function assertCombatV6MutationAllowed(
  cultivatorId: string,
  source: string,
) {
  if (
    sensitive.test(source) &&
    (await new CombatV6WildStore().lock(cultivatorId))
  ) {
    throw new CombatV6MutationLockedError();
  }
}

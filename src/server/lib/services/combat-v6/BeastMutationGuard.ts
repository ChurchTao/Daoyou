import { hasActiveCombat } from './CombatOccupancy';

export class BeastError extends Error {
  readonly status = 409;
}
export async function beastMutationOccupied(
  cultivatorId: string,
): Promise<boolean> {
  return hasActiveCombat(cultivatorId);
}
export async function assertBeastIdle(cultivatorId: string) {
  if (await beastMutationOccupied(cultivatorId))
    throw new BeastError('请先结束战斗与结算，再调整灵兽');
}

import type { SectTasksData, SectTaskViewData } from '@daoyou/shared/contracts/sect';

export const MINING_TASK_ID = 'spirit_mining';

export type MiningActivityMode =
  | { kind: 'reward'; task: SectTaskViewData }
  | {
      kind: 'practice';
      task?: SectTaskViewData;
      reason: 'not_accepted' | 'settled' | 'locked' | 'unavailable';
    };

export function findMiningTask(
  tasks?: SectTasksData,
): SectTaskViewData | undefined {
  return tasks?.items.find((task) => task.definitionId === MINING_TASK_ID);
}

export function resolveMiningActivityMode(
  tasks?: SectTasksData,
): MiningActivityMode {
  const task = findMiningTask(tasks);
  if (task?.state === 'active') return { kind: 'reward', task };
  if (task?.state === 'claimable' || task?.state === 'claimed')
    return { kind: 'practice', task, reason: 'settled' };
  if (task?.state === 'offered')
    return { kind: 'practice', task, reason: 'not_accepted' };
  if (task?.state === 'locked')
    return { kind: 'practice', task, reason: 'locked' };
  return { kind: 'practice', reason: 'unavailable' };
}

export function miningActivityMessage(mode: MiningActivityMode): string {
  if (mode.kind === 'reward')
    return '本局成绩将作为今日灵矿采掘委托的验收依据。';
  if (mode.reason === 'settled')
    return '今日采掘回执已经生成，本局为自由练习，不会重复发放奖励。';
  if (mode.reason === 'not_accepted')
    return '尚未在宗门事务领取灵矿采掘委托，本局为自由练习。';
  if (mode.reason === 'locked')
    return '当前尚未取得采掘委托权限，本局为自由练习。';
  return '当前未发现可结算的采掘委托，本局为自由练习。';
}

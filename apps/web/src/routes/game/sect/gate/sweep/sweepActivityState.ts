import type { SectTasksData, SectTaskViewData } from '@daoyou/shared/contracts/sect';

export const SWEEP_TASK_ID = 'gate_sweep';

export type SweepActivityMode =
  | { kind: 'reward'; task: SectTaskViewData }
  | {
      kind: 'practice';
      task?: SectTaskViewData;
      reason: 'not_accepted' | 'settled' | 'locked' | 'unavailable';
    };

export function findSweepTask(
  tasks?: SectTasksData,
): SectTaskViewData | undefined {
  return tasks?.items.find((task) => task.definitionId === SWEEP_TASK_ID);
}

export function resolveSweepActivityMode(
  tasks?: SectTasksData,
): SweepActivityMode {
  const task = findSweepTask(tasks);
  if (task?.state === 'active') return { kind: 'reward', task };
  if (task?.state === 'claimable' || task?.state === 'claimed')
    return { kind: 'practice', task, reason: 'settled' };
  if (task?.state === 'offered')
    return { kind: 'practice', task, reason: 'not_accepted' };
  if (task?.state === 'locked')
    return { kind: 'practice', task, reason: 'locked' };
  return { kind: 'practice', reason: 'unavailable' };
}

export function sweepActivityMessage(mode: SweepActivityMode): string {
  if (mode.kind === 'reward') return '本局将验收为今日的清扫山门委托。';
  if (mode.reason === 'settled')
    return '今日委托回执已经生成，本局为自由练习，不会重复结算。';
  if (mode.reason === 'not_accepted')
    return '尚未在宗门事务领取清扫委托，本局为自由练习。';
  if (mode.reason === 'locked')
    return '当前尚未取得清扫委托权限，本局为自由练习。';
  return '当前未发现可结算的清扫委托，本局为自由练习。';
}

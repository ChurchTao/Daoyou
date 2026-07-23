import type {
  SectTasksData,
  SectTaskViewData,
} from '@shared/contracts/sect';

export const SWEEP_TASK_ID = 'gate_sweep';

export type SweepActivityMode =
  | { kind: 'reward'; task: SectTaskViewData }
  | {
      kind: 'practice';
      task?: SectTaskViewData;
      reason: 'not_accepted' | 'completed' | 'other_daily' | 'unavailable';
    };

export function findSweepTask(
  tasks?: SectTasksData,
): SectTaskViewData | undefined {
  return tasks?.sections.daily.find(
    (task) => task.definitionId === SWEEP_TASK_ID,
  );
}

export function resolveSweepActivityMode(
  tasks?: SectTasksData,
): SweepActivityMode {
  const task = findSweepTask(tasks);
  if (task?.state === 'active') return { kind: 'reward', task };
  if (task?.state === 'completed')
    return { kind: 'practice', task, reason: 'completed' };
  if (task?.state === 'offered')
    return { kind: 'practice', task, reason: 'not_accepted' };
  if (task?.state === 'locked')
    return { kind: 'practice', task, reason: 'other_daily' };
  return { kind: 'practice', reason: 'unavailable' };
}

export function sweepActivityMessage(mode: SweepActivityMode): string {
  if (mode.kind === 'reward')
    return '本局将验收为今日的清扫山门委托。';
  if (mode.reason === 'completed')
    return '今日委托已经完成，本局为自由练习，不再获得奖励。';
  if (mode.reason === 'not_accepted')
    return '尚未在宗门事务领取清扫委托，本局为自由练习。';
  if (mode.reason === 'other_daily')
    return '今日已经选择其他宗门委托，本局为自由练习。';
  return '当前未发现可结算的清扫委托，本局为自由练习。';
}

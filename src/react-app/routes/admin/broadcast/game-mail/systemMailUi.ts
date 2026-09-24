import type { RewardSelection } from '@shared/contracts/adminRewards';
import type { RewardSelectionDraft } from '../../_components/RewardSelectionEditor.helpers';

export function rewardDrafts(
  rewards: RewardSelection[],
): RewardSelectionDraft[] {
  return rewards.map((r) =>
    r.type === 'inventory_v1'
      ? { ...r, quantity: String(r.inventory.quantity) }
      : { ...r, quantity: String(r.quantity) },
  );
}
export async function systemMailRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/admin/system-mails${path}`, {
    method,
    signal,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '操作失败');
  return data as T;
}
export function beijingInput(time: number | string): string {
  return new Date(new Date(time).getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function beijingInstant(value: string): string {
  if (!value) throw new Error('请填写投递起止时间');
  const date = new Date(`${value}:00+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error('时间格式无效');
  return date.toISOString();
}

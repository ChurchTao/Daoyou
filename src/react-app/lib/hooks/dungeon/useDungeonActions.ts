import { useInkUI } from '@app/components/providers/InkUIProvider';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { DungeonMaterialSelection } from '@shared/contracts/combatV6Dungeon';
import type {
  DungeonOption,
  DungeonRecoverAction,
  DungeonState,
} from '@shared/lib/dungeon/types';
import { useRef, useState } from 'react';

export function useDungeonActions(
  reconcile: () => Promise<void>,
  state: DungeonState | null,
) {
  const { pushToast, openDialog } = useInkUI();
  const [processing, setProcessing] = useState(false);
  const pending = useRef(false);
  const actionRequest = useRef<{ key: string; id: string } | null>(null);
  const expected = state
    ? {
        runId: state.runId,
        round: state.currentRound,
        status: state.status,
        pendingActionId: state.pendingAction?.actionId ?? null,
      }
    : null;

  async function mutate(path: string, body?: unknown) {
    if (pending.current) return null;
    pending.current = true;
    setProcessing(true);
    let message = '尚未确认探索结果，正在重新读取';
    try {
      const response = await fetch(`/api/dungeon/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        message = data.message ?? data.error ?? '操作未完成，正在核对探索结果';
        throw new Error(message);
      }
      if (!data.success || !data.state) throw new Error('探索响应无效');
      return await consumeResourceMutation<{
        state?: DungeonState;
        isFinished?: boolean;
      }>(data);
    } catch {
      pushToast({ message, tone: 'warning' });
      await reconcile();
      return null;
    } finally {
      pending.current = false;
      setProcessing(false);
    }
  }

  return {
    processing,
    startDungeon: async (mapNodeId: string) =>
      (await mutate('start', { mapNodeId }))?.state ?? null,
    performAction: (
      option: DungeonOption,
      runId: string,
      round: number,
      materialSelections: DungeonMaterialSelection[] = [],
    ) => {
      const key = JSON.stringify([runId, round, option.id, materialSelections]);
      if (actionRequest.current?.key !== key)
        actionRequest.current = { key, id: crypto.randomUUID() };
      return mutate('action', {
        choiceId: option.id,
        actionId: actionRequest.current.id,
        runId,
        round,
        materialSelections,
      });
    },
    beginBattle: (encounterId: string) =>
      mutate('battle/begin', { encounterId }),
    continueLooting: () => mutate('looting/continue', { expected }),
    escapeLooting: () => mutate('looting/escape', { expected }),
    recoverDungeon: (action: DungeonRecoverAction) =>
      mutate('recover', { action, expected }),
    quitDungeon: () =>
      new Promise<Awaited<ReturnType<typeof mutate>>>((resolve) => {
        openDialog({
          title: '结束探索',
          content:
            '确定结束本次探索吗？已获得的收益将结算发放，但不会获得通关奖励。',
          confirmLabel: '确认离开',
          cancelLabel: '取消',
          onConfirm: async () => {
            resolve(await mutate('quit', { expected }));
          },
          onCancel: () => resolve(null),
        });
      }),
  };
}

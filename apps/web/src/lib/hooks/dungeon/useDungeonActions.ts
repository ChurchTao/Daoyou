import { useInkUI } from '@app/components/providers/InkUIProvider';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  DungeonMaterialSelection,
  DungeonOption,
  DungeonRecoverAction,
  DungeonState,
} from '@daoyou/game-domain/dungeon';
import type {
  MysteryAction,
  MysteryAnswers,
} from '@daoyou/game-domain/dungeon/mystery';
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

  async function mutate(path: string, body?: unknown, timeoutMs = 90000) {
    if (pending.current) return null;
    pending.current = true;
    setProcessing(true);
    let message = '尚未确认探索结果，正在重新读取';
    try {
      const response = await apiFetch(`/api/dungeon/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
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
      // 解谜秘境开局需要生成案卷，耗时长于普通操作。
      (await mutate('start', { mapNodeId }, 200000))?.state ?? null,
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
    mysteryAct: (runId: string, turn: number, action: MysteryAction) => {
      // 同一回合重试同一动作时沿用 actionId，服务端据此去重。
      const key = JSON.stringify([runId, turn, action]);
      if (actionRequest.current?.key !== key)
        actionRequest.current = { key, id: crypto.randomUUID() };
      return mutate('mystery/act', {
        runId,
        actionId: actionRequest.current.id,
        turn,
        action,
      });
    },
    mysteryTalk: (
      runId: string,
      turn: number,
      npcId: string,
      question: string,
    ) => {
      const key = JSON.stringify([runId, turn, npcId, question]);
      if (actionRequest.current?.key !== key)
        actionRequest.current = { key, id: crypto.randomUUID() };
      // 人物作答需要调用模型，略长于普通调查动作。
      return mutate(
        'mystery/talk',
        { runId, actionId: actionRequest.current.id, turn, npcId, question },
        45000,
      );
    },
    mysteryGuard: (runId: string, turn: number, guardId: string) => {
      const key = JSON.stringify([runId, turn, 'guard', guardId]);
      if (actionRequest.current?.key !== key)
        actionRequest.current = { key, id: crypto.randomUUID() };
      return mutate('mystery/guard', {
        runId,
        actionId: actionRequest.current.id,
        turn,
        guardId,
      });
    },
    mysteryDeduce: (runId: string, answers: MysteryAnswers) =>
      mutate('mystery/deduce', { runId, answers }),
    beginBattle: (encounterId: string) =>
      mutate('battle/begin', { encounterId }),
    continueLooting: () => mutate('looting/continue', { expected }),
    escapeLooting: () => mutate('looting/escape', { expected }),
    recoverDungeon: (action: DungeonRecoverAction) =>
      mutate('recover', { action, expected }),
    quitDungeon: () =>
      new Promise<Awaited<ReturnType<typeof mutate>>>((resolve) => {
        const pending =
          state?.status === 'WAITING_BATTLE'
            ? state.mysteryView?.pendingBattle
            : undefined;
        // 守卫战前退回：不扣行动力，直接回到调查。
        if (pending === 'guard') {
          void mutate('quit', { expected }).then(resolve);
          return;
        }
        // 解谜对决前放走对手：仍按结案结算，只是没有对决分。
        const confrontation = pending === 'finale';
        openDialog({
          title: confrontation ? '任其遁走' : '结束探索',
          content: confrontation
            ? '放走对手后此案即告了结，推理所得照常结算，只是拿不到对决分。确定不追了吗？'
            : '确定结束本次探索吗？已获得的收益将结算发放，但不会获得通关奖励。',
          confirmLabel: confrontation ? '放其离去' : '确认离开',
          cancelLabel: '取消',
          onConfirm: async () => {
            resolve(await mutate('quit', { expected }));
          },
          onCancel: () => resolve(null),
        });
      }),
  };
}

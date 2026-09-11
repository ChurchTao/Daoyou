import { useInkUI } from '@app/components/providers/InkUIProvider';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  DungeonOption,
  DungeonRecoverAction,
  DungeonState,
} from '@shared/lib/dungeon/types';
import { useRef, useState } from 'react';

function createActionId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function readDungeonMutation<T>(
  response: Response,
): Promise<T | { conflict: true; message?: string }> {
  const data = await response.json();
  if (!response.ok || data.error) {
    if (response.status === 409) {
      return { conflict: true, message: data.message || data.error };
    }
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }

  if (!data.success || !data.state) {
    throw new Error('副本状态响应协议无效');
  }
  return consumeResourceMutation<T>(data);
}

/**
 * 副本操作Hook
 * 负责处理副本相关的操作（启动、选择选项、退出）
 */
export function useDungeonActions() {
  const { pushToast, openDialog } = useInkUI();
  const [processing, setProcessing] = useState(false);
  const actionRequest = useRef<{ key: string; id: string } | null>(null);

  /**
   * 启动副本
   */
  const startDungeon = async (nodeId: string) => {
    try {
      setProcessing(true);
      const res = await fetch('/api/dungeon/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapNodeId: nodeId,
        }),
      });

      const data = await readDungeonMutation<{ state?: DungeonState }>(res);
      if ('conflict' in data) {
        throw new Error(data.message ?? '启动秘境失败');
      }

      pushToast({ message: '秘境已开启', tone: 'success' });
      return data.state;
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '启动秘境失败',
        tone: 'danger',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 执行选项
   */
  const performAction = async (
    option: DungeonOption,
    runId: string,
    round: number,
  ) => {
    const key = `${runId}:${round}:${option.id}`;
    if (actionRequest.current?.key !== key)
      actionRequest.current = { key, id: createActionId() };
    try {
      setProcessing(true);
      const res = await fetch('/api/dungeon/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choiceId: option.id,
          actionId: actionRequest.current.id,
          runId,
          round,
        }),
      });

      const data = await readDungeonMutation<{ state?: DungeonState }>(res);
      if (data && typeof data === 'object' && 'conflict' in data)
        pushToast({
          message: data.message ?? '探索状态已变化，请重新选择',
          tone: 'warning',
        });
      return data;
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '操作失败',
        tone: 'danger',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  const beginBattle = async (encounterId: string) => {
    try {
      setProcessing(true);
      return await readDungeonMutation(
        await fetch('/api/dungeon/battle/begin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounterId }),
        }),
      );
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '迎战失败，请重试',
        tone: 'danger',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 退出副本
   */
  const quitDungeon = () => {
    return new Promise<unknown>((resolve) => {
      openDialog({
        title: '结束探索',
        content:
          '确定结束本次探索吗？已获得的收益将结算发放，但不会获得通关奖励。',
        confirmLabel: '确认离开',
        cancelLabel: '取消',
        onConfirm: async () => {
          try {
            setProcessing(true);
            const res = await fetch('/api/dungeon/quit', { method: 'POST' });
            const data = await readDungeonMutation<{ state?: DungeonState }>(
              res,
            );
            if ('conflict' in data) {
              throw new Error(data.message ?? '放弃失败');
            }

            resolve(data);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            pushToast({ message: '操作失败', tone: 'danger' });
            resolve(null);
          } finally {
            setProcessing(false);
          }
        },
        onCancel: () => {
          resolve(null);
        },
      });
    });
  };

  /**
   * 战后休整：继续探索
   */
  const continueLooting = async () => {
    try {
      setProcessing(true);
      const res = await fetch('/api/dungeon/looting/continue', {
        method: 'POST',
      });
      return await readDungeonMutation(res);
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '操作失败',
        tone: 'danger',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 战后休整：离开秘境
   */
  const escapeLooting = async () => {
    try {
      setProcessing(true);
      const res = await fetch('/api/dungeon/looting/escape', {
        method: 'POST',
      });
      return await readDungeonMutation(res);
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '操作失败',
        tone: 'danger',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  const recoverDungeon = async (action: DungeonRecoverAction) => {
    try {
      setProcessing(true);
      const res = await fetch('/api/dungeon/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      return await readDungeonMutation(res);
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '副本恢复失败',
        tone: 'danger',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  return {
    beginBattle,
    startDungeon,
    performAction,
    continueLooting,
    escapeLooting,
    recoverDungeon,
    quitDungeon,
    processing,
  };
}

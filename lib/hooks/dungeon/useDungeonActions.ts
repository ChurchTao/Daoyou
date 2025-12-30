import { useInkUI } from '@/components/providers/InkUIProvider';
import { DungeonOption } from '@/lib/dungeon/types';
import { useState } from 'react';

/**
 * 副本操作Hook
 * 负责处理副本相关的操作（启动、选择选项、退出）
 */
export function useDungeonActions() {
  const { pushToast, openDialog } = useInkUI();
  const [processing, setProcessing] = useState(false);

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

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
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
  const performAction = async (option: DungeonOption) => {
    try {
      setProcessing(true);
      const res = await fetch('/api/dungeon/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choiceId: option.id,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

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

  /**
   * 退出副本
   */
  const quitDungeon = () => {
    return new Promise<boolean>((resolve) => {
      openDialog({
        title: '放弃探索',
        content:
          '确定要放弃当前探索吗？放弃后无法获得任何奖励，且本轮进度将丢失。',
        confirmLabel: '确认放弃',
        cancelLabel: '取消',
        onConfirm: async () => {
          try {
            setProcessing(true);
            const res = await fetch('/api/dungeon/quit', { method: 'POST' });

            if (!res.ok) {
              throw new Error('放弃失败');
            }

            pushToast({ message: '已放弃探索', tone: 'success' });
            resolve(true);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            pushToast({ message: '操作失败', tone: 'danger' });
            resolve(false);
          } finally {
            setProcessing(false);
          }
        },
        onCancel: () => {
          resolve(false);
        },
      });
    });
  };

  return {
    startDungeon,
    performAction,
    quitDungeon,
    processing,
  };
}

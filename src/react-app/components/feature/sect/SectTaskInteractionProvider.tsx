/* eslint-disable react-refresh/only-export-components -- provider and hook form one feature boundary */
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type {
  SectTaskActionData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import { useSectCurrentQuery } from './SectQueryProvider';

export type SectTaskViewAction = SectTaskViewData['actions'][number];

interface CurrentOutcome {
  task: SectTaskViewData;
  outcome: SectTaskActionData['outcome'];
}

interface SectTaskInteractionContextValue {
  busy: boolean;
  outcome?: CurrentOutcome;
  execute(
    task: SectTaskViewData,
    action: SectTaskViewAction,
    input: Record<string, unknown>,
    successMessage: string,
  ): Promise<SectTaskActionData | undefined>;
  runRaw<T>(url: string, init: RequestInit, successMessage: string): Promise<T | undefined>;
  navigate(path: string, options?: { replace?: boolean }): void;
  clearOutcome(): void;
  refreshTasks(): Promise<unknown> | unknown;
}

const SectTaskInteractionContext =
  createContext<SectTaskInteractionContextValue | null>(null);

export function SectTaskInteractionProvider({
  refreshTasks,
  children,
}: {
  refreshTasks(): Promise<unknown> | unknown;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CurrentOutcome>();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const current = useSectCurrentQuery();
  const invalidateCurrent = current.invalidate;
  const routerNavigate = useNavigate();

  const runRaw = useCallback(
    async <T,>(url: string, init: RequestInit, successMessage: string) => {
      setBusy(true);
      try {
        const result = await mutate<T>(fetch(url, init));
        await refreshTasks();
        await invalidateCurrent();
        pushToast({ message: successMessage, tone: 'success' });
        return result;
      } catch (reason) {
        pushToast({
          message: reason instanceof Error ? reason.message : '宗门事务失败',
          tone: 'danger',
        });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [invalidateCurrent, mutate, pushToast, refreshTasks],
  );

  const execute = useCallback(
    async (
      task: SectTaskViewData,
      action: SectTaskViewAction,
      input: Record<string, unknown>,
      successMessage: string,
    ) => {
      const result = await runRaw<SectTaskActionData>(
        `/api/sects/current/tasks/${encodeURIComponent(task.definitionId)}/actions/${encodeURIComponent(action.key)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({ input }),
        },
        successMessage,
      );
      if (result) setOutcome({ task: result.task, outcome: result.outcome });
      return result;
    },
    [runRaw],
  );

  const value = useMemo<SectTaskInteractionContextValue>(
    () => ({
      busy,
      outcome,
      execute,
      runRaw,
      navigate: routerNavigate,
      clearOutcome: () => setOutcome(undefined),
      refreshTasks,
    }),
    [busy, execute, outcome, refreshTasks, routerNavigate, runRaw],
  );
  return (
    <SectTaskInteractionContext.Provider value={value}>
      {children}
    </SectTaskInteractionContext.Provider>
  );
}

export function useSectTaskInteraction(): SectTaskInteractionContextValue {
  const value = useContext(SectTaskInteractionContext);
  if (!value)
    throw new Error('宗门任务交互必须位于 SectTaskInteractionProvider 内');
  return value;
}

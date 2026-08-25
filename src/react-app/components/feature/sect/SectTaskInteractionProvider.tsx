/* eslint-disable react-refresh/only-export-components -- provider and hook form one feature boundary */
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { requestActivityStoryRefresh } from '@app/lib/story/activityStoryEvents';
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

export type SectTaskViewAction = SectTaskViewData['actions'][number];

interface CurrentOutcome {
  task: SectTaskViewData;
  outcome: SectTaskActionData['outcome'];
}

interface SectTaskInteractionContextValue {
  busy: boolean;
  error?: string;
  outcome?: CurrentOutcome;
  execute(
    task: SectTaskViewData,
    action: SectTaskViewAction,
    input: Record<string, unknown>,
    successMessage?: string,
  ): Promise<SectTaskActionData | undefined>;
  runRaw<T>(
    url: string,
    init: RequestInit,
    successMessage?: string,
  ): Promise<T | undefined>;
  navigate(path: string, options?: { replace?: boolean }): void;
  clearOutcome(): void;
}

const SectTaskInteractionContext =
  createContext<SectTaskInteractionContextValue | null>(null);

export function SectTaskInteractionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [outcome, setOutcome] = useState<CurrentOutcome>();
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const routerNavigate = useNavigate();

  const runRaw = useCallback(
    async <T,>(url: string, init: RequestInit, successMessage?: string) => {
      setBusy(true);
      setError(undefined);
      try {
        const result = await mutate<T>(fetch(url, init));
        if (successMessage)
          pushToast({ message: successMessage, tone: 'success' });
        return result;
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : '宗门事务失败';
        setError(message);
        pushToast({ message, tone: 'danger' });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [mutate, pushToast],
  );

  const execute = useCallback(
    async (
      task: SectTaskViewData,
      action: SectTaskViewAction,
      input: Record<string, unknown>,
      successMessage?: string,
    ) => {
      setOutcome(undefined);
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
      if (result)
        setOutcome({
          task: result.primaryTask,
          outcome: result.outcome,
        });
      if (result?.primaryTask.state === 'claimed') {
        requestActivityStoryRefresh();
      }
      return result;
    },
    [runRaw],
  );
  const clearOutcome = useCallback(() => {
    setOutcome(undefined);
    setError(undefined);
  }, []);

  const value = useMemo<SectTaskInteractionContextValue>(
    () => ({
      busy,
      error,
      outcome,
      execute,
      runRaw,
      navigate: routerNavigate,
      clearOutcome,
    }),
    [busy, clearOutcome, error, execute, outcome, routerNavigate, runRaw],
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

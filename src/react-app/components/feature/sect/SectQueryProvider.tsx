/* eslint-disable react-refresh/only-export-components -- provider and resource hooks share its private cache context */
import { fetchSectCurrent } from '@app/lib/sect/sectClient';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SectQueryCoordinator } from './sectQueryCoordinator';

interface SectResourceSnapshot<T = unknown> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface SectQueryContextValue {
  resources: Record<string, SectResourceSnapshot>;
  load<T>(
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    force?: boolean,
  ): Promise<T | undefined>;
  set<T>(key: string, data: T): void;
}

export interface SectResourceQueryState<T> extends SectResourceSnapshot<T> {
  retry(): Promise<T | undefined>;
  reload(): Promise<T | undefined>;
  invalidate(): Promise<T | undefined>;
  setData(data: T): void;
}

export type SectCurrentQueryState = SectResourceQueryState<SectCurrentData>;

const SectQueryContext = createContext<SectQueryContextValue | null>(null);

export function SectQueryProvider({ children }: { children: ReactNode }) {
  const [resources, setResources] = useState<Record<string, SectResourceSnapshot>>({});
  const coordinatorRef = useRef(new SectQueryCoordinator());

  const load = useCallback(async <T,>(
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    force = false,
  ): Promise<T | undefined> => {
    return coordinatorRef.current.execute({
      key,
      loader,
      force,
      onStart: () =>
        setResources((current) => ({
          ...current,
          [key]: { ...current[key], loading: true, error: undefined },
        })),
      onSuccess: (data) =>
        setResources((current) => ({
          ...current,
          [key]: { data, loading: false },
        })),
      onError: (error) =>
        setResources((current) => ({
          ...current,
          [key]: { ...current[key], loading: false, error },
        })),
    });
  }, []);

  const set = useCallback(<T,>(key: string, data: T) => {
    setResources((current) => ({
      ...current,
      [key]: { data, loading: false },
    }));
  }, []);

  useEffect(
    () => () => {
      coordinatorRef.current.dispose();
    },
    [],
  );

  const value = useMemo(() => ({ resources, load, set }), [load, resources, set]);
  return <SectQueryContext.Provider value={value}>{children}</SectQueryContext.Provider>;
}

export function useSectResourceQuery<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
): SectResourceQueryState<T> {
  const context = useContext(SectQueryContext);
  if (!context) throw new Error('useSectResourceQuery 必须在 SectQueryProvider 中使用');
  const snapshot = context.resources[key] as SectResourceSnapshot<T> | undefined;
  const data = snapshot?.data;
  const error = snapshot?.error;
  const loading = snapshot?.loading ?? false;
  const load = context.load;
  const retry = useCallback(() => load(key, loader, true), [key, load, loader]);
  const setData = useCallback((next: T) => context.set(key, next), [context, key]);

  useEffect(() => {
    if (!data && !loading && !error) void load(key, loader);
  }, [data, error, key, load, loader, loading]);

  return {
    data,
    loading,
    error,
    retry,
    reload: retry,
    invalidate: retry,
    setData,
  };
}

const loadCurrentSect = (signal: AbortSignal) => fetchSectCurrent(signal);

export function useSectCurrentQuery(): SectCurrentQueryState {
  return useSectResourceQuery('current', loadCurrentSect);
}

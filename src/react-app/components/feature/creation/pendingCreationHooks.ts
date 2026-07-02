import { useInkUI } from '@app/components/providers/InkUIProvider';
import type { DialogInput } from '@app/components/providers/inkUIContext';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CreationProductResultRecord } from './CreationProductResultModal';
import {
  PENDING_CREATION_CRAFT_TYPES,
  getPendingCreationConfig,
  getPendingCreationReplaceHref,
  isPendingCreationCraftType,
  type PendingCreationCraftType,
} from './pendingCreationHelpers';

type PendingApiResponse = {
  success?: boolean;
  hasPending?: boolean;
  item?: CreationProductResultRecord | null;
};

export function usePendingCreations({
  craftTypes = PENDING_CREATION_CRAFT_TYPES,
  enabled = true,
}: {
  craftTypes?: readonly PendingCreationCraftType[];
  enabled?: boolean;
} = {}) {
  const [items, setItems] = useState<
    Partial<Record<PendingCreationCraftType, CreationProductResultRecord | null>>
  >({});
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const craftTypeKey = craftTypes.join('|');

  const refresh = useCallback(async () => {
    const activeCraftTypes = craftTypeKey
      .split('|')
      .filter(isPendingCreationCraftType);

    if (!enabled) {
      setItems({});
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const entries = await Promise.all(
        activeCraftTypes.map(async (craftType) => {
          const response = await fetch(`/api/craft/pending?type=${craftType}`);
          const payload = (await response.json()) as PendingApiResponse;
          return [
            craftType,
            response.ok && payload.success && payload.hasPending
              ? (payload.item ?? null)
              : null,
          ] as const;
        }),
      );

      setItems(Object.fromEntries(entries));
    } catch (cause) {
      const nextError =
        cause instanceof Error ? cause : new Error('待处理法门状态读取失败');
      console.error('检查待处理法门失败:', nextError);
      setError(nextError);
      setItems({});
    } finally {
      setIsLoading(false);
    }
  }, [craftTypeKey, enabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const pendingTypes = useMemo(() => {
    const activeCraftTypes = craftTypeKey
      .split('|')
      .filter(isPendingCreationCraftType);
    return activeCraftTypes.filter((craftType) => Boolean(items[craftType]));
  }, [craftTypeKey, items]);

  return {
    items,
    pendingTypes,
    hasPending: pendingTypes.length > 0,
    isLoading,
    error,
    refresh,
  };
}

export function createPendingCreationDialog(args: {
  craftType: PendingCreationCraftType;
  onNavigate: () => void;
}): DialogInput {
  const config = getPendingCreationConfig(args.craftType);
  return {
    title: '待处理新法门',
    content: createElement(
      'p',
      { className: 'py-2' },
      `系统感应到道友先前${config.creationVerb}了一门${config.label}，但尚未将其纳入道基。`,
    ),
    confirmLabel: '现在处理',
    cancelLabel: '稍后处理',
    onConfirm: args.onNavigate,
  };
}

export function usePendingCreationDialog() {
  const navigate = useNavigate();
  const { openDialog } = useInkUI();

  return useCallback(
    (craftType: PendingCreationCraftType) => {
      openDialog(
        createPendingCreationDialog({
          craftType,
          onNavigate: () => navigate(getPendingCreationReplaceHref(craftType)),
        }),
      );
    },
    [navigate, openDialog],
  );
}

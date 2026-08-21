import {
  fetchStorySurface,
  interactStorySurface,
  STORY_UPDATED_EVENT,
} from '@app/lib/story/storyClient';
import type {
  StorySurfaceContext,
  StorySurfaceInteractionResult,
  StorySurfaceKey,
  StorySurfaceResult,
} from '@shared/types/story';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useStorySurface(
  surface: StorySurfaceKey,
  context: StorySurfaceContext = {},
  options: { waitForExternalEvent?: boolean } = {},
) {
  const contextKey = JSON.stringify(context);
  const requestKey = `${surface}:${contextKey}`;
  const [activeKey, setActiveKey] = useState(requestKey);
  const [data, setData] = useState<StorySurfaceResult>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const parsedContext = useMemo<StorySurfaceContext>(
    () => JSON.parse(contextKey) as StorySurfaceContext,
    [contextKey],
  );
  const mounted = useRef(true);

  if (activeKey !== requestKey) {
    setActiveKey(requestKey);
    setData(undefined);
    setLoading(true);
    setError(undefined);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(undefined);
      const next = await fetchStorySurface(surface, parsedContext, signal);
      if (mounted.current && !signal?.aborted) setData(next);
      return next;
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : '剧情插槽读取失败');
      }
    } finally {
      if (mounted.current && !signal?.aborted) setLoading(false);
    }
  }, [parsedContext, surface]);

  useEffect(() => {
    const controller = new AbortController();
    // 合法的 surface 拉取：依赖变化时向外部剧情 API 同步，不是派生本地 state。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch Story Surface
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const onStoryUpdated = () => {
      void reload();
    };
    window.addEventListener(STORY_UPDATED_EVENT, onStoryUpdated);
    return () => window.removeEventListener(STORY_UPDATED_EVENT, onStoryUpdated);
  }, [reload]);

  useEffect(() => {
    if (!options.waitForExternalEvent || (data?.entries.length ?? 0) > 0) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void reload();
      if (attempts >= 12) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [data?.entries.length, options.waitForExternalEvent, reload]);

  const interact = useCallback(
    async (
      interactionId: string,
      payload: Record<string, unknown> = {},
    ): Promise<StorySurfaceInteractionResult> => {
      const result = await interactStorySurface({ interactionId, payload });
      await reload();
      return result;
    },
    [reload],
  );

  return {
    surface: data,
    entries: data?.entries ?? [],
    loading,
    error,
    reload: () => reload(),
    interact,
  };
}

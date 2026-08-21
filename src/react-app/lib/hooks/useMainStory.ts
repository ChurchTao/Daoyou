import {
  fetchMainStorySnapshot,
  STORY_UPDATED_EVENT,
} from '@app/lib/story/storyClient';
import type { MainStorySnapshot } from '@shared/types/story';
import { useCallback, useEffect, useState } from 'react';

const EXTERNAL_WAIT_STEPS = new Set(['await-breakthrough']);

export function useMainStory() {
  const [story, setStory] = useState<MainStorySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(undefined);
      const next = await fetchMainStorySnapshot(signal);
      setStory(next);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : '主线卷宗读取失败');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load main story snapshot on mount
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const custom = event as CustomEvent<MainStorySnapshot>;
      if (custom.detail) {
        setStory(custom.detail);
        setLoading(false);
        setError(undefined);
      }
    };
    window.addEventListener(STORY_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(STORY_UPDATED_EVENT, onUpdated);
  }, []);

  // MQ 投影是最终一致的：当剧情明确等待跨域事实（例如真实突破）时，
  // 轻量轮询卷宗以接住 NATS projector 写回；业务页面无需再同步调用 StoryService。
  useEffect(() => {
    if (!story?.currentStep || !EXTERNAL_WAIT_STEPS.has(story.currentStep)) return;
    const timer = window.setInterval(() => {
      void reload();
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [reload, story?.currentStep]);

  return { story, loading, error, reload: () => reload() };
}

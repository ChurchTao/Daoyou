import { notifyStoryRuntimeEvent } from '@app/lib/story/storyClient';
import type {
  MainStoryRuntimeEventType,
  MainStorySnapshot,
} from '@shared/types/story';
import { useEffect, useRef } from 'react';

export function isStoryStep(
  story: MainStorySnapshot | null | undefined,
  nodeId: string,
  step: string,
) {
  return (
    story?.status === 'active' &&
    story.currentNodeId === nodeId &&
    story.currentStep === step
  );
}

export function useStoryAutoRuntimeEvent(
  active: boolean,
  eventType: MainStoryRuntimeEventType,
  payload: Record<string, unknown> = {},
) {
  const sentKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active) {
      sentKeyRef.current = undefined;
      return;
    }
    const key = `${eventType}:${JSON.stringify(payload)}`;
    if (sentKeyRef.current === key) return;
    sentKeyRef.current = key;
    void notifyStoryRuntimeEvent({ eventType, payload }).catch((error) => {
      sentKeyRef.current = undefined;
      console.warn(`[main-story] auto event ${eventType} failed`, error);
    });
  }, [active, eventType, payload]);
}

import {
  ACTIVITY_STORY_REFRESH_EVENT,
  requestActivityStoryRefresh,
} from '@app/lib/story/activityStoryEvents';
import type { TravelStoryEvent } from '@shared/lib/story/travelStory';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { ActivityStoryModal } from './TravelStoryModal';

const RETRY_DELAYS = [0, 2_000, 5_000, 10_000, 20_000, 40_000, 60_000] as const;

export function ActivityStoryLauncher() {
  const location = useLocation();
  const [event, setEvent] = useState<TravelStoryEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dismissedIntentId = useRef<string | null>(null);
  const retryTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const refresh = useCallback(
    async (allowDungeon = false) => {
      try {
        const response = await fetch('/api/story/activity-stories/pending', {
          cache: 'no-store',
        });
        if (!response.ok) return false;
        const data = (await response.json()) as {
          event?: TravelStoryEvent | null;
        };
        const pending = data.event ?? null;
        setEvent(pending);
        const avoidsInterruptingDungeon =
          location.pathname.startsWith('/game/dungeon');
        if (
          pending &&
          pending.activityType !== 'travel' &&
          pending.id !== dismissedIntentId.current &&
          (!avoidsInterruptingDungeon || allowDungeon)
        ) {
          setIsOpen(true);
        }
        return Boolean(pending);
      } catch {
        return false;
      }
    },
    [location.pathname],
  );

  const startPolling = useCallback(
    (allowDungeon = false) => {
      for (const timer of retryTimers.current) clearTimeout(timer);
      retryTimers.current = RETRY_DELAYS.map((delay) =>
        setTimeout(() => void refresh(allowDungeon), delay),
      );
    },
    [refresh],
  );

  useEffect(() => {
    const initialTimer = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 60_000);
    const handleRefresh = () => startPolling(true);
    window.addEventListener(ACTIVITY_STORY_REFRESH_EVENT, handleRefresh);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener(ACTIVITY_STORY_REFRESH_EVENT, handleRefresh);
      for (const timer of retryTimers.current) clearTimeout(timer);
    };
  }, [refresh, startPolling]);

  return (
    <ActivityStoryModal
      event={event}
      isOpen={isOpen}
      onClose={() => {
        if (event?.status === 'awaiting_choice') {
          dismissedIntentId.current = event.id;
        }
        setIsOpen(false);
      }}
      onResolved={() => {
        dismissedIntentId.current = null;
        setEvent(null);
        setIsOpen(false);
        requestActivityStoryRefresh();
      }}
    />
  );
}

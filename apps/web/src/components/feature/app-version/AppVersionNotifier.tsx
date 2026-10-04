import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  CURRENT_BUILD_ID,
  fetchLatestBuildId,
  isNewBuildAvailable,
  reloadIntoLatestVersion,
} from '@app/lib/appVersion';
import { useEffect, useRef } from 'react';

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function AppVersionNotifier() {
  const { dismissToast, pushToast } = useInkUI();
  const checkInFlightRef = useRef(false);
  const promptedBuildIdRef = useRef<string | null>(null);
  const promptToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return;
    }

    let active = true;

    const checkForUpdate = async () => {
      if (document.visibilityState === 'hidden' || checkInFlightRef.current) {
        return;
      }

      checkInFlightRef.current = true;
      try {
        const latestBuildId = await fetchLatestBuildId();
        if (
          !active ||
          !isNewBuildAvailable(latestBuildId, CURRENT_BUILD_ID) ||
          promptedBuildIdRef.current === latestBuildId
        ) {
          return;
        }

        if (promptToastIdRef.current) {
          dismissToast(promptToastIdRef.current);
        }

        promptedBuildIdRef.current = latestBuildId;
        promptToastIdRef.current = pushToast({
          message: '天地法则已有更新，刷新后即可继续当前旅程。',
          tone: 'warning',
          duration: 0,
          actionLabel: '刷新进入新版本',
          onAction: reloadIntoLatestVersion,
        });
      } finally {
        checkInFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };

    void checkForUpdate();
    const intervalId = window.setInterval(
      () => void checkForUpdate(),
      VERSION_CHECK_INTERVAL_MS,
    );
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dismissToast, pushToast]);

  return null;
}

import { baixiaoPost, requestBaixiao } from '@app/lib/api/baixiao';
import type {
  BaixiaoResolveCommand,
  BaixiaoStatus,
} from '@daoyou/contracts/baixiao/meet';
import type { BaixiaoCard } from '@daoyou/game-domain/baixiao/meet';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

const endpoint = '/api/baixiao-meet';
const focusKey = 'daoyou-baixiao-focus-v1';

function isForeground() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

function pendingKey(status: BaixiaoStatus) {
  return `${status.week}:${status.session?.endsAt}:${status.session?.question?.position}`;
}

function saveFocus(value: string | null) {
  try {
    if (value) sessionStorage.setItem(focusKey, value);
    else sessionStorage.removeItem(focusKey);
  } catch {
    // The in-memory marker still protects the current tab.
  }
}

function hasSavedFocus(status: BaixiaoStatus) {
  try {
    return sessionStorage.getItem(focusKey) === pendingKey(status);
  } catch {
    return false;
  }
}

export function useBaixiao() {
  const [status, setStatus] = useState<BaixiaoStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const [foreground, setForeground] = useState(isForeground);
  const [focusBlocked, setFocusBlocked] = useState(false);

  const fresh = useRef<BaixiaoStatus | null>(null);
  const working = useRef(false);
  const offset = useRef(0);
  const focus = useRef<string | null>(null);
  const retry = useRef<{
    action: 'start' | 'next' | 'resolve';
    body: object;
  } | null>(null);

  const send = useCallback(
    async (
      action?: 'start' | 'next' | 'resolve',
      body?: object,
      keepalive = false,
    ) => {
      if (working.current) return;
      working.current = true;
      retry.current = action && body ? { action, body } : null;
      setBusy(true);
      setError('');
      try {
        const result = await requestBaixiao<BaixiaoStatus>(
          action ? `${endpoint}/${action}` : endpoint,
          body ? baixiaoPost(body, keepalive) : undefined,
        );
        const arrived = Date.now();
        offset.current = result.serverTime - arrived;
        fresh.current = result;
        setStatus(result);
        setNow(result.serverTime);
        retry.current = null;
        if (
          result.session?.question &&
          (!isForeground() || hasSavedFocus(result))
        ) {
          focus.current = pendingKey(result);
          saveFocus(focus.current);
          setFocusBlocked(true);
        } else {
          focus.current = null;
          saveFocus(null);
          setFocusBlocked(false);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '连接中断，请重连。');
      } finally {
        working.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const forfeit = useEffectEvent(() => {
    const current = fresh.current;
    const question = current?.session?.question;
    if (!current || !question) return;
    focus.current = pendingKey(current);
    saveFocus(focus.current);
    setFocusBlocked(true);
    if (!working.current) {
      void send(
        'resolve',
        { week: current.week, position: question.position, action: 'focus' },
        true,
      );
    }
  });

  useEffect(() => {
    const initial = window.setTimeout(() => void send(), 0);
    const tick = window.setInterval(
      () => setNow(Date.now() + offset.current),
      200,
    );
    const lobbyPoll = window.setInterval(() => {
      if (!fresh.current?.session && isForeground()) void send();
    }, 15_000);
    const onBlur = () => {
      setForeground(false);
      forfeit();
    };
    const onFocus = () => setForeground(isForeground());
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onBlur();
      else onFocus();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onBlur);
    const onPopState = () => forfeit();
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(tick);
      window.clearInterval(lobbyPoll);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onBlur);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [send]);

  const session = status?.session;
  const question = session?.question;
  const due = Boolean(question && now >= question.deadline);
  const expired = Boolean(session && now >= session.endsAt);

  const advance = useEffectEvent(() => {
    if (!status || !session || session.finished || working.current || error)
      return;
    if (question && (focus.current === pendingKey(status) || focusBlocked)) {
      void send(
        'resolve',
        { week: status.week, position: question.position, action: 'focus' },
        true,
      );
    } else if (foreground && expired) {
      void send();
    } else if (question && due && foreground) {
      void send('resolve', {
        week: status.week,
        position: question.position,
        action: 'timeout',
      });
    } else if (
      !question &&
      !session.challengeId &&
      foreground &&
      isForeground()
    ) {
      void send('next', { week: status.week, position: session.position });
    }
  });

  useEffect(() => {
    const delay =
      question || expired ? 0 : session?.latest?.bonusCard ? 1200 : 560;
    const timer = window.setTimeout(() => advance(), delay);
    return () => window.clearTimeout(timer);
  }, [
    busy,
    due,
    error,
    expired,
    focusBlocked,
    foreground,
    question,
    session,
    status,
  ]);

  function play(
    action:
      | { action: 'answer'; option: number }
      | { action: 'card'; card: BaixiaoCard },
  ) {
    if (
      !status ||
      !question ||
      due ||
      working.current ||
      focus.current ||
      !isForeground()
    )
      return;
    const command: BaixiaoResolveCommand = {
      ...action,
      week: status.week,
      position: question.position,
    };
    void send('resolve', command);
  }

  function recover() {
    const task = retry.current;
    if (focusBlocked && status && question) {
      void send(
        'resolve',
        { week: status.week, position: question.position, action: 'focus' },
        true,
      );
    } else if (task) {
      void send(task.action, task.body);
    } else {
      void send();
    }
  }

  return {
    status,
    now,
    busy,
    error,
    foreground,
    locked: focusBlocked || due,
    answer: (option: number) => play({ action: 'answer', option }),
    useCard: (card: BaixiaoCard) => play({ action: 'card', card }),
    recover,
    start: () => status && void send('start', { week: status.week }),
  };
}

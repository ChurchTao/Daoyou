import { baixiaoPost, requestBaixiao } from '@app/lib/api/baixiao';
import {
  BaixiaoFocusCommandSchema,
  type BaixiaoResolveCommand,
  type BaixiaoStatus,
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
const focusKey = 'daoyou-baixiao-focus-v2';
type Attempt = Extract<BaixiaoResolveCommand, { action: 'answer' | 'card' }>;
type FocusCommand = Extract<BaixiaoResolveCommand, { action: 'focus' }>;
const focusQueueSchema = BaixiaoFocusCommandSchema.array();

function isForeground() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

function restoreFocusQueue(): FocusCommand[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(focusKey) ?? '[]');
    return focusQueueSchema.safeParse(stored).data ?? [];
  } catch {
    return [];
  }
}

function saveFocusQueue(queue: FocusCommand[]) {
  try {
    if (queue.length) sessionStorage.setItem(focusKey, JSON.stringify(queue));
    else sessionStorage.removeItem(focusKey);
  } catch {
    // The current tab can still deliver its in-memory queue.
  }
}

export function useBaixiao() {
  const [status, setStatus] = useState<BaixiaoStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<Attempt | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const [foreground, setForeground] = useState(isForeground);
  const [storedFocus] = useState(restoreFocusQueue);

  const fresh = useRef<BaixiaoStatus | null>(null);
  const working = useRef(false);
  const offset = useRef(0);
  const wasForeground = useRef(foreground);
  const focusQueue = useRef(storedFocus);
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
        setIntent(null);
        retry.current = null;
        if (focusQueue.current.length) {
          const { session } = result;
          focusQueue.current = focusQueue.current.filter(
            (command) =>
              command !== body &&
              command.week === result.week &&
              command.endsAt === session?.endsAt &&
              command.position === session.question?.position &&
              command.expectedFocusPenalties >=
                (session.score.focusPenalties ?? 0),
          );
          saveFocusQueue(focusQueue.current);
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

  const recordFocusLoss = useEffectEvent(() => {
    const current = fresh.current;
    const session = current?.session;
    const question = session?.question;
    if (
      !current ||
      !session ||
      !question ||
      Date.now() + offset.current >= question.deadline
    )
      return;
    const previous = focusQueue.current.at(-1);
    const count = session.score.focusPenalties ?? 0;
    const expectedFocusPenalties =
      previous?.endsAt === session.endsAt
        ? Math.max(count, previous.expectedFocusPenalties + 1)
        : count;
    const command: FocusCommand = {
      action: 'focus',
      week: current.week,
      position: question.position,
      endsAt: session.endsAt,
      expectedFocusPenalties,
    };
    focusQueue.current = [...focusQueue.current, command];
    saveFocusQueue(focusQueue.current);
    if (!working.current && !error)
      void send('resolve', focusQueue.current[0], true);
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
      if (!wasForeground.current) return;
      wasForeground.current = false;
      setForeground(false);
      recordFocusLoss();
    };
    const onFocus = () => {
      const active = isForeground();
      wasForeground.current = active;
      setForeground(active);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onBlur();
      else onFocus();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onBlur);
    const onPopState = () => {
      if (location.pathname !== '/game/baixiao-meet') onBlur();
    };
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
    const pendingFocus = focusQueue.current[0];
    if (pendingFocus) {
      void send('resolve', pendingFocus, true);
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
  }, [busy, due, error, expired, foreground, question, session, status]);

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
      focusQueue.current.length > 0 ||
      !isForeground()
    )
      return;
    const command: Attempt = {
      ...action,
      week: status.week,
      position: question.position,
    };
    setIntent(command);
    void send('resolve', command);
  }

  const recover = useCallback(() => {
    const task = retry.current;
    if (task) {
      void send(task.action, task.body, task.body === focusQueue.current[0]);
    } else {
      void send();
    }
  }, [send]);

  return {
    status,
    now,
    busy,
    intent,
    error,
    foreground,
    locked: due,
    answer: (option: number) => play({ action: 'answer', option }),
    useCard: (card: BaixiaoCard) => play({ action: 'card', card }),
    recover,
    start: () => status && void send('start', { week: status.week }),
  };
}

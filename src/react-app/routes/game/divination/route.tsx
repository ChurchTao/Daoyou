import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui/InkButton';
import {
  drawDivination,
  getDivination,
  interpretDivination,
} from '@app/lib/divinationApi';
import { consumeResourceChanges } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  DivinationRecord,
  DivinationView,
} from '@shared/contracts/divination';
import {
  DIVINATION_DIRECTIONS,
  type DivinationDirection,
} from '@shared/lib/divination';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import type { DivinationController } from './DivinationPhaserRuntime';

export default function DivinationPage() {
  const session = usePlayerSession();
  const owner = session.data?.activeCultivator?.id;
  if (session.loading) return <GameSceneLoading message="正在加载每日占卜……" />;
  if (!owner) return <p>请先选择一位活跃角色。</p>;
  return <DivinationTable key={owner} />;
}

function DivinationTable() {
  const root = useRef<HTMLDivElement>(null);
  const game = useRef<DivinationController | null>(null);
  const request = useRef<AbortController | null>(null);
  const running = useRef(false);
  const [view, setView] = useState<DivinationView | null>(null);
  const [direction, setDirection] = useState<DivinationDirection>('forging');
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'reading'>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [artError, setArtError] = useState(false);
  const record = view?.record;
  const busy = phase !== 'idle';
  const canDraw = !!view?.canDraw;
  const pending = record && !record.rewardGranted;
  const shown = canDraw ? null : record;

  const refresh = useCallback(async () => {
    if (running.current) return;
    const signal = request.current?.signal;
    try {
      const next = await getDivination(signal);
      if (signal?.aborted) return;
      setView(next);
      if (!next.canDraw && next.record) setDirection(next.record.direction);
      setText(next.canDraw ? '' : (next.record?.interpretation ?? ''));
      game.current?.show(next.canDraw ? null : (next.record?.dice ?? null));
    } catch (reason) {
      if (!signal?.aborted)
        setError(reason instanceof Error ? reason.message : '读取签文失败');
    }
  }, []);
  useEffect(() => {
    request.current = new AbortController();
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      request.current?.abort();
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!view) return;
    const untilMidnight =
      Date.parse(`${view.today}T00:00:00+08:00`) + 86_400_000 - Date.now();
    const timer = window.setTimeout(
      () => void refresh(),
      Math.max(1000, untilMidnight + 1000),
    );
    return () => window.clearTimeout(timer);
  }, [view, refresh]);

  const updateRecord = (next: DivinationRecord) => {
    setView((previous) =>
      previous ? { ...previous, record: next, canDraw: false } : previous,
    );
  };
  const perform = async () => {
    if (running.current || !view || (!canDraw && !pending)) return;
    if (canDraw && (!ready || artError)) return;
    running.current = true;
    setError(null);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      let result = record;
      if (canDraw) {
        setPhase('rolling');
        setText('');
        result = await drawDivination(direction, controller.signal);
        if (controller.signal.aborted) return;
        setDirection(result.direction);
        await game.current?.roll(result.dice);
        if (controller.signal.aborted) return;
        updateRecord(result);
      }
      if (!result) return;
      setPhase('reading');
      setText(result.interpretation ?? '');
      await interpretDivination(result.drawId, controller.signal, (event) => {
        if (controller.signal.aborted) return;
        if (event.type === 'text') setText((previous) => previous + event.text);
        if (event.type === 'interpretation' || event.type === 'complete') {
          updateRecord(event.record);
          setText(event.record.interpretation ?? '');
        }
        if (event.type === 'complete') consumeResourceChanges(event.state);
      });
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : '解签未完成，请稍后继续。',
        );
    } finally {
      running.current = false;
      if (!controller.signal.aborted) {
        setPhase('idle');
        void refresh();
      }
    }
  };
  const onReady = useEffectEvent(() => {
    setReady(true);
    game.current?.show(view?.canDraw ? null : (view?.record?.dice ?? null));
  });
  useEffect(() => {
    let disposed = false;
    void import('./DivinationPhaserRuntime')
      .then(({ createDivinationGame }) => {
        if (disposed || !root.current) return;
        game.current = createDivinationGame(root.current, {
          onReady: () => onReady(),
          onError: () => setArtError(true),
        });
      })
      .catch(() => {
        if (!disposed) setArtError(true);
      });
    return () => {
      disposed = true;
      game.current?.destroy();
      game.current = null;
    };
  }, []);

  return (
    <GameSceneFrame variant="workflow">
      <div
        className={`grid w-full items-start gap-6 ${shown ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}`}
      >
        <div className="min-w-0 space-y-4">
          <div
            className={`relative max-h-[max(12rem,calc(100svh-20rem))] w-full overflow-hidden bg-[#e9dfcd] sm:aspect-[3/2] sm:max-h-[max(12rem,calc(100svh-22rem))] ${shown ? 'aspect-[3/2]' : 'aspect-[2/3]'}`}
          >
            <div ref={root} className="absolute inset-0" aria-hidden="true" />
            {!ready && !artError && (
              <div className="absolute inset-0 grid place-items-center">
                <GameLoadingState message="正在加载……" variant="inline" />
              </div>
            )}
            {artError && (
              <p
                role="alert"
                className="bg-bgpaper/90 absolute inset-0 grid place-items-center p-4 text-center text-sm"
              >
                案台未能加载，请刷新重试。
              </p>
            )}
            {!shown && (
              <>
                <button
                  type="button"
                  aria-label="掷骰占卜"
                  disabled={!canDraw || !ready || artError || busy}
                  onClick={() => void perform()}
                  className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#fff5da] disabled:cursor-default"
                >
                  {ready && !artError && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-4 text-center text-sm text-[#fff5da]">
                      {phase === 'rolling' ? '掷骰中……' : '轻触案台 · 掷骰占卜'}
                    </span>
                  )}
                </button>
                <label className="bg-bgpaper/95 text-ink absolute top-3 left-3 flex min-h-11 items-center gap-2 px-3 text-sm shadow-sm">
                  <span className="text-ink-secondary">问</span>
                  <select
                    aria-label="占卜方向"
                    value={direction}
                    disabled={busy || !canDraw}
                    onChange={(event) =>
                      setDirection(event.target.value as DivinationDirection)
                    }
                    className="min-h-11 cursor-pointer bg-transparent pr-1 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-default"
                  >
                    {DIVINATION_DIRECTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {shown && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pt-8 pb-3 text-center text-sm text-[#fff5da]">
                <span className="font-mono">
                  {shown.dice.join(' · ')} · 共 {shown.total} 点
                </span>
              </div>
            )}
          </div>
        </div>
        {shown && (
          <div className="min-w-0" aria-busy={busy}>
            <p className="text-ink-secondary mb-3 text-xs tracking-widest">
              {shown.dayKey} ·{' '}
              {
                DIVINATION_DIRECTIONS.find(
                  (item) => item.id === shown.direction,
                )?.label
              }
            </p>
            <h2 className="text-crimson text-xl leading-8">
              {shown.omen.name}
            </h2>
            <p className="text-ink mt-3 text-base leading-8">
              {shown.omen.verse}
            </p>
            <div className="border-ink/15 mt-5 border-t pt-5">
              <p className="text-ink text-sm leading-8 whitespace-pre-wrap">
                {text || (busy ? '正在解签……' : '等待解签')}
              </p>
            </div>
            {shown.rewardGranted ? (
              <p role="status" className="text-teal mt-5 text-sm">
                {shown.rewardName} <span className="font-mono">×1</span>
                <span className="text-ink-secondary ml-3">已领取</span>
              </p>
            ) : (
              <div className="mt-5">
                <InkButton
                  variant="primary"
                  pending={busy}
                  pendingLabel={
                    shown.interpretation ? '领取中……' : '正在解签……'
                  }
                  onClick={() => void perform()}
                >
                  {shown.interpretation ? '领取签礼' : '继续解签'}
                </InkButton>
                {shown.dayKey !== view?.today && (
                  <p className="text-ink-secondary mt-2 text-xs">
                    领取后即可开始今日占卜
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="text-crimson text-sm lg:col-span-full">
            {error}
            <InkButton
              onClick={() => {
                setError(null);
                void refresh();
              }}
            >
              重新查看
            </InkButton>
          </div>
        )}
      </div>
    </GameSceneFrame>
  );
}

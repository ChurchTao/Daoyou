import { InkButton } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import { useTypewriter } from '@app/lib/hooks/useTypewriter';
import {
  createPerformanceState,
  currentPerformanceCue,
  reducePerformance,
  type PerformanceState,
} from '@shared/performance/interpreter';
import type {
  PerformanceContext,
  PerformanceScript,
  PerformanceTone,
} from '@shared/performance/schema';
import { useEffect, useState } from 'react';

const toneWash: Record<PerformanceTone, string> = {
  mist: 'bg-cyan-950/10',
  steel: 'bg-slate-950/15',
  ember: 'bg-red-950/15',
  stillness: 'bg-stone-950/20',
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function PerformancePlayer({
  script,
  context,
  finalLabel,
  exitLabel = '离开',
  busy = false,
  error,
  onFinish,
  onExit,
}: {
  script: PerformanceScript;
  context: PerformanceContext;
  finalLabel: string;
  exitLabel?: string;
  busy?: boolean;
  error?: string;
  onFinish: (outcome: string) => void;
  onExit: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [showLog, setShowLog] = useState(false);
  const [state, setState] = useState<PerformanceState>(() =>
    createPerformanceState(script, context),
  );
  const cue = currentPerformanceCue(script, state);
  const text =
    cue &&
    (cue.type === 'narration' || cue.type === 'line' || cue.type === 'title')
      ? cue.text
      : '';
  const typewriter = useTypewriter({
    text,
    speed: 34,
    startDelay: 220,
    enabled: !reducedMotion && !state.revealed && !state.ending && text.length > 0,
  });
  const shown = reducedMotion || state.revealed || state.ending ? text : typewriter.displayedText;
  const textDone = reducedMotion || state.revealed || typewriter.isComplete;
  const endingEntry = state.log.at(-1);

  const dispatch = (next: PerformanceState) => {
    setState(next);
    if (next.finished && next.outcome) onFinish(next.outcome);
  };

  const advance = () => {
    if (!textDone) {
      typewriter.skip();
      dispatch(reducePerformance(script, context, state, { type: 'advance' }));
      return;
    }
    dispatch(reducePerformance(script, context, state, { type: 'advance' }));
  };

  return (
    <section
      className="relative isolate min-h-[100svh] overflow-hidden bg-[#111713] text-[#f5efdf]"
      aria-label={script.title}
    >
      {state.backdrop.src ? (
        <GameImage
          key={state.backdrop.src}
          src={state.backdrop.src}
          alt={state.backdrop.alt}
          className="pointer-events-none absolute inset-0 -z-20 size-full object-cover"
          style={{ objectPosition: state.backdrop.focus }}
        />
      ) : null}
      <div className={`absolute inset-0 -z-10 ${toneWash[state.backdrop.tone]}`} />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(7,12,11,0.14)_0%,rgba(7,12,11,0.36)_44%,rgba(7,12,11,0.94)_100%)] md:bg-[linear-gradient(90deg,rgba(7,12,11,0.92)_0%,rgba(7,12,11,0.68)_46%,rgba(7,12,11,0.16)_78%)]" />

      <div className="mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col pt-[calc(env(safe-area-inset-top)+1.25rem)] pr-[max(env(safe-area-inset-right),1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pl-[max(env(safe-area-inset-left),1.25rem)] sm:pr-[max(env(safe-area-inset-right),2rem)] sm:pl-[max(env(safe-area-inset-left),2rem)]">
        <header className="flex items-start justify-between gap-5">
          <h1 className="text-xl tracking-[0.18em] sm:text-2xl">{script.title}</h1>
          <div className="flex gap-4">
            <InkButton
              onClick={() => setShowLog((open) => !open)}
              className="text-[#d9cfba] hover:text-white"
            >
              回顾
            </InkButton>
            {exitLabel ? (
              <InkButton
                onClick={onExit}
                disabled={busy}
                className="text-[#e7dcc3] hover:text-white"
              >
                {exitLabel}
              </InkButton>
            ) : null}
          </div>
        </header>

        {showLog ? (
          <ol className="mt-6 max-h-48 max-w-2xl space-y-3 overflow-y-auto text-sm leading-7 text-[#d9cfba]">
            {state.log.length === 0 ? <li>还没有读过的句子。</li> : null}
            {state.log.map((entry, index) => (
              <li key={`${entry.text}:${index}`}>
                {entry.speaker ? `${entry.speaker}：` : ''}
                {entry.text}
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-auto max-w-2xl pt-24 md:pt-32">
          {state.ending && endingEntry ? (
            <p className="text-base leading-8 whitespace-pre-wrap text-[#f6f0e2] sm:text-lg sm:leading-9">
              {endingEntry.speaker ? `${endingEntry.speaker}：` : ''}
              {endingEntry.text}
            </p>
          ) : null}

          {cue?.type === 'title' ? (
            <div>
              {cue.kicker ? (
                <p className="text-xs tracking-[0.28em] text-[#d8cba9]">{cue.kicker}</p>
              ) : null}
              <p className="mt-3 text-2xl tracking-[0.16em]">{shown}</p>
            </div>
          ) : null}

          {cue?.type === 'narration' || cue?.type === 'line' ? (
            <div>
              {cue.type === 'line' ? (
                <p className="text-sm tracking-[0.22em] text-[#d8cba9]">
                  {script.cast[cue.speaker]?.name}
                </p>
              ) : null}
              <p className="mt-4 min-h-40 text-base leading-8 whitespace-pre-wrap text-[#f6f0e2] sm:text-lg sm:leading-9">
                {shown}
                {!reducedMotion && typewriter.isRunning ? (
                  <span className="ml-1 animate-pulse text-[#d8cba9]">▌</span>
                ) : null}
              </p>
            </div>
          ) : null}

          {cue?.type === 'choice' ? (
            <div className="flex flex-col items-start gap-3">
              {cue.options.map((option, index) => (
                <InkButton
                  key={option.label}
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    dispatch(
                      reducePerformance(script, context, state, {
                        type: 'choose',
                        index,
                      }),
                    )
                  }
                >
                  {option.label}
                </InkButton>
              ))}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm leading-7 text-[#f0b7a7]">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4">
            {state.ending ? (
              <InkButton
                onClick={() =>
                  dispatch(reducePerformance(script, context, state, { type: 'finish' }))
                }
                pending={busy}
                pendingLabel="落字中……"
                variant="primary"
                className="text-[#f0c77b] hover:text-[#ffe2a4]"
              >
                {finalLabel}
              </InkButton>
            ) : cue?.type === 'choice' ? null : (
              <InkButton
                onClick={advance}
                disabled={busy}
                variant="primary"
                className="text-[#f0c77b] hover:text-[#ffe2a4]"
              >
                继续
              </InkButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

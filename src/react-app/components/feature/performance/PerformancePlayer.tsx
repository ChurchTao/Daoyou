import { InkButton, InkChoiceButton } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import { useTypewriter } from '@app/lib/hooks/useTypewriter';
import { cn } from '@shared/lib/cn';
import {
  currentPerformanceCue,
  createPerformanceState,
  reducePerformance,
  type PerformanceLogEntry,
  type PerformanceState,
} from '@shared/performance/interpreter';
import type {
  PerformanceContext,
  PerformanceScript,
} from '@shared/performance/schema';
import { useEffect, useRef, useState } from 'react';

const choiceMarks = ['一', '二', '三', '四'] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function ScenePicture({
  src,
  alt,
  focus,
}: {
  src: string;
  alt: string;
  focus: string;
}) {
  return (
    <figure className="relative h-[22svh] max-h-48 w-full shrink-0 overflow-hidden lg:h-auto lg:max-h-none lg:w-[38%] lg:self-stretch">
      <GameImage
        key={src}
        src={src}
        alt=""
        className="absolute inset-0 size-full object-cover"
        style={{ objectPosition: focus }}
      />
      {alt ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1c1712]/80 via-[#1c1712]/40 to-transparent px-5 pt-12 pb-4 text-[#f6f1e6]">
          <p className="text-xs tracking-[0.28em] text-[#f6f1e6]/75">眼前</p>
          <p className="mt-1 text-sm leading-6">{alt}</p>
        </figcaption>
      ) : null}
    </figure>
  );
}

function SceneWords({ alt }: { alt: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs tracking-[0.28em] text-ink-secondary">眼前</p>
      <p className="mt-2 text-base leading-7 text-ink">{alt}</p>
    </div>
  );
}

function Passage({
  entry,
  portrait,
  text,
  quoteClosed = true,
}: {
  entry: Pick<PerformanceLogEntry, 'kind' | 'speaker'>;
  portrait?: string;
  text: string;
  quoteClosed?: boolean;
}) {
  if (entry.kind === 'title') {
    return (
      <p className="text-center font-heading text-4xl leading-tight text-ink sm:text-5xl">
        {text}
      </p>
    );
  }

  if (entry.kind === 'line') {
    return (
      <div>
        <div className="flex items-center gap-3">
          {portrait ? (
            <GameImage
              src={portrait}
              alt=""
              purpose="artwork"
              className="h-14 w-11 object-cover"
            />
          ) : null}
          <p className="font-heading text-2xl leading-none text-ink">{entry.speaker}</p>
        </div>
        <p className="mt-3 text-xl leading-9 whitespace-pre-wrap text-ink">
          「{text}
          {quoteClosed ? '」' : ''}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs tracking-[0.28em] text-teal">旁白</p>
      <p className="mt-2 text-xl leading-9 whitespace-pre-wrap text-ink">{text}</p>
    </div>
  );
}

function ReadLog({
  entries,
  onClose,
}: {
  entries: PerformanceLogEntry[];
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col">
      <h2 className="text-sm text-ink-secondary">前面的字</h2>
      <ol className="mt-4 max-h-[40svh] space-y-5 overflow-y-auto lg:max-h-[52svh]">
        {entries.length === 0 ? (
          <li className="text-base leading-8 text-ink-secondary">还没有读过的句子。</li>
        ) : (
          entries.map((entry, index) => (
            <li key={`${entry.kind}:${entry.text}:${index}`}>
              <Passage entry={entry} text={entry.text} />
            </li>
          ))
        )}
      </ol>
      <InkButton onClick={onClose} className="mt-5 self-start" variant="secondary">
        合上
      </InkButton>
    </div>
  );
}

export function PerformancePlayer({
  script,
  context,
  finalLabel,
  exitLabel = '先回去',
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
  const reducedMotion = usePrefersReducedMotion();
  const [showLog, setShowLog] = useState(false);
  const [state, setState] = useState<PerformanceState>(() =>
    createPerformanceState(script, context),
  );
  const slipRef = useRef<HTMLButtonElement>(null);
  const cue = currentPerformanceCue(script, state);
  const text =
    cue && (cue.type === 'narration' || cue.type === 'line' || cue.type === 'title')
      ? cue.text
      : '';
  const typewriter = useTypewriter({
    text,
    speed: cue?.type === 'title' ? 70 : cue?.type === 'narration' ? 46 : 34,
    startDelay: reducedMotion ? 0 : 40,
    enabled: !reducedMotion && !state.revealed && !state.ending && text.length > 0,
  });
  const shown =
    reducedMotion || state.revealed || state.ending ? text : typewriter.displayedText;
  const textComplete = reducedMotion || state.revealed || typewriter.isComplete;
  const closing = state.ending || state.finished;
  const choosing = !closing && cue?.type === 'choice';
  const reading = !closing && !choosing && text.length > 0;
  const closingEntry = state.log.at(-1);
  const speaker = cue?.type === 'line' ? script.cast[cue.speaker] : undefined;
  const readingKind =
    cue?.type === 'title' || cue?.type === 'narration' || cue?.type === 'line'
      ? cue.type
      : null;

  const dispatch = (next: PerformanceState) => {
    setState(next);
    if (next.finished && next.outcome) onFinish(next.outcome);
  };

  const turn = () => {
    if (busy || showLog || closing || choosing) return;
    if (!textComplete) {
      typewriter.skip();
      dispatch(reducePerformance(script, context, state, { type: 'advance' }));
      return;
    }
    if (!state.revealed) {
      const revealed = reducePerformance(script, context, state, { type: 'advance' });
      dispatch(reducePerformance(script, context, revealed, { type: 'advance' }));
      return;
    }
    dispatch(reducePerformance(script, context, state, { type: 'advance' }));
  };

  const choose = (index: number) => {
    if (busy || showLog || !choosing) return;
    dispatch(reducePerformance(script, context, state, { type: 'choose', index }));
  };

  const finish = () => {
    if (busy) return;
    if (state.finished && state.outcome) {
      onFinish(state.outcome);
      return;
    }
    dispatch(reducePerformance(script, context, state, { type: 'finish' }));
  };

  const actions = useRef({
    turn,
    choose,
    finish,
    onExit,
    exitLabel,
    busy,
    showLog,
    closing,
    choosing,
    optionCount: cue?.type === 'choice' ? cue.options.length : 0,
  });

  useEffect(() => {
    actions.current = {
      turn,
      choose,
      finish,
      onExit,
      exitLabel,
      busy,
      showLog,
      closing,
      choosing,
      optionCount: cue?.type === 'choice' ? cue.options.length : 0,
    };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = actions.current;
      const target = event.target;
      const onControl =
        target instanceof HTMLElement &&
        Boolean(target.closest('button, a, input, textarea'));

      if (event.key === 'Escape') {
        if (current.showLog) {
          setShowLog(false);
          return;
        }
        if (current.exitLabel && !current.busy) current.onExit();
        return;
      }

      if (current.showLog || current.busy || onControl) return;

      if (current.choosing && /^[1-4]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (index < current.optionCount) {
          event.preventDefault();
          current.choose(index);
        }
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (current.closing) current.finish();
      else if (!current.choosing) current.turn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (reading) slipRef.current?.focus({ preventScroll: true });
  }, [reading, state.cursor]);

  const continueHint = textComplete ? '点一下，继续' : '再点一下，看完这句';
  const picture = state.backdrop.src;
  const place = picture ? '' : state.backdrop.alt;

  return (
    <section
      className="relative flex h-[100svh] flex-col overflow-hidden bg-paper text-ink"
      aria-label={script.title}
    >
      <div className="sr-only" aria-live="polite">
        {cue?.type === 'title' ? cue.text : null}
        {cue?.type === 'narration' ? `旁白。${cue.text}` : null}
        {cue?.type === 'line'
          ? `${script.cast[cue.speaker]?.name ?? ''}说。${cue.text}`
          : null}
        {choosing && cue?.type === 'choice'
          ? `要怎么做。${cue.options.map((option) => option.label).join('，')}`
          : null}
        {closing ? '可以离开这一幕了。' : null}
      </div>

      <div className="absolute top-[calc(env(safe-area-inset-top)+0.15rem)] right-[calc(env(safe-area-inset-right)+0.35rem)] z-20 flex items-center">
        <button
          type="button"
          onClick={() => setShowLog((open) => !open)}
          className="min-h-11 cursor-pointer px-2 text-sm text-ink/35 transition-colors hover:text-ink/70 focus-visible:text-ink/80 focus-visible:outline-none"
        >
          {showLog ? '接着看' : '回看'}
        </button>
        {exitLabel ? (
          <button
            type="button"
            onClick={onExit}
            disabled={busy}
            className="min-h-11 cursor-pointer px-2 text-sm text-ink/35 transition-colors hover:text-ink/70 focus-visible:text-ink/80 focus-visible:outline-none disabled:cursor-wait"
          >
            {exitLabel}
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {picture ? (
          <ScenePicture src={picture} alt={state.backdrop.alt} focus={state.backdrop.focus} />
        ) : null}

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] lg:px-12 lg:py-10',
            picture
              ? 'pt-6'
              : 'pt-[max(env(safe-area-inset-top),1.5rem)]',
          )}
        >
          <div className={cn('flex flex-1 flex-col', !picture && 'mx-auto w-full max-w-2xl')}>
          {showLog ? (
            <ReadLog entries={state.log} onClose={() => setShowLog(false)} />
          ) : null}

          {!showLog && reading && readingKind ? (
            <button
              ref={slipRef}
              type="button"
              onClick={turn}
              disabled={busy}
              aria-label={textComplete ? '继续' : '先看完这句'}
              className="flex w-full cursor-pointer flex-col bg-transparent text-left font-[inherit] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-crimson disabled:cursor-wait lg:my-auto"
            >
              {place ? <SceneWords alt={place} /> : null}
              {readingKind !== 'title' ? <h1 className="sr-only">{script.title}</h1> : null}
              {readingKind === 'title' && cue?.type === 'title' && cue.kicker ? (
                <p className="mb-3 text-center text-sm tracking-[0.22em] text-ink-secondary">
                  {cue.kicker}
                </p>
              ) : null}
              <Passage
                entry={{
                  kind: readingKind,
                  speaker: speaker?.name,
                }}
                portrait={speaker?.portrait}
                text={shown}
                quoteClosed={textComplete}
              />
              <p
                className={cn(
                  'mt-4 text-sm text-ink-secondary',
                  readingKind === 'title' && 'text-center',
                )}
              >
                {continueHint}
              </p>
            </button>
          ) : null}

          {!showLog && choosing && cue?.type === 'choice' ? (
            <div className="lg:my-auto">
              {place ? <SceneWords alt={place} /> : null}
              <h1 className="sr-only">{script.title}</h1>
              {closingEntry ? <Passage entry={closingEntry} text={closingEntry.text} /> : null}
              <div
                className="mt-5 flex flex-col gap-3"
                role="group"
                aria-label="要怎么做"
              >
                {cue.options.map((option, index) => (
                  <InkChoiceButton
                    key={option.label}
                    layout="card"
                    disabled={busy}
                    onClick={() => choose(index)}
                  >
                    <span className="mr-3 text-ink-secondary">{choiceMarks[index]}</span>
                    {option.label}
                  </InkChoiceButton>
                ))}
              </div>
            </div>
          ) : null}

          {!showLog && closing ? (
            <div className="lg:my-auto">
              {place ? <SceneWords alt={place} /> : null}
              <h1 className="sr-only">{script.title}</h1>
              {closingEntry ? (
                <Passage entry={closingEntry} text={closingEntry.text} />
              ) : (
                <p className="font-heading text-4xl text-ink">{script.title}</p>
              )}
              {error ? (
                <p role="alert" className="mt-4 text-sm leading-7 text-crimson">
                  {error}
                </p>
              ) : null}
              <div className="mt-5">
                <InkButton
                  onClick={finish}
                  pending={busy}
                  pendingLabel="落字中……"
                  variant="primary"
                >
                  {finalLabel}
                </InkButton>
              </div>
            </div>
          ) : null}

          {!showLog && !closing && error ? (
            <p role="alert" className="mt-4 text-sm leading-7 text-crimson">
              {error}
            </p>
          ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

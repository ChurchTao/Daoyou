import { InkButton, InkChoiceButton } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import { cn } from '@app/lib/cn';
import { useTypewriter } from '@app/lib/hooks/useTypewriter';
import type {
  PerformanceContext,
  PerformanceScript,
} from '@daoyou/game-domain/performance';
import {
  createPerformanceState,
  currentPerformanceCue,
  reducePerformance,
  type PerformanceLogEntry,
  type PerformanceState,
} from '@daoyou/game-rules/performance/interpreter';
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
  fit,
}: {
  src: string;
  alt: string;
  focus: string;
  fit: 'cover' | 'contain';
}) {
  return (
    <figure
      className={cn(
        'relative w-full shrink-0 overflow-hidden lg:h-auto lg:max-h-none lg:w-[38%] lg:self-stretch',
        fit === 'contain' ? 'h-[38svh] max-h-80' : 'h-[22svh] max-h-48',
      )}
    >
      <GameImage
        key={src}
        src={src}
        alt=""
        purpose={fit === 'contain' ? 'artwork' : undefined}
        className={cn(
          'absolute inset-0 size-full',
          fit === 'contain'
            ? 'object-contain p-5 pb-20 motion-safe:animate-[fade-in_1.2s_ease-out] lg:p-10 lg:pb-36'
            : 'object-cover',
        )}
        style={{ objectPosition: focus }}
      />
      {alt ? (
        <figcaption
          className={cn(
            'absolute inset-x-0 bottom-0 px-5 pb-4',
            fit === 'contain'
              ? 'from-paper via-paper/90 text-ink-secondary bg-gradient-to-t to-transparent pt-5 lg:px-10 lg:pb-10'
              : 'from-scene-scrim/80 via-scene-scrim/40 bg-gradient-to-t to-transparent pt-12 text-[#f6f1e6]',
          )}
        >
          <p className="text-xs tracking-[0.28em] opacity-75">眼前</p>
          <p className="mt-1 text-sm leading-6">{alt}</p>
        </figcaption>
      ) : null}
    </figure>
  );
}

function SceneWords({ alt }: { alt: string }) {
  return (
    <div className="mb-6">
      <p className="text-ink-secondary text-xs tracking-[0.28em]">眼前</p>
      <p className="text-ink mt-2 text-base leading-7">{alt}</p>
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
      <p className="font-heading text-ink text-center text-4xl leading-tight sm:text-5xl">
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
          <p className="font-heading text-ink text-2xl leading-none">
            {entry.speaker}
          </p>
        </div>
        <p className="text-ink mt-3 text-xl leading-9 whitespace-pre-wrap">
          「{text}
          {quoteClosed ? '」' : ''}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-teal text-xs tracking-[0.28em]">旁白</p>
      <p className="text-ink mt-2 text-xl leading-9 whitespace-pre-wrap">
        {text}
      </p>
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
      <h2 className="text-ink-secondary text-sm">前面的字</h2>
      <ol className="mt-4 max-h-[40svh] space-y-5 overflow-y-auto lg:max-h-[52svh]">
        {entries.length === 0 ? (
          <li className="text-ink-secondary text-base leading-8">
            还没有读过的句子。
          </li>
        ) : (
          entries.map((entry, index) => (
            <li key={`${entry.kind}:${entry.text}:${index}`}>
              <Passage entry={entry} text={entry.text} />
            </li>
          ))
        )}
      </ol>
      <InkButton
        onClick={onClose}
        className="mt-5 self-start"
        variant="secondary"
      >
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
  pictureFit = 'cover',
  finishHint,
  finishPendingLabel = '落字中……',
}: {
  script: PerformanceScript;
  context: PerformanceContext;
  finalLabel: string;
  exitLabel?: string;
  busy?: boolean;
  error?: string;
  onFinish: (outcome: string) => void;
  onExit: () => void;
  pictureFit?: 'cover' | 'contain';
  finishHint?: string;
  finishPendingLabel?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [showLog, setShowLog] = useState(false);
  const [state, setState] = useState<PerformanceState>(() =>
    createPerformanceState(script, context),
  );
  const slipRef = useRef<HTMLButtonElement>(null);
  const cue = currentPerformanceCue(script, state);
  const text =
    cue &&
    (cue.type === 'narration' || cue.type === 'line' || cue.type === 'title')
      ? cue.text
      : '';
  const typewriter = useTypewriter({
    text,
    speed: cue?.type === 'title' ? 70 : cue?.type === 'narration' ? 46 : 34,
    startDelay: reducedMotion ? 0 : 40,
    enabled:
      !reducedMotion && !state.revealed && !state.ending && text.length > 0,
  });
  const shown =
    reducedMotion || state.revealed || state.ending
      ? text
      : typewriter.displayedText;
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
      const revealed = reducePerformance(script, context, state, {
        type: 'advance',
      });
      dispatch(
        reducePerformance(script, context, revealed, { type: 'advance' }),
      );
      return;
    }
    dispatch(reducePerformance(script, context, state, { type: 'advance' }));
  };

  const choose = (index: number) => {
    if (busy || showLog || !choosing) return;
    dispatch(
      reducePerformance(script, context, state, { type: 'choose', index }),
    );
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
      className="bg-paper text-ink relative flex h-dvh flex-col overflow-hidden"
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

      <div className="absolute top-[calc(var(--app-safe-top)+0.15rem)] right-[calc(env(safe-area-inset-right)+0.35rem)] z-20 flex items-center">
        <button
          type="button"
          onClick={() => setShowLog((open) => !open)}
          className="text-ink/35 hover:text-ink/70 focus-visible:text-ink/80 min-h-11 cursor-pointer px-2 text-sm transition-colors focus-visible:outline-none"
        >
          {showLog ? '接着看' : '回看'}
        </button>
        {exitLabel ? (
          <button
            type="button"
            onClick={onExit}
            disabled={busy}
            className="text-ink/35 hover:text-ink/70 focus-visible:text-ink/80 min-h-11 cursor-pointer px-2 text-sm transition-colors focus-visible:outline-none disabled:cursor-wait"
          >
            {exitLabel}
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {picture ? (
          <ScenePicture
            src={picture}
            alt={state.backdrop.alt}
            focus={state.backdrop.focus}
            fit={pictureFit}
          />
        ) : null}

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] lg:px-12 lg:py-10',
            picture ? 'pt-6' : 'pt-[max(var(--app-safe-top),1.5rem)]',
          )}
        >
          <div
            className={cn(
              'flex flex-1 flex-col',
              !picture && 'mx-auto w-full max-w-2xl',
            )}
          >
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
                className="text-ink focus-visible:outline-crimson flex w-full cursor-pointer flex-col bg-transparent text-left font-[inherit] outline-none focus-visible:outline-2 focus-visible:outline-offset-8 disabled:cursor-wait lg:my-auto"
              >
                {place ? <SceneWords alt={place} /> : null}
                {readingKind !== 'title' ? (
                  <h1 className="sr-only">{script.title}</h1>
                ) : null}
                {readingKind === 'title' &&
                cue?.type === 'title' &&
                cue.kicker ? (
                  <p className="text-ink-secondary mb-3 text-center text-sm tracking-[0.22em]">
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
                    'text-ink-secondary mt-4 text-sm',
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
                {closingEntry ? (
                  <Passage entry={closingEntry} text={closingEntry.text} />
                ) : null}
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
                      <span className="text-ink-secondary mr-3">
                        {choiceMarks[index]}
                      </span>
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
                  <p className="font-heading text-ink text-4xl">
                    {script.title}
                  </p>
                )}
                {error ? (
                  <p
                    role="alert"
                    className="text-crimson mt-4 text-sm leading-7"
                  >
                    {error}
                  </p>
                ) : null}
                {finishHint ? (
                  <p className="text-ink-secondary mt-4 text-sm leading-7">
                    {finishHint}
                  </p>
                ) : null}
                <div className="mt-5">
                  <InkButton
                    onClick={finish}
                    pending={busy}
                    pendingLabel={finishPendingLabel}
                    variant="primary"
                  >
                    {finalLabel}
                  </InkButton>
                </div>
              </div>
            ) : null}

            {!showLog && !closing && error ? (
              <p role="alert" className="text-crimson mt-4 text-sm leading-7">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

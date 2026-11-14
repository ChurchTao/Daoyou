import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { GameImage } from '@app/components/ui/GameImage';
import { cn } from '@app/lib/cn';
import { useTypewriter } from '@app/lib/hooks/useTypewriter';
import {
  isPerformanceTextCue,
  performanceCueText,
  type PerformanceContext,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';
import {
  createPerformanceState,
  currentPerformanceCue,
  reducePerformance,
  type PerformanceLogEntry,
  type PerformanceState,
} from '@daoyou/game-rules/performance/interpreter';
import { useEffect, useRef, useState } from 'react';

const PLAYER_ACTOR = 'player';

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

function Face({ value }: { value?: string }) {
  if (!value) return <span className="block w-[4.5rem] shrink-0" />;
  return value.startsWith('icon:') ? (
    <GameIcon
      purpose="artwork"
      value={value}
      className="size-[4.5rem] motion-safe:animate-[fade-in_0.8s_ease-out]"
    />
  ) : (
    <GameImage
      src={value}
      alt=""
      className="size-[4.5rem] shrink-0 object-cover motion-safe:animate-[fade-in_0.8s_ease-out]"
    />
  );
}

type PageEntry = Pick<
  PerformanceLogEntry,
  'kind' | 'speaker' | 'actor' | 'heading' | 'text'
>;

/** 纸页上的一段。读过的变淡，正在读的是墨色。 */
function Passage({
  entry,
  face,
  showFace,
  past = false,
  quoteClosed = true,
}: {
  entry: PageEntry;
  /** 这段话的人有没有小像。没有就不留页边。 */
  face?: string;
  /** 同一个人接着说，不再出一次小像。 */
  showFace: boolean;
  past?: boolean;
  quoteClosed?: boolean;
}) {
  const ink = past ? 'text-ink-secondary' : 'text-ink';

  if (entry.kind === 'title') {
    return (
      <div className="py-4 text-center">
        {entry.heading ? (
          <p className="text-ink-secondary mb-2 text-sm tracking-[0.22em]">
            {entry.heading}
          </p>
        ) : null}
        <p className={cn('font-heading text-4xl leading-tight', ink)}>
          {entry.text}
        </p>
      </div>
    );
  }

  if (entry.kind === 'letter') {
    return (
      <div className="border-ink/20 bg-ink/[0.03] border px-5 py-4">
        {entry.heading ? (
          <p className="text-ink-secondary mb-2 text-center text-sm tracking-[0.22em]">
            {entry.heading}
          </p>
        ) : null}
        <p className={cn('text-lg leading-9 whitespace-pre-wrap', ink)}>
          {entry.text}
        </p>
      </div>
    );
  }

  if (entry.kind === 'recall') {
    return (
      <p
        className={cn(
          'border-ink/20 border-y py-4 text-center text-lg leading-10 whitespace-pre-wrap',
          past ? 'text-ink-secondary' : 'text-ink/80',
        )}
      >
        {entry.text}
      </p>
    );
  }

  if (entry.kind === 'aside') {
    return (
      <p
        className={cn(
          'border-ink/25 border-l pl-4 text-lg leading-9 whitespace-pre-wrap',
          ink,
        )}
      >
        {entry.text}
      </p>
    );
  }

  if (entry.kind === 'said') {
    const action = entry.text.startsWith('（');
    return (
      <div className="flex flex-row-reverse items-start gap-4">
        {face ? showFace ? <Face value={face} /> : <Face /> : null}
        <p
          className={cn(
            'min-w-0 flex-1 text-right leading-9 whitespace-pre-wrap',
            action ? 'text-ink-secondary text-lg' : cn('text-xl', ink),
          )}
        >
          {action ? entry.text : `「${entry.text}」`}
        </p>
      </div>
    );
  }

  if (entry.kind === 'line') {
    const mine = entry.actor === PLAYER_ACTOR;
    return (
      <div
        className={cn('flex items-start gap-4', mine && 'flex-row-reverse')}
      >
        {face ? showFace ? <Face value={face} /> : <Face /> : null}
        <div className={cn('min-w-0 flex-1', mine && 'text-right')}>
          {showFace && entry.speaker ? (
            <p className="text-ink-secondary text-sm tracking-[0.18em]">
              {entry.speaker}
            </p>
          ) : null}
          <p className={cn('text-xl leading-9 whitespace-pre-wrap', ink)}>
            「{entry.text}
            {quoteClosed ? '」' : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <p
      className={cn(
        'indent-[2em] text-lg leading-9 whitespace-pre-wrap',
        past ? 'text-ink-secondary' : 'text-ink/85',
      )}
    >
      {entry.text}
    </p>
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
  flags = [],
  playerPortrait,
}: {
  script: PerformanceScript;
  context: PerformanceContext;
  finalLabel: string;
  exitLabel?: string;
  busy?: boolean;
  error?: string;
  /** chosen 是这一场里新记下的标记。 */
  onFinish: (outcome: string, chosen: string[]) => void;
  onExit: () => void;
  pictureFit?: 'cover' | 'contain';
  finishHint?: string;
  finishPendingLabel?: string;
  /** 开演前已经记下的标记。 */
  flags?: readonly string[];
  /** 看的人自己的小像。 */
  playerPortrait?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [opening] = useState(() => [...flags]);
  const [state, setState] = useState<PerformanceState>(() =>
    createPerformanceState(script, context, opening),
  );
  const pageRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLButtonElement>(null);
  const cue = currentPerformanceCue(script, state);
  const textCue = cue && isPerformanceTextCue(cue) ? cue : null;
  const text = textCue ? performanceCueText(textCue) : '';
  const typewriter = useTypewriter({
    text,
    speed:
      textCue?.type === 'title' ? 70 : textCue?.type === 'line' ? 34 : 46,
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
  const reading = !closing && !choosing && Boolean(textCue);

  const dispatch = (next: PerformanceState) => {
    setState(next);
    if (next.finished && next.outcome) {
      onFinish(
        next.outcome,
        next.flags.filter((flag) => !opening.includes(flag)),
      );
    }
  };

  const step = (
    from: PerformanceState,
    action: Parameters<typeof reducePerformance>[3],
  ) => reducePerformance(script, context, from, action, opening);

  const turn = () => {
    if (busy || closing || choosing) return;
    if (!textComplete) {
      typewriter.skip();
      dispatch(step(state, { type: 'advance' }));
      return;
    }
    if (!state.revealed) {
      dispatch(step(step(state, { type: 'advance' }), { type: 'advance' }));
      return;
    }
    dispatch(step(state, { type: 'advance' }));
  };

  const choose = (index: number) => {
    if (busy || !choosing) return;
    dispatch(step(state, { type: 'choose', index }));
  };

  const finish = () => {
    if (busy) return;
    if (state.finished && state.outcome) {
      onFinish(
        state.outcome,
        state.flags.filter((flag) => !opening.includes(flag)),
      );
      return;
    }
    dispatch(step(state, { type: 'finish' }));
  };

  const actions = useRef({
    turn,
    choose,
    finish,
    onExit,
    exitLabel,
    busy,
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
        if (current.exitLabel && !current.busy) current.onExit();
        return;
      }

      if (current.busy || onControl) return;

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

  // 新落下的字总在眼前；往上滚就是回看。
  useEffect(() => {
    const page = pageRef.current;
    if (page) page.scrollTop = page.scrollHeight;
  }, [state.cursor, state.log.length, shown.length, choosing, closing]);

  const picture = state.backdrop.src;
  const place = picture ? '' : state.backdrop.alt;
  const faceOf = (actor?: string) =>
    actor === PLAYER_ACTOR
      ? (script.cast[actor]?.portrait ?? playerPortrait)
      : actor
        ? script.cast[actor]?.portrait
        : undefined;
  const entryFace = (entry: PageEntry) =>
    entry.kind === 'said' ? playerPortrait : faceOf(entry.actor);
  const voiceOf = (entry?: PageEntry) =>
    entry?.kind === 'said'
      ? PLAYER_ACTOR
      : entry?.kind === 'line'
        ? entry.actor
        : undefined;

  const current: (PageEntry & { page: number }) | null =
    reading && textCue
      ? {
          kind: textCue.type,
          text: shown,
          page: state.page,
          ...(textCue.type === 'line'
            ? {
                actor: textCue.speaker,
                speaker: script.cast[textCue.speaker]?.name,
              }
            : {}),
          ...(textCue.type === 'title' && textCue.kicker
            ? { heading: textCue.kicker }
            : {}),
          ...(textCue.type === 'letter' && textCue.title
            ? { heading: textCue.title }
            : {}),
        }
      : null;
  const entries = current ? [...state.log, current] : state.log;
  const pages = entries.reduce<Array<typeof entries>>((all, entry) => {
    const last = all.at(-1);
    if (last && last[0]?.page === entry.page) last.push(entry);
    else all.push([entry]);
    return all;
  }, []);
  if (pages.at(-1)?.[0]?.page !== state.page) pages.push([]);

  return (
    <section
      className="bg-paper text-ink relative flex h-dvh flex-col overflow-hidden motion-safe:animate-[fade-in_0.5s_ease-out]"
      aria-label={script.title}
    >
      <h1 className="sr-only">{script.title}</h1>
      <div className="sr-only" aria-live="polite">
        {textCue?.type === 'line'
          ? `${script.cast[textCue.speaker]?.name ?? ''}说。${text}`
          : text}
        {choosing && cue?.type === 'choice'
          ? `要怎么做。${cue.options.map((option) => option.label).join('，')}`
          : null}
        {closing ? '可以离开这一幕了。' : null}
      </div>

      {exitLabel ? (
        <div className="absolute top-[calc(var(--app-safe-top)+0.15rem)] right-[calc(env(safe-area-inset-right)+0.35rem)] z-20">
          <button
            type="button"
            onClick={onExit}
            disabled={busy}
            className="text-ink/35 hover:text-ink/70 focus-visible:text-ink/80 min-h-11 cursor-pointer px-2 text-sm transition-colors focus-visible:outline-none disabled:cursor-wait"
          >
            {exitLabel}
          </button>
        </div>
      ) : null}

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
          ref={pageRef}
          onClick={turn}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] lg:px-12',
            reading && !busy && 'cursor-pointer',
          )}
        >
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col">
            {pages.map((page, at) => {
              const open = at === pages.length - 1;
              return (
                <div
                  key={page[0]?.page ?? `open:${state.page}`}
                  className={cn(
                    'flex flex-col gap-5',
                    open
                      ? cn(
                          'min-h-full flex-1 pb-6',
                          picture
                            ? 'pt-6'
                            : 'pt-[max(var(--app-safe-top),3rem)]',
                        )
                      : 'border-ink/10 border-b py-8',
                  )}
                >
                  {open && place ? (
                    <div>
                      <p className="text-ink-secondary text-xs tracking-[0.28em]">
                        眼前
                      </p>
                      <p className="text-ink-secondary mt-1 text-base leading-7">
                        {place}
                      </p>
                    </div>
                  ) : null}

                  {page.map((entry, index) => {
                    const isCurrent = entry === current;
                    return (
                      <Passage
                        key={`${entry.page}:${index}`}
                        entry={entry}
                        face={entryFace(entry)}
                        showFace={
                          voiceOf(page[index - 1]) !== voiceOf(entry)
                        }
                        past={!isCurrent}
                        quoteClosed={!isCurrent || textComplete}
                      />
                    );
                  })}

                  {open && reading ? (
                    <button
                      ref={slipRef}
                      type="button"
                      disabled={busy}
                      aria-label={textComplete ? '继续' : '先看完这句'}
                      className="text-ink-secondary focus-visible:outline-crimson min-h-11 cursor-pointer self-center bg-transparent px-6 text-sm outline-none focus-visible:outline-2 disabled:cursor-wait"
                    >
                      {!textComplete
                        ? ''
                        : state.log.length < 2
                          ? '点一下，继续'
                          : '▾'}
                    </button>
                  ) : null}

                  {open && choosing && cue?.type === 'choice' ? (
                    <div
                      className="border-ink/10 flex flex-col border-t pt-3"
                      role="group"
                      aria-label="要怎么做"
                    >
                      {cue.options.map((option, index) => (
                        <button
                          key={option.label}
                          type="button"
                          disabled={busy}
                          onClick={() => choose(index)}
                          className="group text-ink focus-visible:outline-crimson relative min-h-11 cursor-pointer bg-transparent py-1.5 pl-7 text-left text-xl leading-9 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-wait"
                        >
                          <span
                            aria-hidden
                            className="bg-crimson absolute top-[1.15rem] left-1.5 size-1.5 rounded-full"
                          />
                          <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0_1.5px] bg-[position:0_100%] bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1.5px] group-focus-visible:bg-[length:100%_1.5px] group-active:bg-[length:100%_1.5px]">
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {open && closing ? (
                    <div className="pt-2">
                      {finishHint ? (
                        <p className="text-ink-secondary mb-4 text-sm leading-7">
                          {finishHint}
                        </p>
                      ) : null}
                      <InkButton
                        onClick={finish}
                        pending={busy}
                        pendingLabel={finishPendingLabel}
                        variant="primary"
                      >
                        {finalLabel}
                      </InkButton>
                    </div>
                  ) : null}

                  {open && error ? (
                    <p
                      role="alert"
                      className="text-crimson text-sm leading-7"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

import { InkButton, InkChoiceButton } from '@app/components/ui';
import { useTypewriter } from '@app/lib/hooks/useTypewriter';
import { cn } from '@app/lib/cn';
import { useEffect, useRef, useState } from 'react';

const choiceMarks = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

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

export interface InquiryChoice {
  id: string;
  label: string;
}

export interface InquiryNote {
  id: string;
  title: string;
  body: string;
}

function Passage({
  place,
  text,
  caret,
}: {
  place: string;
  text: string;
  caret?: boolean;
}) {
  return (
    <div>
      {place ? (
        <div className="mb-6">
          <p className="text-xs tracking-[0.28em] text-ink-secondary">眼前</p>
          <p className="mt-2 text-base leading-7 text-ink">{place}</p>
        </div>
      ) : null}
      <p className="text-xs tracking-[0.28em] text-teal">旁白</p>
      <p className="mt-2 text-xl leading-9 whitespace-pre-wrap text-ink">
        {text}
        {caret ? <span className="ml-1 animate-pulse text-ink-secondary">▌</span> : null}
      </p>
    </div>
  );
}

function Journal({
  clues,
  notes,
  onClose,
}: {
  clues: InquiryNote[];
  notes: InquiryNote[];
  onClose: () => void;
}) {
  const entries = [...clues, ...notes];
  return (
    <div className="flex flex-col">
      <h2 className="text-sm text-ink-secondary">记下的</h2>
      <ol className="mt-4 max-h-[52svh] space-y-5 overflow-y-auto">
        {entries.length === 0 ? (
          <li className="text-base leading-8 text-ink-secondary">还没有记下的东西。</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id}>
              <p className="font-heading text-2xl leading-none text-ink">{entry.title}</p>
              <p className="mt-3 text-xl leading-9 text-ink">{entry.body}</p>
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

export function InquiryPerformance({
  title,
  place,
  prose,
  beatKey,
  streaming,
  arrivedLive,
  choices,
  clues,
  notes,
  verdict,
  selectedAnswerId,
  selectedContainer,
  onSelectAnswer,
  onSelectContainer,
  onVerdict,
  feedback,
  error,
  pending,
  onChoose,
  onLeave,
  onExit,
  exitLabel = '先回去',
}: {
  title: string;
  place: string;
  prose: string;
  beatKey: string;
  streaming: boolean;
  arrivedLive: boolean;
  choices: InquiryChoice[];
  clues: InquiryNote[];
  notes: InquiryNote[];
  verdict: {
    answerLabel: string;
    answers: InquiryChoice[];
    containerLabel: string;
    containerOptions: Array<{ id: 'leave_shut' | 'open'; label: string }>;
  } | null;
  selectedAnswerId: string;
  selectedContainer: 'leave_shut' | 'open';
  onSelectAnswer: (id: string) => void;
  onSelectContainer: (id: 'leave_shut' | 'open') => void;
  onVerdict: () => void;
  feedback?: string;
  error?: string;
  pending: boolean;
  onChoose: (id: string) => void;
  onLeave?: () => void;
  onExit: () => void;
  exitLabel?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [journalOpen, setJournalOpen] = useState(false);
  const [choicesOpen, setChoicesOpen] = useState(false);
  const slipRef = useRef<HTMLButtonElement>(null);
  const typewriter = useTypewriter({
    text: prose,
    speed: 46,
    startDelay: reducedMotion ? 0 : 40,
    enabled: !reducedMotion && !choicesOpen && !streaming && !arrivedLive && prose.length > 0,
  });
  const shown = reducedMotion || choicesOpen || streaming || arrivedLive ? prose : typewriter.displayedText;
  const textComplete =
    reducedMotion || choicesOpen || streaming || arrivedLive || typewriter.isComplete;

  useEffect(() => {
    if (streaming) {
      setChoicesOpen(false);
      return;
    }
    setChoicesOpen(arrivedLive || reducedMotion);
  }, [arrivedLive, beatKey, reducedMotion, streaming]);

  const reveal = () => {
    if (!textComplete) {
      typewriter.skip();
      return;
    }
    setChoicesOpen(true);
  };

  const choosing = choicesOpen && !streaming && !journalOpen;
  const reading = !choosing && !journalOpen && prose.length > 0;

  const actions = useRef({
    reveal,
    onChoose,
    onExit,
    choosing,
    reading,
    pending,
    journalOpen,
    choices,
  });
  useEffect(() => {
    actions.current = {
      reveal,
      onChoose,
      onExit,
      choosing,
      reading,
      pending,
      journalOpen,
      choices,
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
        if (current.journalOpen) {
          setJournalOpen(false);
          return;
        }
        if (!current.pending) current.onExit();
        return;
      }
      if (current.journalOpen || current.pending || onControl) return;
      if (current.choosing && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const choice = current.choices[index];
        if (choice) {
          event.preventDefault();
          current.onChoose(choice.id);
        }
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!current.reading) return;
      event.preventDefault();
      current.reveal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (reading) slipRef.current?.focus({ preventScroll: true });
  }, [reading, beatKey]);

  return (
    <section className="relative flex h-[100svh] flex-col overflow-hidden bg-paper text-ink" aria-label={title}>
      <h1 className="sr-only">{title}</h1>
      <div className="sr-only" aria-live="polite">
        {prose ? `旁白。${prose}` : null}
        {choosing ? `要怎么做。${choices.map((choice) => choice.label).join('，')}` : null}
      </div>
      <div className="absolute top-[calc(env(safe-area-inset-top)+0.15rem)] right-[calc(env(safe-area-inset-right)+0.35rem)] z-20 flex items-center">
        <button
          type="button"
          onClick={() => setJournalOpen((open) => !open)}
          className="min-h-11 cursor-pointer px-2 text-sm text-ink/35 transition-colors hover:text-ink/70 focus-visible:text-ink/80 focus-visible:outline-none"
        >
          {journalOpen ? '接着看' : '回看'}
        </button>
        <button
          type="button"
          onClick={onExit}
          disabled={pending}
          className="min-h-11 cursor-pointer px-2 text-sm text-ink/35 transition-colors hover:text-ink/70 focus-visible:text-ink/80 focus-visible:outline-none disabled:cursor-wait"
        >
          {exitLabel}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.25rem)] lg:px-12 lg:py-10">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          {journalOpen ? (
            <Journal clues={clues} notes={notes} onClose={() => setJournalOpen(false)} />
          ) : null}
          {reading ? (
            <button
              ref={slipRef}
              type="button"
              onClick={reveal}
              disabled={pending}
              aria-label={textComplete ? '继续' : '先看完这句'}
              className="flex w-full cursor-pointer flex-col bg-transparent text-left font-[inherit] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-crimson disabled:cursor-wait lg:my-auto"
            >
              <Passage place={place} text={shown} caret={!reducedMotion && typewriter.isRunning} />
              <p className="mt-4 text-sm text-ink-secondary">
                {pending ? '这一幕还在落下……' : textComplete ? '点一下，继续' : '再点一下，看完这句'}
              </p>
            </button>
          ) : null}
          {choosing ? (
            <div className="lg:my-auto">
              <Passage place={place} text={prose} />
              {feedback ? <p className="mt-4 text-sm leading-7 text-crimson">{feedback}</p> : null}
              {error ? (
                <p role="alert" className="mt-4 text-sm leading-7 text-crimson">
                  {error}
                </p>
              ) : null}
              {choices.length > 0 ? (
                <div className="mt-5 flex flex-col gap-3" role="group" aria-label="要怎么做">
                  {choices.map((choice, index) => (
                    <InkChoiceButton
                      key={choice.id}
                      layout="card"
                      disabled={pending}
                      onClick={() => onChoose(choice.id)}
                    >
                      <span className="mr-3 text-ink-secondary">
                        {choiceMarks[index] ?? String(index + 1)}
                      </span>
                      {choice.label}
                    </InkChoiceButton>
                  ))}
                </div>
              ) : null}
              {verdict ? (
                <div className="mt-8 space-y-5">
                  <div>
                    <p className="text-xs tracking-[0.28em] text-ink-secondary">{verdict.answerLabel}</p>
                    <div className="mt-3 flex flex-col gap-3">
                      {verdict.answers.map((answer) => (
                        <InkChoiceButton
                          key={answer.id}
                          layout="card"
                          selected={selectedAnswerId === answer.id}
                          disabled={pending}
                          onClick={() => onSelectAnswer(answer.id)}
                        >
                          {answer.label}
                        </InkChoiceButton>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs tracking-[0.28em] text-ink-secondary">{verdict.containerLabel}</p>
                    <div className="mt-3 flex flex-col gap-3">
                      {verdict.containerOptions.map((option) => (
                        <InkChoiceButton
                          key={option.id}
                          layout="card"
                          selected={selectedContainer === option.id}
                          disabled={pending}
                          onClick={() => onSelectContainer(option.id)}
                        >
                          {option.label}
                        </InkChoiceButton>
                      ))}
                    </div>
                  </div>
                  <InkButton onClick={onVerdict} pending={pending} variant="primary">
                    提交定论
                  </InkButton>
                </div>
              ) : null}
              {onLeave ? (
                <InkButton
                  onClick={onLeave}
                  disabled={pending}
                  className={cn('mt-6 text-ink-secondary')}
                >
                  带着现有收获离开
                </InkButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

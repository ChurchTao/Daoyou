import { InkButton } from '@app/components/ui';
import { useTypewriter } from '@app/lib/hooks/useTypewriter';
import type {
  NarrativeAct,
  NarrativePerformanceScript,
  NarrativeTone,
} from '@shared/types/narrative';
import { useEffect, useState } from 'react';
import {
  advanceNarrativePerformance,
  createNarrativePerformanceState,
  rewindNarrativePerformance,
  shouldAnimateNarrativeAct,
} from './narrativePerformanceState';

const toneWash: Record<NarrativeTone, string> = {
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

function NarrativeActPanel({
  act,
  reducedMotion,
  revealed,
  isFinal,
  busy,
  error,
  finalLabel,
  canRewind,
  onReveal,
  onAdvance,
  onRewind,
  onFinish,
  onBack,
}: {
  act: NarrativeAct;
  reducedMotion: boolean;
  revealed: boolean;
  isFinal: boolean;
  busy: boolean;
  error?: string;
  finalLabel: string;
  canRewind: boolean;
  onReveal: () => void;
  onAdvance: () => void;
  onRewind: () => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  const fullText = [act.body, act.speaker].filter(Boolean).join('\n\n');
  const typewriter = useTypewriter({
    text: fullText,
    speed: 34,
    startDelay: 260,
    enabled: shouldAnimateNarrativeAct(reducedMotion, revealed),
  });
  const displayedText = reducedMotion ? fullText : typewriter.displayedText;
  const actRevealed = reducedMotion || revealed || typewriter.isComplete;

  const continuePerformance = () => {
    if (!actRevealed) {
      typewriter.skip();
      onReveal();
      return;
    }
    onAdvance();
  };

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {act.title}。{fullText}
      </div>
      <div
        className="mt-4 min-h-40 whitespace-pre-wrap text-base leading-8 text-[#f6f0e2] sm:text-lg sm:leading-9"
        aria-hidden="true"
      >
        {displayedText}
        {!reducedMotion && typewriter.isRunning && (
          <span className="ml-1 animate-pulse text-[#d8cba9]">▌</span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm leading-7 text-[#f0b7a7]">
          {error}
        </p>
      )}

      <div className="mt-6 flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4">
        {canRewind && (
          <InkButton
            onClick={onRewind}
            disabled={busy}
            className="text-[#d9cfba] hover:text-white"
          >
            上一幕
          </InkButton>
        )}
        {!isFinal || !actRevealed ? (
          <InkButton
            onClick={continuePerformance}
            disabled={busy}
            variant="primary"
            className="text-[#f0c77b] hover:text-[#ffe2a4]"
          >
            继续
          </InkButton>
        ) : (
          <>
            <InkButton
              onClick={onFinish}
              disabled={busy}
              variant="primary"
              className="text-[#f0c77b] hover:text-[#ffe2a4]"
            >
              {busy ? '玉牒落印中……' : finalLabel}
            </InkButton>
            <InkButton
              onClick={onBack}
              disabled={busy}
              className="text-[#d9cfba] hover:text-white"
            >
              再看看其他宗门
            </InkButton>
          </>
        )}
      </div>
    </>
  );
}

export function NarrativePerformanceStage({
  script,
  finalLabel,
  busy,
  error,
  onBack,
  onFinish,
}: {
  script: NarrativePerformanceScript;
  finalLabel: string;
  busy: boolean;
  error?: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [performance, setPerformance] = useState(
    createNarrativePerformanceState,
  );
  const reducedMotion = useReducedMotion();
  const act = script.acts[performance.actIndex];
  const isFinal = performance.actIndex === script.acts.length - 1;

  return (
    <section
      className="relative isolate min-h-[100svh] overflow-hidden bg-[#111713] text-[#f5efdf]"
      aria-label={script.title}
    >
      <div
        key={act.id}
        role="img"
        aria-label={script.backdrop.alt}
        className="absolute inset-0 -z-20 scale-[1.03] bg-cover bg-center motion-safe:animate-[narrative-drift_18s_ease-out_forwards]"
        style={{
          backgroundImage: `url(${script.backdrop.src})`,
          backgroundPosition: act.backgroundPosition,
        }}
      />
      <div
        className={`absolute inset-0 -z-10 ${toneWash[act.tone ?? script.theme]}`}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(7,12,11,0.14)_0%,rgba(7,12,11,0.36)_44%,rgba(7,12,11,0.94)_100%)] md:bg-[linear-gradient(90deg,rgba(7,12,11,0.92)_0%,rgba(7,12,11,0.68)_46%,rgba(7,12,11,0.16)_78%)]" />

      <div className="mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-8 md:px-12">
        <header className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs tracking-[0.28em] text-[#d8cba9]">{act.scene}</p>
            <h1 className="mt-2 text-xl tracking-[0.18em] sm:text-2xl">{script.title}</h1>
          </div>
          <InkButton
            onClick={onBack}
            disabled={busy}
            className="text-[#e7dcc3] hover:text-white"
          >
            返回诸宗
          </InkButton>
        </header>

        <div className="mt-auto max-w-2xl pt-24 md:pt-32">
          <div className="mb-5 flex items-center gap-2" aria-label="演出进度">
            <span className="sr-only">当前：{act.title}</span>
            {script.acts.map((entry, index) => (
              <span
                key={entry.id}
                aria-hidden="true"
                className={`block h-px transition-all ${index === performance.actIndex ? 'w-10 bg-[#e8d6a9]' : index < performance.actIndex ? 'w-5 bg-[#e8d6a9]/65' : 'w-5 bg-white/25'}`}
              />
            ))}
          </div>
          <p className="text-sm tracking-[0.24em] text-[#d8cba9]">{act.title}</p>
          <NarrativeActPanel
            key={`${script.id}:${act.id}`}
            act={act}
            reducedMotion={reducedMotion}
            revealed={performance.revealed}
            isFinal={isFinal}
            busy={busy}
            error={error}
            finalLabel={finalLabel}
            canRewind={performance.actIndex > 0}
            onReveal={() =>
              setPerformance((state) =>
                advanceNarrativePerformance(state, script.acts.length),
              )
            }
            onAdvance={() =>
              setPerformance((state) =>
                advanceNarrativePerformance(
                  { ...state, revealed: true },
                  script.acts.length,
                ),
              )
            }
            onRewind={() =>
              setPerformance((state) => rewindNarrativePerformance(state))
            }
            onFinish={onFinish}
            onBack={onBack}
          />
        </div>
      </div>
    </section>
  );
}

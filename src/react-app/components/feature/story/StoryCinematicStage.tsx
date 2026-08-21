import { InkButton } from '@app/components/ui';
import { useTypewriter } from '@app/lib/hooks/useTypewriter';
import { useMemo, useState } from 'react';

export interface StoryCinematicAct {
  id: string;
  eyebrow?: string;
  title?: string;
  body: string;
}

export function StoryCinematicStage({
  title,
  acts,
  visual,
  finalLabel = '继续',
  onFinish,
  onDismiss,
}: {
  title: string;
  acts: StoryCinematicAct[];
  visual: 'moon' | 'root' | 'voice';
  finalLabel?: string;
  onFinish(): void;
  onDismiss?(): void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const act = acts[Math.min(index, acts.length - 1)];
  const typewriter = useTypewriter({
    text: act.body,
    speed: visual === 'voice' ? 58 : 34,
    startDelay: visual === 'voice' ? 700 : visual === 'root' ? 380 : 260,
    enabled: !revealed,
  });
  const complete = revealed || typewriter.isComplete;
  const isFinal = index >= acts.length - 1;
  const starPositions = useMemo(
    () => [
      ['10%', '18%'], ['17%', '36%'], ['27%', '14%'], ['34%', '29%'],
      ['43%', '10%'], ['52%', '22%'], ['61%', '14%'], ['68%', '32%'],
      ['76%', '12%'], ['84%', '25%'], ['91%', '17%'], ['22%', '48%'],
      ['40%', '43%'], ['58%', '46%'], ['73%', '51%'], ['88%', '42%'],
    ],
    [],
  );

  const advance = () => {
    if (!complete) {
      typewriter.skip();
      setRevealed(true);
      return;
    }
    if (isFinal) {
      onFinish();
      return;
    }
    setIndex((current) => current + 1);
    setRevealed(false);
  };

  return (
    <section className="fixed inset-0 z-[90] isolate overflow-hidden bg-[#08100f] text-[#f5efdf]">
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_50%_25%,rgba(57,91,107,0.28),transparent_45%),linear-gradient(180deg,#071011_0%,#091110_54%,#020504_100%)]" />

      {visual === 'moon' ? (
        <>
          <div className="absolute inset-x-0 top-0 -z-20 h-[58%] overflow-hidden opacity-90">
            {starPositions.map(([left, top], starIndex) => (
              <span
                key={`${left}:${top}`}
                className="absolute block rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.45)]"
                style={{
                  left,
                  top,
                  width: starIndex % 3 === 0 ? 3 : 2,
                  height: starIndex % 3 === 0 ? 3 : 2,
                }}
              />
            ))}
            <span className="absolute top-[15%] right-[17%] h-20 w-20 rounded-full border border-white/35 bg-[#e9e4cd]/85 shadow-[0_0_50px_rgba(232,226,194,0.35)]" />
            <span className="absolute top-[31%] right-[35%] h-9 w-9 rounded-full border border-cyan-100/30 bg-[#c8d9d6]/75 shadow-[0_0_30px_rgba(172,218,216,0.25)]" />
          </div>
          <div className="absolute inset-x-0 bottom-0 -z-10 h-[56%] bg-[linear-gradient(180deg,rgba(7,15,16,0.08),rgba(0,0,0,0.86)),repeating-radial-gradient(ellipse_at_50%_0%,rgba(132,170,173,0.17)_0_1px,transparent_2px_13px)] opacity-90" />
        </>
      ) : visual === 'root' ? (
        <>
          <div className="absolute inset-x-0 top-0 -z-20 h-[27%] bg-[linear-gradient(180deg,#18231b_0%,#111b15_100%)]" />
          <div className="absolute inset-x-0 top-[27%] bottom-0 -z-20 bg-[repeating-linear-gradient(8deg,rgba(139,103,69,0.11)_0_3px,transparent_3px_18px),linear-gradient(180deg,#33291f_0%,#17130f_100%)]" />
          <div className="absolute left-1/2 top-[18%] -z-10 h-[31%] w-[3px] -translate-x-1/2 bg-[#c7b68f]/75 shadow-[0_0_12px_rgba(216,199,159,0.16)]" />
          <div className="absolute left-1/2 top-[49%] -z-10 h-[1px] w-20 -translate-x-1/2 border-t border-dashed border-[#d9b18a]/55" />
          <div className="absolute left-1/2 top-[50%] -z-10 h-[34%] w-px -translate-x-1/2 bg-transparent" />
          <div className="absolute left-1/2 top-[54%] -z-10 -translate-x-1/2 text-xs tracking-[0.28em] text-[#d5bfa7]/45">再往下，只有完整泥层</div>
        </>
      ) : (
        <>
          <div className="absolute inset-x-0 top-[35%] -z-10 h-px bg-cyan-100/10" />
          <div className="absolute left-1/2 top-[52%] -z-10 h-56 w-[46rem] -translate-x-1/2 rounded-[50%] border border-cyan-100/10 shadow-[0_0_60px_rgba(147,197,208,0.06)]" />
          <div className="absolute left-1/2 top-[54%] -z-10 h-36 w-[30rem] -translate-x-1/2 rounded-[50%] border border-cyan-100/10" />
          <div className="absolute left-1/2 top-[56%] -z-10 h-20 w-[16rem] -translate-x-1/2 rounded-[50%] border border-cyan-100/15" />
        </>
      )}

      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,7,8,0.08)_0%,rgba(3,7,8,0.22)_42%,rgba(3,7,8,0.94)_100%)]" />

      <div className="mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-8 md:px-12">
        <header className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs tracking-[0.3em] text-[#cfc4aa]">
              {act.eyebrow ?? '主线演出'}
            </p>
            <h1 className="mt-2 text-xl tracking-[0.18em] sm:text-2xl">{title}</h1>
          </div>
          {onDismiss ? (
            <InkButton onClick={onDismiss} className="text-[#ded3bd] hover:text-white">
              稍后
            </InkButton>
          ) : null}
        </header>

        <div className="mt-auto max-w-2xl pb-4 pt-36 md:pt-48">
          <div className="mb-5 flex items-center gap-2" aria-label="演出进度">
            {acts.map((entry, actIndex) => (
              <span
                key={entry.id}
                className={`block h-px transition-all ${actIndex === index ? 'w-10 bg-[#e8d6a9]' : actIndex < index ? 'w-5 bg-[#e8d6a9]/65' : 'w-5 bg-white/25'}`}
              />
            ))}
          </div>
          {act.title ? (
            <p className="text-sm tracking-[0.24em] text-[#d8cba9]">{act.title}</p>
          ) : null}
          <div className="mt-4 min-h-32 whitespace-pre-wrap text-base leading-8 text-[#f6f0e2] sm:text-lg sm:leading-9">
            {complete ? act.body : typewriter.displayedText}
            {!complete && typewriter.isRunning ? (
              <span className="ml-1 animate-pulse text-[#d8cba9]">▌</span>
            ) : null}
          </div>
          <div className="mt-6 border-t border-white/15 pt-4">
            <InkButton onClick={advance} variant="primary" className="text-[#f0c77b] hover:text-[#ffe2a4]">
              {isFinal && complete ? finalLabel : '继续'}
            </InkButton>
          </div>
        </div>
      </div>
    </section>
  );
}

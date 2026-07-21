import { NarrativePerformanceStage } from '@app/components/feature/narrative/NarrativePerformanceStage';
import { NarrativePerformanceLoading } from '@app/components/feature/narrative/NarrativePerformanceLoading';
import { useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkButton } from '@app/components/ui';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCatalog } from '@app/lib/sect/sectClient';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import type { SectCatalogEntry } from '@shared/contracts/sect';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  beginSectJoinAttempt,
  createSectJoinAttemptState,
  finishSectJoinAttempt,
} from './sectJoinAttempt';

export default function SectOnboardingPage() {
  const navigate = useNavigate();
  const { mutate } = usePlayerStateActions();
  const catalog = useSectResourceQuery('catalog', fetchSectCatalog);
  const [selected, setSelected] = useState<SectCatalogEntry>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const joinAttemptRef = useRef(createSectJoinAttemptState());

  if (catalog.error) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[#131713] px-6 text-[#f3ecdc]">
        <div className="max-w-md text-center">
          <p className="leading-8">山门云路暂被雾气遮住了。</p>
          <p className="mt-2 text-sm leading-7 text-[#d7cbb3]">
            风向未定，诸宗名牒还没有送到眼前。
          </p>
          <InkButton
            onClick={() => void catalog.retry()}
            className="mt-5 text-[#f0c77b]"
          >
            再候一阵
          </InkButton>
        </div>
      </div>
    );
  }

  if (!catalog.data) {
    return <NarrativePerformanceLoading message="诸宗山门正在云外显现……" />;
  }

  if (selected) {
    const onboarding = getSectPresentation(selected.id).onboarding;
    if (!onboarding) throw new Error(`宗门 ${selected.id} 缺少入门演出`);

    const join = async () => {
      const attempt = beginSectJoinAttempt(
        joinAttemptRef.current,
        () => crypto.randomUUID(),
      );
      joinAttemptRef.current = attempt.state;
      if (!attempt.key) return;
      setBusy(true);
      setError(undefined);
      try {
        await mutate(
          fetch(`/api/sects/${encodeURIComponent(selected.id)}/join`, {
            method: 'POST',
            headers: { 'Idempotency-Key': attempt.key },
          }),
        );
        navigate('/game/sect', { replace: true });
      } catch {
        setError('玉牒未能落印，请再试一次。');
      } finally {
        joinAttemptRef.current = finishSectJoinAttempt(joinAttemptRef.current);
        setBusy(false);
      }
    };

    return (
      <NarrativePerformanceStage
        key={selected.id}
        script={onboarding.script}
        finalLabel={`拜入${selected.name}`}
        busy={busy}
        error={error}
        onBack={() => {
          joinAttemptRef.current = createSectJoinAttemptState();
          setError(undefined);
          setSelected(undefined);
        }}
        onFinish={() => void join()}
      />
    );
  }

  return (
    <section className="min-h-[100svh] bg-[#e8e1d1] px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] text-[#241d17] sm:px-7">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="text-xs tracking-[0.3em] text-[#765e49]">尘世初行 · 山门在望</p>
          <h1 className="mt-3 text-3xl tracking-[0.16em] sm:text-4xl">诸宗候君</h1>
          <p className="mt-5 leading-8 text-[#5e5043]">
            你走出尘世第一步，前方云路分作不同方向。山门都没有催你，只把各自的钟声送到风里。先入山一观，再决定今后与谁同行。
          </p>
        </header>

        <div className="mt-9 grid gap-5 lg:grid-cols-2">
          {catalog.data.sects.map((sect) => {
            const onboarding = getSectPresentation(sect.id).onboarding;
            if (!onboarding) return null;
            return (
              <article
                key={sect.id}
                className="group relative isolate flex min-h-[28rem] overflow-hidden border border-[#2c241d]/15 bg-[#1d211d] p-6 text-[#f4eddd] shadow-[0_18px_55px_rgba(41,31,22,0.18)] sm:p-8"
              >
                <img
                  src={onboarding.script.backdrop.src}
                  alt=""
                  className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025] motion-reduce:transition-none"
                />
                <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,13,12,0.12),rgba(9,13,12,0.88)_72%,rgba(9,13,12,0.97))]" />
                <div className="mt-auto">
                  <h2 className="text-2xl tracking-[0.14em]">{sect.name}</h2>
                  <p className="mt-4 max-w-xl leading-8 text-[#e4dac5]">
                    {onboarding.summary}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#d4c19b]">
                    {onboarding.traits.map((trait) => (
                      <li key={trait}>· {trait}</li>
                    ))}
                  </ul>
                  <InkButton
                    onClick={() => setSelected(sect)}
                    variant="primary"
                    className="mt-5 text-[#f2c977] hover:text-[#ffe0a0]"
                  >
                    入山一观
                  </InkButton>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { NarrativePerformanceLoading } from '@app/components/feature/narrative/NarrativePerformanceLoading';
import { NarrativePerformanceStage } from '@app/components/feature/narrative/NarrativePerformanceStage';
import { InkButton } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import type { SectCatalogEntry } from '@shared/contracts/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { getSectLandmarkBySectId } from '@shared/lib/game/mapSystem';
import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  beginSectJoinAttempt,
  createSectJoinAttemptState,
  finishSectJoinAttempt,
} from './sectJoinAttempt';
import { resolveSectOnboardingFinish } from './sectOnboardingFlow';

interface OnboardingSectEntry extends SectCatalogEntry {
  foundationPassive: {
    name: string;
    description: string;
  };
}

export default function SectOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectId = searchParams.get('sectId') ?? '';
  const entry = searchParams.get('entry');
  const session = usePlayerSession();
  const profile = useCultivatorIdentity();
  const activeSectId = session.data?.activeCultivator?.sectId ?? null;
  const { mutate } = useResourceMutation();
  const catalog = useMemo(() => {
    const cultivator = profile.data?.cultivator;
    if (!cultivator) return undefined;
    return productionSectRuntime.registry
      .listDefinitions()
      .filter(
        (definition) =>
          productionSectRuntime.registry.require(definition.id).checkAdmission({
            playerRace: cultivator.playerRace ?? 'human',
            realm: cultivator.realm,
            stage: cultivator.realm_stage,
          }).allowed,
      )
      .map((definition): OnboardingSectEntry => {
        const foundationPassive = definition.abilities.find(
          (ability) => ability.id === definition.foundationPassiveId,
        );
        if (!foundationPassive) {
          throw new Error(`宗门 ${definition.id} 缺少根基被动定义`);
        }
        return {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          foundationPassive: {
            name: foundationPassive.baseName,
            description: foundationPassive.description,
          },
        };
      });
  }, [profile.data?.cultivator]);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<{
    sectId: string;
    message: string;
  }>();
  const joinAttemptRef = useRef(createSectJoinAttemptState());
  const joinAttemptSectIdRef = useRef(sectId);

  if (profile.error) {
    return (
      <div className="app-safe-area-page flex min-h-[100svh] items-center justify-center bg-[#131713] text-[#f3ecdc] [--app-safe-area-inline-space:1.5rem]">
        <div className="max-w-md text-center">
          <p className="leading-8">山门云路暂被雾气遮住了。</p>
          <p className="mt-2 text-sm leading-7 text-[#d7cbb3]">
            风向未定，诸宗名牒还没有送到眼前。
          </p>
          <InkButton
            onClick={() => void profile.retry()}
            className="mt-5 text-[#f0c77b]"
          >
            再候一阵
          </InkButton>
        </div>
      </div>
    );
  }

  if (!catalog) {
    return <NarrativePerformanceLoading message="诸宗山门正在云外显现……" />;
  }

  const selected: SectCatalogEntry | undefined = catalog.find(
    (sect) => sect.id === sectId,
  );
  if (!sectId) {
    return (
      <section className="min-h-[100svh] bg-[#e8e1d1] pt-[calc(env(safe-area-inset-top)+2rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] pl-[max(env(safe-area-inset-left),1rem)] text-[#241d17] sm:pr-[max(env(safe-area-inset-right),1.75rem)] sm:pl-[max(env(safe-area-inset-left),1.75rem)]">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-2xl">
            <p className="text-xs tracking-[0.3em] text-[#765e49]">
              尘世初行 · 山门在望
            </p>
            <h1 className="mt-3 text-3xl tracking-[0.16em] sm:text-4xl">
              诸宗候君
            </h1>
            <p className="mt-5 leading-8 text-[#5e5043]">
              你走出尘世第一步，前方云路分作不同方向。山门都没有催你，只把各自的钟声送到风里。先入山一观，再决定今后与谁同行。
            </p>
          </header>

          <div className="mt-9 grid gap-5 lg:grid-cols-2">
            {catalog.map((sect) => {
              const presentation = getSectPresentation(sect.id).onboarding;
              if (!presentation) return null;
              return (
                <article
                  key={sect.id}
                  className="group relative isolate flex min-h-[28rem] overflow-hidden border border-[#2c241d]/15 bg-[#1d211d] p-6 text-[#f4eddd] shadow-[0_18px_55px_rgba(41,31,22,0.18)] sm:p-8"
                >
                  <img
                    src={presentation.script.backdrop.src}
                    alt=""
                    className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025] motion-reduce:transition-none"
                  />
                  <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,13,12,0.12),rgba(9,13,12,0.88)_72%,rgba(9,13,12,0.97))]" />
                  <div className="mt-auto">
                    <h2 className="text-2xl tracking-[0.14em]">{sect.name}</h2>
                    <p className="mt-4 max-w-xl leading-8 text-[#e4dac5]">
                      {presentation.summary}
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#d4c19b]">
                      {presentation.traits.map((trait) => (
                        <li key={trait}>· {trait}</li>
                      ))}
                    </ul>
                    <div className="mt-4 border-l border-[#d4c19b]/50 pl-4">
                      <p className="text-xs tracking-[0.2em] text-[#d4c19b]">
                        宗门根基
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#f2d69c]">
                        {sect.foundationPassive.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#ded2ba]">
                        {sect.foundationPassive.description}
                      </p>
                    </div>
                    <InkButton
                      onClick={() =>
                        navigate(
                          `/game/sect/onboarding?sectId=${encodeURIComponent(sect.id)}`,
                        )
                      }
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

  if (!selected) {
    return <Navigate to="/game/sect/onboarding" replace />;
  }

  const onboarding = getSectPresentation(selected.id).onboarding;
  if (!onboarding) throw new Error(`宗门 ${selected.id} 缺少入门演出`);
  const ownSect = activeSectId === selected.id;
  const isTransferCeremony = entry === 'transfer' && ownSect;
  const finish = resolveSectOnboardingFinish(activeSectId, selected.id);
  const landmark = getSectLandmarkBySectId(selected.id);
  const worldMapHref = landmark
    ? `/game/map?intent=sect&nodeId=${encodeURIComponent(landmark.id)}`
    : '/game/map?intent=sect';

  const join = async () => {
    if (joinAttemptSectIdRef.current !== selected.id) {
      joinAttemptSectIdRef.current = selected.id;
      joinAttemptRef.current = createSectJoinAttemptState();
    }
    const attempt = beginSectJoinAttempt(joinAttemptRef.current, () =>
      crypto.randomUUID(),
    );
    joinAttemptRef.current = attempt.state;
    if (!attempt.key) return;
    setBusy(true);
    setJoinError(undefined);
    try {
      await mutate(
        fetch(`/api/sects/${encodeURIComponent(selected.id)}/join`, {
          method: 'POST',
          headers: { 'Idempotency-Key': attempt.key },
        }),
      );
      navigate('/game/sect', { replace: true });
    } catch {
      setJoinError({
        sectId: selected.id,
        message: '玉牒未能落印，请再试一次。',
      });
    } finally {
      joinAttemptRef.current = finishSectJoinAttempt(joinAttemptRef.current);
      setBusy(false);
    }
  };

  return (
    <NarrativePerformanceStage
      key={`${selected.id}:${isTransferCeremony ? 'transfer' : 'standard'}`}
      script={onboarding.script}
      finalLabel={
        isTransferCeremony
          ? `进入${selected.name}`
          : !activeSectId
            ? `拜入${selected.name}`
            : ownSect
              ? '返回宗门'
              : '返回宗门舆图'
      }
      exitLabel={isTransferCeremony ? null : undefined}
      finalExitLabel={isTransferCeremony ? null : undefined}
      finishPendingLabel={isTransferCeremony ? '正在进入宗门……' : undefined}
      busy={busy}
      error={joinError?.sectId === selected.id ? joinError.message : undefined}
      onBack={() =>
        navigate(
          isTransferCeremony
            ? '/game/sect'
            : activeSectId
              ? worldMapHref
              : '/game/sect/onboarding',
          {
            replace: true,
          },
        )
      }
      onFinish={() => {
        if (isTransferCeremony) {
          navigate('/game/sect', { replace: true });
          return;
        }
        if (finish.kind === 'join') {
          void join();
          return;
        }
        navigate(finish.href, { replace: true });
      }}
    />
  );
}

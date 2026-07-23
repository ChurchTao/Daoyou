import { NarrativePerformanceLoading } from '@app/components/feature/narrative/NarrativePerformanceLoading';
import { NarrativePerformanceStage } from '@app/components/feature/narrative/NarrativePerformanceStage';
import { useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkButton } from '@app/components/ui';
import {
  usePlayerState,
  usePlayerStateActions,
} from '@app/lib/player-state/store';
import { fetchSectCatalog } from '@app/lib/sect/sectClient';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import type { SectCatalogEntry } from '@shared/contracts/sect';
import { getSectLandmarkBySectId } from '@shared/lib/game/mapSystem';
import { useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  beginSectJoinAttempt,
  createSectJoinAttemptState,
  finishSectJoinAttempt,
} from './sectJoinAttempt';
import { resolveSectOnboardingFinish } from './sectOnboardingFlow';

export default function SectOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectId = searchParams.get('sectId') ?? '';
  const activeSectId = usePlayerState(
    (state) => state.snapshot.sect?.sectId ?? null,
  );
  const { mutate } = usePlayerStateActions();
  const catalog = useSectResourceQuery('catalog', fetchSectCatalog);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<{
    sectId: string;
    message: string;
  }>();
  const joinAttemptRef = useRef(createSectJoinAttemptState());
  const joinAttemptSectIdRef = useRef(sectId);

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

  const selected: SectCatalogEntry | undefined = catalog.data.sects.find(
    (sect) => sect.id === sectId,
  );
  if (!selected) {
    return <Navigate to="/game/map?intent=sect" replace />;
  }

  const onboarding = getSectPresentation(selected.id).onboarding;
  if (!onboarding) throw new Error(`宗门 ${selected.id} 缺少入门演出`);
  const ownSect = activeSectId === selected.id;
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
      key={selected.id}
      script={onboarding.script}
      finalLabel={
        !activeSectId
          ? `拜入${selected.name}`
          : ownSect
            ? '返回宗门'
            : '返回宗门舆图'
      }
      busy={busy}
      error={joinError?.sectId === selected.id ? joinError.message : undefined}
      onBack={() => navigate(worldMapHref, { replace: true })}
      onFinish={() => {
        if (finish.kind === 'join') {
          void join();
          return;
        }
        navigate(finish.href, { replace: true });
      }}
    />
  );
}

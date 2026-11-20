import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import { storyPerformanceContext } from '@app/lib/story/performanceContext';
import { useStory } from '@app/lib/story/useStory';
import { createTavernConversation } from '@daoyou/game-content/performance/catalog';
import { productionSectRuntime } from '@daoyou/game-rules/sect-organization/production';
import { useMemo } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { SectQueryError } from '../components/SectScene';
import { MountainGateVisit } from './MountainGateVisit';
import { SectFirstPath } from './SectFirstPath';

const entrance = '/game/sect/onboarding';

export default function SectOnboardingPage() {
  const [params] = useSearchParams();
  const entry = params.get('entry');
  if (entry === 'transfer') return <Navigate to="/game/sect" replace />;
  if (entry === 'path') return <SectFirstPath />;
  return (
    <MountainGate sectId={params.get('sectId')} storyEntry={entry === 'gate'} />
  );
}

function MountainGate({
  sectId,
  storyEntry,
}: {
  sectId: string | null;
  storyEntry: boolean;
}) {
  const navigate = useNavigate();
  const session = usePlayerSession();
  const profile = useCultivatorIdentity();
  const story = useStory();
  const cultivator = profile.data?.cultivator;
  const checkpoint = story.story;
  const chapterVisit =
    checkpoint?.chapterId === 'mountain-foothill' &&
    (checkpoint.beatId === 'visit' || checkpoint.beatId === 'join');
  const activeSectId = session.data?.activeCultivator?.sectId ?? null;
  const origin =
    storyEntry || chapterVisit ? entrance + '?entry=gate' : entrance;
  const available = useMemo(() => {
    if (!cultivator) return new Set<string>();
    return new Set(
      productionSectRuntime.registry
        .listDefinitions()
        .filter(
          (definition) =>
            productionSectRuntime.registry
              .require(definition.id)
              .checkAdmission({
                playerRace: cultivator.playerRace ?? 'human',
                realm: cultivator.realm,
                stage: cultivator.realm_stage,
              }).allowed,
        )
        .map((definition) => definition.id),
    );
  }, [cultivator]);
  const tavern = useMemo(
    () => createTavernConversation(available),
    [available],
  );

  if (profile.loading || session.loading || story.loading) {
    return <GameLoadingState variant="fullscreen" message="正在接续故事……" />;
  }
  const error = profile.error ?? session.error ?? story.error;
  if (error || !cultivator) {
    return (
      <SectQueryError
        error={error ?? '未读到当前角色。'}
        backHref="/game"
        retry={() =>
          void Promise.all([profile.retry(), session.retry(), story.reload()])
        }
      />
    );
  }

  const portrait =
    cultivator.gender === '女'
      ? 'icon:cultivator-female-avatar'
      : 'icon:cultivator-male-avatar';
  if (sectId && available.has(sectId)) {
    const selected = productionSectRuntime.registry.require(sectId).definition;
    return (
      <MountainGateVisit
        key={sectId}
        sectId={sectId}
        sectName={selected.name}
        activeSectId={activeSectId}
        portrait={portrait}
        context={storyPerformanceContext(cultivator, sectId)}
        origin={origin}
        storyEntry={storyEntry}
        checkpoint={checkpoint}
        chapterVisit={Boolean(chapterVisit)}
      />
    );
  }
  if (storyEntry && !chapterVisit)
    return <Navigate to={checkpoint?.href ?? '/game'} replace />;
  if (sectId) return <Navigate to={origin} replace />;

  return (
    <PerformancePlayer
      script={tavern}
      context={{}}
      playerPortrait={portrait}
      finalLabel="继续"
      exitLabel="稍后再问"
      onExit={() => navigate('/game')}
      onFinish={(id) => {
        if (!available.has(id)) return;
        const query = new URLSearchParams({ sectId: id });
        if (chapterVisit) query.set('entry', 'gate');
        navigate(entrance + '?' + query, { replace: true });
      }}
    />
  );
}

import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import { storyPerformanceContext } from '@app/lib/story/performanceContext';
import { useStory } from '@app/lib/story/useStory';
import {
  createMineRoadChoice,
  createTavernConversation,
  getPerformanceScript,
  MINE_ROAD_SCRIPT,
  mineRoadFlag,
} from '@daoyou/game-content/performance/catalog';
import type { StoryView } from '@daoyou/game-domain/story';
import { productionSectRuntime } from '@daoyou/game-rules/sect-organization/production';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { SectQueryError } from '../components/SectScene';
import { MountainGateMap } from './MountainGateMap';
import { MountainGateVisit } from './MountainGateVisit';
import { SectFirstPath } from './SectFirstPath';

const entrance = '/game/sect/onboarding';
const sects = productionSectRuntime.registry.listDefinitions();

export default function SectOnboardingPage() {
  const [params] = useSearchParams();
  const entry = params.get('entry');
  if (entry === 'transfer') return <Navigate to="/game/sect" replace />;
  if (entry === 'path') return <SectFirstPath />;
  return (
    <MountainGate
      sectId={params.get('sectId')}
      storyEntry={entry === 'gate'}
      fromRoad={params.get('from') === 'road'}
    />
  );
}

function MountainGate({
  sectId,
  storyEntry,
  fromRoad,
}: {
  sectId: string | null;
  storyEntry: boolean;
  fromRoad: boolean;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = usePlayerSession();
  const profile = useCultivatorIdentity();
  const story = useStory();
  const [savingRoad, setSavingRoad] = useState(false);
  const [roadError, setRoadError] = useState<string>();
  const cultivator = profile.data?.cultivator;
  const checkpoint = story.story;
  const choosingRoad = checkpoint?.scriptId === MINE_ROAD_SCRIPT;
  const mineVisit =
    checkpoint?.chapterId === 'mine-gate' &&
    (checkpoint.beatId === 'visit' || checkpoint.beatId === 'join');
  const chapterVisit =
    mineVisit ||
    (checkpoint?.chapterId === 'mountain-foothill' &&
      (checkpoint.beatId === 'visit' || checkpoint.beatId === 'join'));
  const activeSectId = session.data?.activeCultivator?.sectId ?? null;
  const origin =
    storyEntry || chapterVisit || choosingRoad
      ? entrance + '?entry=gate'
      : entrance;
  const available = useMemo(() => {
    if (!cultivator) return new Set<string>();
    return new Set(
      sects
        .filter(
          (definition) =>
            definition.id === activeSectId ||
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
  }, [activeSectId, cultivator]);

  async function saveRoad(outcome: string, chosen: string[]) {
    setSavingRoad(true);
    setRoadError(undefined);
    try {
      const next = await consumeResourceMutation<StoryView>(
        await apiFetch(
          '/api/story/performances/' + MINE_ROAD_SCRIPT + '/complete',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome, chosen }),
          },
        ),
      );
      void navigate(next.href, { replace: true });
    } catch (reason) {
      setRoadError(
        reason instanceof Error ? reason.message : '路帖还没选好，再试一次。',
      );
    } finally {
      setSavingRoad(false);
    }
  }

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

  if (
    (choosingRoad || mineVisit) &&
    checkpoint?.playHref &&
    (!storyEntry ||
      params.get('chapter') !== checkpoint.chapterId ||
      params.get('beat') !== checkpoint.beatId)
  ) {
    return <Navigate to={checkpoint.href} replace />;
  }

  const portrait =
    cultivator.gender === '女'
      ? 'icon:cultivator-female-avatar'
      : 'icon:cultivator-male-avatar';
  if (choosingRoad) {
    return (
      <PerformancePlayer
        key={MINE_ROAD_SCRIPT}
        script={getPerformanceScript(MINE_ROAD_SCRIPT)}
        context={{}}
        playerPortrait={portrait}
        finalLabel="收下路帖"
        exitLabel="稍后再看"
        busy={savingRoad}
        error={roadError}
        onExit={() => navigate(checkpoint.href, { replace: true })}
        onFinish={(outcome, chosen) => void saveRoad(outcome, chosen)}
      />
    );
  }
  const selectedId =
    sectId ??
    (mineVisit && fromRoad
      ? (sects.find(({ id }) => checkpoint.flags.includes(mineRoadFlag(id)))
          ?.id ?? activeSectId)
      : undefined);
  const selected = sects.find(({ id }) => id === selectedId);
  const visitQuery =
    mineVisit && checkpoint.playHref
      ? new URLSearchParams(checkpoint.playHref.split('?')[1])
      : undefined;
  visitQuery?.delete('from');
  const choicesHref = visitQuery ? entrance + '?' + visitQuery : origin;
  const visitHref = (id: string, play = false) => {
    const query = new URLSearchParams(visitQuery);
    query.set('sectId', id);
    if (play) query.set('view', 'arrival');
    return entrance + '?' + query;
  };
  if (selected && (mineVisit || available.has(selected.id))) {
    if (mineVisit && params.get('view') !== 'arrival') {
      return (
        <MountainGateMap
          key={selected.id}
          sectId={selected.id}
          sectName={selected.name}
          backHref={checkpoint.href}
          choicesHref={choicesHref}
          playHref={visitHref(selected.id, true)}
        />
      );
    }
    const admission = productionSectRuntime.registry
      .require(selected.id)
      .checkAdmission({
        playerRace: cultivator.playerRace ?? 'human',
        realm: cultivator.realm,
        stage: cultivator.realm_stage,
      });
    const currentSect = sects.find(({ id }) => id === activeSectId);
    const admissionBlock =
      currentSect && currentSect.id !== selected.id
        ? '你已拜入' + currentSect.name + '。回本宗山门便可核名。'
        : admission.allowed
          ? undefined
          : admission.reason;
    return (
      <MountainGateVisit
        key={selected.id}
        sectId={selected.id}
        sectName={selected.name}
        activeSectId={activeSectId}
        admissionBlock={mineVisit ? admissionBlock : undefined}
        portrait={portrait}
        context={storyPerformanceContext(cultivator, selected.id)}
        origin={mineVisit ? choicesHref : origin}
        exitHref={mineVisit ? visitHref(selected.id) : undefined}
        storyEntry={storyEntry}
        checkpoint={checkpoint}
        chapterVisit={Boolean(chapterVisit)}
      />
    );
  }
  if (storyEntry && !chapterVisit)
    return <Navigate to={checkpoint?.href ?? '/game'} replace />;
  if (sectId) return <Navigate to={mineVisit ? choicesHref : origin} replace />;

  return (
    <PerformancePlayer
      key={mineVisit ? 'mine-gate-routes' : 'mountain-tavern'}
      script={
        mineVisit
          ? createMineRoadChoice('visit')
          : createTavernConversation(available)
      }
      context={{}}
      playerPortrait={portrait}
      finalLabel="继续"
      exitLabel="稍后再问"
      onExit={() => navigate(mineVisit ? checkpoint.href : '/game')}
      onFinish={(id) => {
        if (
          mineVisit ? !sects.some((sect) => sect.id === id) : !available.has(id)
        )
          return;
        if (mineVisit) {
          navigate(visitHref(id), { replace: true });
          return;
        }
        const query = new URLSearchParams({ sectId: id });
        if (chapterVisit) query.set('entry', 'gate');
        navigate(entrance + '?' + query, { replace: true });
      }}
    />
  );
}

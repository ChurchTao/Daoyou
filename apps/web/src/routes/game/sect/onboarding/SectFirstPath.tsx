import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorIdentity,
  useSectCombatState,
} from '@app/lib/resources/player';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import {
  fillStoryScript,
  storyPerformanceContext,
} from '@app/lib/story/performanceContext';
import { useStory } from '@app/lib/story/useStory';
import { createSectFirstPath } from '@daoyou/game-content/performance/catalog';
import type { StoryView } from '@daoyou/game-domain/story';
import { storyArrivalHref } from '@daoyou/game-rules/story';
import { useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { SectQueryError } from '../components/SectScene';

const workshop = '/game/sect/enlightenment-cliff?workspace=paths';

export function SectFirstPath() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const profile = useCultivatorIdentity();
  const sect = useSectCombatState();
  const story = useStory();
  const fromStory =
    params.get('from') === 'story' || story.story?.beatId === 'path';
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const cultivator = profile.data?.cultivator;
  const build = sect.data;

  if (profile.loading || sect.loading || story.loading) {
    return <GameLoadingState variant="fullscreen" message="正在等候教习……" />;
  }
  const readError = profile.error ?? sect.error ?? story.error;
  if (readError || !cultivator) {
    return (
      <SectQueryError
        error={readError ?? '未读到当前角色。'}
        backHref="/game"
        retry={() =>
          void Promise.all([profile.retry(), sect.retry(), story.reload()])
        }
      />
    );
  }
  const checkpoint = story.story;
  if (
    fromStory &&
    checkpoint?.location &&
    (params.get('chapter') !== checkpoint.chapterId ||
      params.get('beat') !== checkpoint.beatId) &&
    !saving
  ) {
    return <Navigate to={checkpoint.href} replace />;
  }
  if (!build?.sectId) return <Navigate to="/game/sect" replace />;
  if (!build.paths.length) {
    return (
      <SectQueryError
        error="本宗的流派尚未开放。"
        backHref="/game/sect"
        retry={() => void sect.retry()}
      />
    );
  }
  function nextHref(next?: StoryView) {
    if (!fromStory) return workshop;
    return next ? storyArrivalHref(next) : '/game';
  }
  if (build.activePathId && !saving) {
    return <Navigate to={nextHref(story.story)} replace />;
  }
  const sectId = build.sectId;
  const presentation = getSectPresentation(sectId);
  const spotId =
    fromStory && checkpoint?.location?.kind === 'sect'
      ? checkpoint.location.spotId
      : undefined;
  const place =
    presentation.map.hotspots.find(({ id }) => id === spotId)?.label ??
    presentation.scenes.paths.title;
  const context = storyPerformanceContext(cultivator, sectId);
  const script = fillStoryScript(
    createSectFirstPath(
      sectId,
      place,
      build.paths,
      story.story?.chapterId === 'mine-lesson',
    ),
    context,
    sectId,
  );

  async function choose(pathId: string) {
    if (
      !build ||
      !build.paths.some((path) => path.id === pathId) ||
      busy.current
    )
      return;
    busy.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await consumeResourceMutation(
        await apiFetch('/api/combat-v6/sect/path', {
          ...mutationBody({
            activePathId: pathId,
            expectedRevision: build.revision,
          }),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const next = fromStory
        ? await combatV6Request<StoryView>('/api/story')
        : undefined;
      await navigate(nextHref(next), { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '未能启用流派，请再试一次。',
      );
      busy.current = false;
      setSaving(false);
      await sect.reload();
    }
  }

  return (
    <PerformancePlayer
      key={script.id}
      script={script}
      context={context}
      playerPortrait={
        cultivator.gender === '女'
          ? 'icon:cultivator-female-avatar'
          : 'icon:cultivator-male-avatar'
      }
      backdropStyle="wash"
      finalLabel="再试一次"
      finishPendingLabel="启用中……"
      exitLabel="晚些再选"
      onExit={() =>
        navigate(
          fromStory
            ? (story.story?.href ?? '/game')
            : '/game/sect/enlightenment-cliff',
        )
      }
      busy={saving}
      error={error}
      onFinish={(outcome) => void choose(outcome)}
    />
  );
}

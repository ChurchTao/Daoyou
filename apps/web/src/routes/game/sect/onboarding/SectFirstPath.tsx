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
    return next?.beatId === 'path' ? '/game' : (next?.href ?? '/game');
  }
  if (build.activePathId && !saving) {
    return <Navigate to={nextHref(story.story)} replace />;
  }
  const sectId = build.sectId;
  const context = storyPerformanceContext(cultivator, sectId);
  const script = fillStoryScript(
    createSectFirstPath(
      sectId,
      getSectPresentation(sectId).scenes.paths.title,
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
      navigate(nextHref(next), { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '未能启用流派，请再试一次。',
      );
      await sect.reload();
    } finally {
      busy.current = false;
      setSaving(false);
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
        navigate(fromStory ? '/game' : '/game/sect/enlightenment-cliff')
      }
      busy={saving}
      error={error}
      onFinish={(outcome) => void choose(outcome)}
    />
  );
}

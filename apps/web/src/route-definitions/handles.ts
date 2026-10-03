import { getGameSceneMeta } from '@app/components/game-shell/gameNavigation';
import {
  resolveSectVisitTitle,
  type AppRouteHandle,
  type GameSceneHandle,
  type RouteTitleResolver,
} from '@app/lib/router/routeTitle';

export const title = (value: RouteTitleResolver): AppRouteHandle => ({
  title: value,
});
export const scene = (
  sceneHandle: Pick<GameSceneHandle, 'id'> &
    Partial<
      Pick<GameSceneHandle, 'chrome' | 'dock' | 'presentation' | 'summary'>
    >,
  value: RouteTitleResolver,
): AppRouteHandle => {
  const chrome = sceneHandle.chrome ?? 'standard';
  const meta = getGameSceneMeta(sceneHandle.id);

  if (!meta) {
    throw new Error(`Missing game scene metadata for "${sceneHandle.id}"`);
  }

  return {
    title: value,
    gameScene: {
      id: meta.id,
      label: meta.label,
      group: meta.group,
      chrome,
      dock: sceneHandle.dock ?? 'core',
      presentation:
        sceneHandle.presentation ??
        (chrome === 'immersive' ? 'immersive' : 'workflow'),
      summary: sceneHandle.summary ?? null,
    },
  };
};

export const sectVisitTitle: RouteTitleResolver = ({ params }) => {
  return resolveSectVisitTitle(params.sectId);
};

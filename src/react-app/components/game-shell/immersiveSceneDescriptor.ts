import type { GameSceneDockMode } from '@app/lib/router/routeTitle';

export type ImmersiveHudVariant = 'immersive';

export type ImmersiveBackActionDescriptor =
  | {
      type: 'path';
      label: string;
      href: string;
    }
  | {
      type: 'history-or-path';
      label: string;
      fallbackHref: string;
    };

export interface ImmersiveSceneDescriptor {
  sceneLabel: string;
  dockMode: GameSceneDockMode;
  hudVariant: ImmersiveHudVariant;
  backAction: ImmersiveBackActionDescriptor;
}

export type DungeonImmersiveSceneState =
  | 'map_selection'
  | 'exploring'
  | 'in_battle'
  | 'looting'
  | 'settlement';

const dungeonSceneDefaults: Record<
  DungeonImmersiveSceneState,
  ImmersiveSceneDescriptor
> = {
  map_selection: {
    sceneLabel: '云游探秘',
    dockMode: 'core',
    hudVariant: 'immersive',
    backAction: {
      type: 'path',
      label: '返回洞府',
      href: '/game',
    },
  },
  exploring: {
    sceneLabel: '云游探秘',
    dockMode: 'hidden',
    hudVariant: 'immersive',
    backAction: {
      type: 'path',
      label: '离开历练',
      href: '/game',
    },
  },
  in_battle: {
    sceneLabel: '云游探秘',
    dockMode: 'hidden',
    hudVariant: 'immersive',
    backAction: {
      type: 'path',
      label: '离开历练',
      href: '/game',
    },
  },
  looting: {
    sceneLabel: '云游探秘',
    dockMode: 'core',
    hudVariant: 'immersive',
    backAction: {
      type: 'path',
      label: '结束历练',
      href: '/game',
    },
  },
  settlement: {
    sceneLabel: '云游探秘',
    dockMode: 'core',
    hudVariant: 'immersive',
    backAction: {
      type: 'path',
      label: '返回洞府',
      href: '/game',
    },
  },
};

export function resolveDungeonImmersiveSceneDescriptor(
  state: DungeonImmersiveSceneState,
) {
  return dungeonSceneDefaults[state];
}

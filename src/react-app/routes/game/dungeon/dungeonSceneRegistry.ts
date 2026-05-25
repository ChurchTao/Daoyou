export type DungeonSceneDensity = 'card' | 'wide' | 'full' | 'centered';

type DungeonSceneBackAction = {
  label: string;
  href: string;
};

export interface DungeonSceneDescriptor {
  sceneLabel: string;
  subtitle?: string;
  backAction: DungeonSceneBackAction;
  density: DungeonSceneDensity;
  loadingMessage: string;
}

export type DungeonSceneState =
  | 'loading'
  | 'not_authenticated'
  | 'map_selection'
  | 'exploring'
  | 'battle_preparation'
  | 'in_battle'
  | 'looting'
  | 'settlement';

const dungeonSceneDescriptors: Record<
  DungeonSceneState,
  DungeonSceneDescriptor
> = {
  loading: {
    sceneLabel: '云游探秘',
    subtitle: '天机混沌，正在重整历练轨迹。',
    backAction: {
      label: '返回洞府',
      href: '/game',
    },
    density: 'centered',
    loadingMessage: '天机混沌，正在解析……',
  },
  not_authenticated: {
    sceneLabel: '云游探秘',
    subtitle: '此处机缘需真身在场方可接引。',
    backAction: {
      label: '返回洞府',
      href: '/game',
    },
    density: 'centered',
    loadingMessage: '请先凝聚真身。',
  },
  map_selection: {
    sceneLabel: '云游探秘',
    subtitle: '择一处秘境，定此行的起点与气数。',
    backAction: {
      label: '返回洞府',
      href: '/game',
    },
    density: 'wide',
    loadingMessage: '正在搜寻可入秘境……',
  },
  exploring: {
    sceneLabel: '历练途中',
    subtitle: '前路气机骤变，每一步都在改变结局。',
    backAction: {
      label: '返回洞府',
      href: '/game',
    },
    density: 'card',
    loadingMessage: '正在推演下一回合……',
  },
  battle_preparation: {
    sceneLabel: '遭遇战',
    subtitle: '敌息逼近，先辨虚实，再决生死。',
    backAction: {
      label: '结束历练',
      href: '/game',
    },
    density: 'card',
    loadingMessage: '正在探查敌手……',
  },
  in_battle: {
    sceneLabel: '副本战斗',
    subtitle: '此战胜负，直接改写此行所获。',
    backAction: {
      label: '结束历练',
      href: '/game',
    },
    density: 'full',
    loadingMessage: '战局演算中……',
  },
  looting: {
    sceneLabel: '战后休整',
    subtitle: '余波未散，决定是继续深入，还是及时收手。',
    backAction: {
      label: '返回洞府',
      href: '/game',
    },
    density: 'card',
    loadingMessage: '正在整理战后余波……',
  },
  settlement: {
    sceneLabel: '探索结束',
    subtitle: '尘埃落定，此行所得已可回带洞府。',
    backAction: {
      label: '返回洞府',
      href: '/game',
    },
    density: 'wide',
    loadingMessage: '正在清点机缘……',
  },
};

export const defaultDungeonSceneDescriptor =
  dungeonSceneDescriptors.map_selection;

const DUNGEON_SCENE_TOP_OFFSET_FALLBACK =
  'calc(env(safe-area-inset-top) + 5rem)';

export const DUNGEON_SCENE_CONTENT_TOP_GAP = `calc(var(--dungeon-scene-top-offset, ${DUNGEON_SCENE_TOP_OFFSET_FALLBACK}) + 0.75rem)`;
export const DUNGEON_SCENE_CONTENT_BOTTOM_GAP =
  'calc(env(safe-area-inset-bottom) + 2.5rem)';

export function resolveDungeonSceneDescriptor(state: DungeonSceneState) {
  return dungeonSceneDescriptors[state];
}

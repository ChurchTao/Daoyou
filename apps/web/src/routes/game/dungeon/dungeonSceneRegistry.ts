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
  /** 不显示顶部返回条：剧本进行中由页面自己的状态栏提供返回与结束。 */
  hideChrome?: boolean;
  /** 不显示场景标题：页面自己的切换器就是身份。 */
  hideTitle?: boolean;
  /** 标题左侧的题图（emoji），与标题同高，作为本页的印记。 */
  icon?: string;
}

export type DungeonSceneState =
  | 'loading'
  | 'not_authenticated'
  | 'map_selection'
  | 'exploring'
  | 'battle_preparation'
  | 'in_battle'
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
    sceneLabel: '云游',
    hideTitle: true,
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
      label: '返回洞府',
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

const DUNGEON_SCENE_TOP_OFFSET_FALLBACK = 'calc(var(--app-safe-top) + 3.5rem)';

export const DUNGEON_SCENE_CONTENT_TOP_GAP = `calc(var(--dungeon-scene-top-offset, ${DUNGEON_SCENE_TOP_OFFSET_FALLBACK}) + 0.5rem)`;
export const DUNGEON_SCENE_CONTENT_BOTTOM_GAP =
  'calc(env(safe-area-inset-bottom) + 2.5rem)';

export function resolveDungeonSceneDescriptor(state: DungeonSceneState) {
  return dungeonSceneDescriptors[state];
}

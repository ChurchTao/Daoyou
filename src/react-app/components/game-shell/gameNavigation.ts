import type { GameSceneGroup } from '@app/lib/router/routeTitle';

export interface GameSceneNavItem {
  id: string;
  sceneLabel: string;
  href?: string;
  coreDockLabel?: string;
  expandedDockLabel?: string;
}

export interface GameNavGroup {
  key: GameSceneGroup;
  title: string;
  scenes: GameSceneNavItem[];
}

export interface GameSceneMeta {
  id: string;
  label: string;
  group: GameSceneGroup;
}

export interface GameDockLink {
  id: string;
  label: string;
  href: string;
}

export interface GameDockGroupLinks {
  key: GameSceneGroup;
  title: string;
  actions: GameDockLink[];
}

const coreDockSceneOrder = ['cultivator', 'inventory', 'cave', 'mail'] as const;

export const gameDockGroups: GameNavGroup[] = [
  {
    key: 'cultivation',
    title: '修行',
    scenes: [
      {
        id: 'cave',
        sceneLabel: '洞府',
        href: '/game',
        coreDockLabel: '洞府',
      },
      {
        id: 'cultivator',
        sceneLabel: '道身',
        href: '/game/cultivator',
        coreDockLabel: '角色',
      },
      {
        id: 'cultivator-attributes',
        sceneLabel: '根基属性',
      },
      {
        id: 'body-cultivation',
        sceneLabel: '肉身炼体',
      },
      {
        id: 'retreat',
        sceneLabel: '修炼室',
        href: '/game/retreat',
      },
      {
        id: 'inn',
        sceneLabel: '灵眼之泉',
        href: '/game/inn',
      },
      {
        id: 'enlightenment',
        sceneLabel: '悟道室',
        href: '/game/enlightenment',
      },
      {
        id: 'techniques',
        sceneLabel: '所修功法',
        href: '/game/techniques',
        expandedDockLabel: '📘 所修功法',
      },
      {
        id: 'skills',
        sceneLabel: '所修神通',
        href: '/game/skills',
        expandedDockLabel: '📖 所修神通',
      },
      {
        id: 'training-room',
        sceneLabel: '练功房',
        href: '/game/training-room',
      },
      {
        id: 'inventory',
        sceneLabel: '储物袋',
        href: '/game/inventory',
        coreDockLabel: '储物袋',
      },
      {
        id: 'battle-history',
        sceneLabel: '全部战绩',
        href: '/game/battle/history',
        expandedDockLabel: '⚔️ 全部战绩',
      },
      {
        id: 'dungeon-history',
        sceneLabel: '探险札记',
        href: '/game/dungeon/history',
        expandedDockLabel: '🗂️ 探险札记',
      },
      {
        id: 'gongfa-enlightenment',
        sceneLabel: '功法参悟',
      },
      {
        id: 'enlightenment-replace',
        sceneLabel: '参悟抉择',
      },
      {
        id: 'skill-enlightenment',
        sceneLabel: '神通推演',
      },
    ],
  },
  {
    key: 'craft',
    title: '造化',
    scenes: [
      {
        id: 'dungeon',
        sceneLabel: '云游探秘',
        href: '/game/dungeon',
        expandedDockLabel: '🏔️ 云游探秘',
      },
      {
        id: 'tower',
        sceneLabel: '蜃楼幻境',
        href: '/game/tower',
        expandedDockLabel: '🪞 蜃楼幻境',
      },
      {
        id: 'craft',
        sceneLabel: '造物仙炉',
        href: '/game/craft',
      },
      {
        id: 'fate-reshape',
        sceneLabel: '重塑命格',
        href: '/game/fate-reshape',
        expandedDockLabel: '🔮 重塑命格',
      },
      {
        id: 'tasks',
        sceneLabel: '任务中心',
        href: '/game/tasks',
        expandedDockLabel: '📜 任务中心',
      },
      {
        id: 'manual-draw',
        sceneLabel: '悟道演法',
        href: '/game/enlightenment/manual-draw',
      },
      {
        id: 'alchemy',
        sceneLabel: '炼丹房',
      },
      {
        id: 'refine',
        sceneLabel: '炼器室',
      },
      {
        id: 'map',
        sceneLabel: '修仙界地图',
      },
    ],
  },
  {
    key: 'trade',
    title: '交易',
    scenes: [
      {
        id: 'market',
        sceneLabel: '修仙坊市',
        href: '/game/map?intent=market',
        expandedDockLabel: '🛖 修仙坊市',
      },
      {
        id: 'market-recycle',
        sceneLabel: '坊市鉴宝',
        href: '/game/market/recycle',
        expandedDockLabel: '🧾 坊市鉴宝',
      },
      {
        id: 'tianjiao-vault',
        sceneLabel: '天骄宝阁',
        href: '/game/tianjiao-vault',
        expandedDockLabel: '🏵️ 天骄宝阁',
      },
      {
        id: 'auction',
        sceneLabel: '拍卖行',
        href: '/game/auction',
        expandedDockLabel: '🔨 拍卖行',
      },
    ],
  },
  {
    key: 'message',
    title: '见闻',
    scenes: [
      {
        id: 'mail',
        sceneLabel: '传音玉简',
        href: '/game/mail',
        coreDockLabel: '传音玉简',
      },
      {
        id: 'world-chat',
        sceneLabel: '世界传音',
        href: '/game/world-chat',
        expandedDockLabel: '💬 世界传音',
      },
    ],
  },
  {
    key: 'combat',
    title: '争锋',
    scenes: [
      {
        id: 'rankings',
        sceneLabel: '天骄榜',
        href: '/game/rankings',
        expandedDockLabel: '🏆 天骄榜',
      },
      {
        id: 'bet-battle',
        sceneLabel: '赌战台',
        href: '/game/bet-battle',
        expandedDockLabel: '⚔️ 赌战台',
      },
      {
        id: 'battle',
        sceneLabel: '对战播报',
      },
      {
        id: 'battle-challenge',
        sceneLabel: '挑战天骄',
      },
      {
        id: 'battle-replay',
        sceneLabel: '战斗回放',
      },
      {
        id: 'tower-battle',
        sceneLabel: '蜃楼战局',
      },
      {
        id: 'task-challenge',
        sceneLabel: '破境试炼',
      },
      {
        id: 'bet-battle-challenge',
        sceneLabel: '赌战挑战',
      },
    ],
  },
  {
    key: 'service',
    title: '玩家服务',
    scenes: [
      {
        id: 'redeem',
        sceneLabel: '兑换码',
        href: '/game/redeem',
        expandedDockLabel: '🎁 兑换码',
      },
      {
        id: 'community',
        sceneLabel: '玩家交流群',
        href: '/game/community',
        expandedDockLabel: '👥 玩家交流群',
      },
      {
        id: 'feedback',
        sceneLabel: '意见反馈',
        href: '/game/settings/feedback',
        expandedDockLabel: '📝 意见反馈',
      },
      {
        id: 'settings',
        sceneLabel: '系统设置',
        href: '/game/settings',
        expandedDockLabel: '⚙️ 系统设置',
      },
    ],
  },
];

const gameSceneRegistry = gameDockGroups.flatMap((group) =>
  group.scenes.map((scene) => ({
    ...scene,
    group: group.key,
    groupTitle: group.title,
  })),
);

const gameSceneMetaById = new Map(
  gameSceneRegistry.map((scene) => [
    scene.id,
    {
      id: scene.id,
      label: scene.sceneLabel,
      group: scene.group,
    } satisfies GameSceneMeta,
  ]),
);

const gameSceneRegistryById = new Map(
  gameSceneRegistry.map((scene) => [scene.id, scene]),
);

const gameSceneGroupTitleByKey = new Map(
  gameDockGroups.map((group) => [group.key, group.title] as const),
);

function requireGameSceneRegistryItem(id: string) {
  const scene = gameSceneRegistryById.get(id);

  if (!scene) {
    throw new Error(`Missing game scene registry item for "${id}"`);
  }

  return scene;
}

export function getGameSceneMeta(id: string) {
  return gameSceneMetaById.get(id) ?? null;
}

export function getGameSceneGroupTitle(group: GameSceneGroup) {
  return gameSceneGroupTitleByKey.get(group) ?? null;
}

export function getCoreDockItems(): GameDockLink[] {
  return coreDockSceneOrder.map((id) => {
    const scene = requireGameSceneRegistryItem(id);

    if (!scene.href || !scene.coreDockLabel) {
      throw new Error(`Core dock scene "${id}" is missing href or label`);
    }

    return {
      id: scene.id,
      label: scene.coreDockLabel,
      href: scene.href,
    };
  });
}

export function getExpandedDockGroups(): GameDockGroupLinks[] {
  return gameDockGroups
    .map((group) => ({
      key: group.key,
      title: group.title,
      actions: group.scenes.flatMap((scene) => {
        if (!scene.href || !scene.expandedDockLabel) {
          return [];
        }

        return [
          {
            id: scene.id,
            label: scene.expandedDockLabel,
            href: scene.href,
          },
        ];
      }),
    }))
    .filter((group) => group.actions.length > 0);
}

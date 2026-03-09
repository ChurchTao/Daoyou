export type Screenshot = {
  url: string;
  alt: string;
  category?: string;
  description?: string;
};

export type ScreenshotGroup = {
  title: string;
  id: string;
  icon?: string;
  screenshots: Screenshot[];
};

export const screenshots = [
  {
    title: '游戏主界面',
    id: 'main-interface',
    icon: '🏯',
    screenshots: [
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_18-45-05.png',
        alt: '游戏主界面',
        category: 'main-interface',
        description: '修仙者的洞府，显示角色信息、修炼状态和快捷操作入口。',
      },
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_18-50-45.png',
        alt: '游戏主界面下方',
        category: 'main-interface',
        description: '主要功能区域，包括修炼、闭关、云游等核心玩法入口。',
      },
    ],
  },
  {
    title: '游戏官方网站',
    id: 'official-site',
    icon: '📜',
    screenshots: [
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_18-42-46.png',
        alt: '游戏官方网站',
        category: 'official-site',
        description: '万界道友官方网站首页，水墨风格设计。',
      },
    ],
  },
  {
    title: '创造系统',
    id: 'creation',
    icon: '⚗️',
    screenshots: [
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_19-01-06.png',
        alt: '造物仙炉 炼器、炼丹',
        category: 'creation',
        description: '造物仙炉，可炼制法宝灵器与丹药，提升修仙实力。',
      },
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_19-01-32.png',
        alt: '藏经阁 创造功法、神通',
        category: 'creation',
        description: '藏经阁，研读古籍，创造属于你自己的功法与神通。',
      },
    ],
  },
  {
    title: '云游坊市',
    id: 'market',
    icon: '🏪',
    screenshots: [
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_19-02-21.png',
        alt: '云游坊市 随机市场',
        category: 'market',
        description: '云游坊市，随机刷新的神秘市场，偶遇奇珍异宝。',
      },
    ],
  },
  {
    title: '所修神通',
    id: 'skills',
    icon: '✨',
    screenshots: [
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_18-52-36.png',
        alt: '所修神通',
        category: 'skills',
        description: '已修习的神通列表，每个神通都有独特的效果与威力。',
      },
    ],
  },
  {
    title: '副本选择',
    id: 'dungeon',
    icon: '⚔️',
    screenshots: [
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_19-03-33.png',
        alt: '副本选择页',
        category: 'dungeon',
        description: '选择秘境副本，挑战强敌，获取珍稀奖励。',
      },
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_19-03-00.png',
        alt: '修仙界大地图',
        category: 'dungeon',
        description: '广袤的修仙界地图，探索未知的秘境与奇遇。',
      },
    ],
  },
  {
    title: '储物袋',
    id: 'inventory',
    icon: '👝',
    screenshots: [
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_18-51-54.png',
        alt: '储物袋',
        category: 'inventory',
        description: '储物袋界面，存放法宝、灵器、丹药等物品。',
      },
      {
        url: 'https://page-r2.daoyou.org/index/Xnip2026-02-02_18-51-25.png',
        alt: '道具展示',
        category: 'inventory',
        description: '物品详情展示，查看道具属性与效果。',
      },
    ],
  },
];

export const screenshotCategories = [
  { id: 'all', label: '全部', icon: '🌟' },
  { id: 'main-interface', label: '主界面', icon: '🏯' },
  { id: 'creation', label: '创造', icon: '⚗️' },
  { id: 'market', label: '云游', icon: '🏪' },
  { id: 'dungeon', label: '副本', icon: '⚔️' },
  { id: 'inventory', label: '法宝', icon: '👝' },
  { id: 'skills', label: '神通', icon: '✨' },
  { id: 'official-site', label: '官网', icon: '📜' },
];

export type ScreenshotCategory = (typeof screenshotCategories)[number];

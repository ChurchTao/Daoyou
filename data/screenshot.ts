// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c89e2e5c7.webp // 道具展示
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a227b8e.webp // 储物袋
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a24f22a.webp // 游戏主界面
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a5e47d5.webp // 游戏官方网站
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a5b175b.webp // 游戏主界面 下方
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c999ec03a.webp // 造物仙炉 炼器、炼丹
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a4ba0b.webp // 藏经阁 创造功法、神通
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a173b4.webp // 修仙界大地图
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a80520.webp // 云游坊市 随机市场
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a9e0d6.webp // 所修神通
// https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981ca32c8604.webp // 副本选择页

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
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a24f22a.webp',
        alt: '游戏主界面',
        category: 'main-interface',
        description: '修仙者的洞府，显示角色信息、修炼状态和快捷操作入口。',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a5b175b.webp',
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
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a5e47d5.webp',
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
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c999ec03a.webp',
        alt: '造物仙炉 炼器、炼丹',
        category: 'creation',
        description: '造物仙炉，可炼制法宝灵器与丹药，提升修仙实力。',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a4ba0b.webp',
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
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a80520.webp',
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
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a9e0d6.webp',
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
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981ca32c8604.webp',
        alt: '副本选择页',
        category: 'dungeon',
        description: '选择秘境副本，挑战强敌，获取珍稀奖励。',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a173b4.webp',
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
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a227b8e.webp',
        alt: '储物袋',
        category: 'inventory',
        description: '储物袋界面，存放法宝、灵器、丹药等物品。',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c89e2e5c7.webp',
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

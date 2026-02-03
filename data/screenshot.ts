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
};

export type ScreenshotGroup = {
  title: string;
  screenshots: Screenshot[];
};

export const screenshots = [
  {
    title: '游戏主界面',
    screenshots: [
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a24f22a.webp',
        alt: '游戏主界面',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a5b175b.webp',
        alt: '游戏主界面下方',
      },
    ],
  },
  {
    title: '游戏官方网站',
    screenshots: [
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a5e47d5.webp',
        alt: '游戏官方网站',
      },
    ],
  },
  {
    title: '创造系统',
    screenshots: [
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c999ec03a.webp',
        alt: '造物仙炉 炼器、炼丹',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a4ba0b.webp',
        alt: '藏经阁 创造功法、神通',
      },
    ],
  },
  {
    title: '云游坊市 随机市场',
    screenshots: [
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a80520.webp',
        alt: '云游坊市 随机市场',
      },
    ],
  },
  {
    title: '所修神通',
    screenshots: [
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a9e0d6.webp',
        alt: '所修神通',
      },
    ],
  },
  {
    title: '副本选择页',
    screenshots: [
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981ca32c8604.webp',
        alt: '副本选择页',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c99a173b4.webp',
        alt: '修仙界大地图',
      },
    ],
  },
  {
    title: '储物袋',
    screenshots: [
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c8a227b8e.webp',
        alt: '储物袋',
      },
      {
        url: 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/03/6981c89e2e5c7.webp',
        alt: '道具展示',
      },
    ],
  },
];

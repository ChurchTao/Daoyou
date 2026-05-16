export interface GameNavItem {
  label: string;
  href: string;
}

export interface GameNavGroup {
  key: string;
  title: string;
  actions: GameNavItem[];
}

export const gameDockGroups: GameNavGroup[] = [
  {
    key: 'cultivation',
    title: '修行',
    actions: [
      { label: '🧘 洞府修行', href: '/game/retreat' },
      { label: '📚 藏经阁', href: '/game/enlightenment' },
      { label: '🪄 问法寻卷', href: '/game/enlightenment/manual-draw' },
      { label: '🔮 重塑命格', href: '/game/fate-reshape' },
      { label: '📘 所修功法', href: '/game/techniques' },
      { label: '📖 所修神通', href: '/game/skills' },
    ],
  },
  {
    key: 'craft',
    title: '造化',
    actions: [
      { label: '⚗️ 造物仙炉', href: '/game/craft' },
      { label: '🔥 炼器室', href: '/game/craft/refine' },
      { label: '🧪 炼丹房', href: '/game/craft/alchemy' },
      { label: '🛡️ 所炼法宝', href: '/game/artifacts' },
    ],
  },
  {
    key: 'trade',
    title: '交易',
    actions: [
      { label: '🛖 修仙坊市', href: '/game/map?intent=market' },
      { label: '📦 储物袋', href: '/game/inventory' },
      { label: '🧾 坊市鉴宝', href: '/game/market/recycle' },
      { label: '🔨 拍卖行', href: '/game/auction' },
    ],
  },
  {
    key: 'travel',
    title: '行路',
    actions: [
      { label: '🏆 天骄榜', href: '/game/rankings' },
      { label: '🏔️ 云游探秘', href: '/game/dungeon' },
      { label: '⚔️ 练功房', href: '/game/training-room' },
      { label: '⚔️ 赌战台', href: '/game/bet-battle' },
    ],
  },
  {
    key: 'service',
    title: '见闻',
    actions: [
      { label: '📜 传音玉简', href: '/game/mail' },
      { label: '💬 世界传音', href: '/game/world-chat' },
      { label: '🎁 兑换码', href: '/game/redeem' },
      { label: '👥 玩家交流群', href: '/game/community' },
      { label: '🗡️ 全部战绩', href: '/game/battle/history' },
      { label: '🗂️ 探险札记', href: '/game/dungeon/history' },
      { label: '📝 意见反馈', href: '/game/settings/feedback' },
    ],
  },
];

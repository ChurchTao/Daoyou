export interface AdminNavItem {
  title: string;
  description: string;
  href: string;
}

export const adminNavItems: AdminNavItem[] = [
  {
    title: '总览',
    description: '后台入口与能力地图',
    href: '/admin',
  },
  {
    title: '用户反馈',
    description: '查看和管理用户反馈',
    href: '/admin/feedback',
  },
  {
    title: '邮箱群发',
    description: '面向已验证邮箱用户',
    href: '/admin/broadcast/email',
  },
  {
    title: '游戏邮件',
    description: '公告与奖励批量发放',
    href: '/admin/broadcast/game-mail',
  },
  {
    title: '游戏公告',
    description: '认证页横幅公告配置',
    href: '/admin/announcement',
  },
  {
    title: '道具库',
    description: '可引用与发放的道具库',
    href: '/admin/item-library',
  },
  {
    title: '声望商店管理',
    description: '配置天骄宝阁兑换商品',
    href: '/admin/reputation-shop',
  },
  {
    title: '模板中心',
    description: '运营文案模板管理',
    href: '/admin/templates',
  },
  {
    title: '兑换码管理',
    description: '活动兑换码创建与停用',
    href: '/admin/redeem-codes',
  },
  {
    title: 'LLM 观测',
    description: '查看场景体积、usage 与缓存迹象',
    href: '/admin/llm-metrics',
  },
  {
    title: '对战模拟器',
    description: '验证角色对战与数值样本',
    href: '/admin/battle-simulator',
  },
  {
    title: '蜃楼敌人',
    description: '按周查看与手动生成敌人',
    href: '/admin/tower-enemy-sets',
  },
  {
    title: 'QQ交流群',
    description: '玩家社群 QQ 群号配置',
    href: '/admin/community-group',
  },
];

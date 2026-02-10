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
    title: '模板中心',
    description: '运营文案模板管理',
    href: '/admin/templates',
  },
];

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
    title: '账号管理',
    description: '查询账号与改绑登录邮箱',
    href: '/admin/accounts',
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
    title: '宗门宝库管理',
    description: '配置宗门贡献兑换商品',
    href: '/admin/sect-shop',
  },
  {
    title: '兑换码管理',
    description: '活动兑换码创建与停用',
    href: '/admin/redeem-codes',
  },
  {
    title: '功德簿管理',
    description: '爱发电映射、订单与认领处理',
    href: '/admin/sponsorship',
  },
  {
    title: 'LLM 观测',
    description: '查看场景体积、usage 与缓存迹象',
    href: '/admin/llm-metrics',
  },
  {
    title: '在线人数',
    description: '查看实时在线与峰值',
    href: '/admin/online-users',
  },
  {
    title: '蜃楼敌人',
    description: '查看每周阵容、机制与战斗属性',
    href: '/admin/tower-enemy-sets',
  },
  {
    title: 'QQ交流群',
    description: '玩家社群 QQ 群号配置',
    href: '/admin/community-group',
  },
];

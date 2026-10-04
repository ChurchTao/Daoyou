import type { RealmType } from '@daoyou/constants/realms';


// ===== 灵石产出相关 =====

// 境界历练收益基数（每小时）
export const REALM_YIELD_RATES: Record<RealmType, number> = {
  炼气: 100,
  筑基: 200,
  金丹: 400,
  元婴: 800,
  化神: 1600,
  炼虚: 3200,
  合体: 4800,
  大乘: 6400,
  渡劫: 12800,
};


// 排行榜每周结算奖励（声望）
export const RANKING_REWARDS = {
  1: 100,
  '2-10': 50,
  '11-50': 25,
  '51-100': 15,
};

/** 元婴后期人物等级75，心法上限85；60级保留培养空间。 */
export const MENTORSHIP_CONFIG = {
  mentorMinimumRealm: '化神',
  apprenticeMaximumRealmExclusive: '元婴',
  mentorSeats: 2,
  requestLifetimeDays: 7,
  maxRequestsPerDay: 10,
  maxPendingRequests: 5,
  graduationRealm: '元婴',
  graduationStage: '后期',
  manualRealm: '元婴',
  manualLevel: 6,
  sectMethodCount: 3,
  sectMethodLevel: 60,
  // 玉髓软上限22、金身软上限30，要求两轨形成稳定基础。
  bodyTrackCount: 2,
  bodyTrackLevel: 20,
  mentorReputationReward: 300,
  discipleReputationReward: 100,
} as const;

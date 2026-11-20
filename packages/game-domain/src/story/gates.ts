/**
 * 入口开放的总表：每个场景归哪道门管。
 * 新手期主线一幕幕把门打开（章节数据里的 unlocks 写的就是门的编号）；
 * 表里没有的场景从头就开着。页面、导航和服务端都只认这一张表。
 */
export const STORY_SCENE_GATES: Readonly<Record<string, string>> = {
  // 洞府
  inn: 'inn',
  retreat: 'retreat',
  'body-cultivation': 'retreat',
  'marrow-wash': 'retreat',
  divination: 'divination',
  storage: 'storage',
  'legacy-storage': 'storage',
  'spirit-field': 'spirit-field',
  enlightenment: 'enlightenment',
  'manual-codex': 'enlightenment',
  'gongfa-enlightenment': 'enlightenment',
  inscriptions: 'inscriptions',
  'cultivator-attributes': 'cultivator-attributes',
  'training-room': 'training-room',
  alchemy: 'alchemy',
  refine: 'refine',
  'equipment-codex': 'refine',
  // 灵兽
  beasts: 'beasts',
  'beast-room': 'beast-room',
  'beast-warehouse': 'beast-warehouse',
  'beast-fusion': 'beast-fusion',
  'beast-codex': 'beast-codex',
  // 宗门
  sect: 'sect',
  'sect-onboarding': 'sect',
  'sect-hall': 'sect',
  'sect-affairs': 'sect',
  'sect-archive': 'sect',
  'sect-enlightenment-cliff': 'sect',
  'sect-treasury': 'sect',
  'sect-industries': 'sect',
  'sect-cultivation-room': 'sect',
  'sect-alchemy': 'sect',
  'sect-refinery': 'sect',
  'sect-spirit-vein': 'sect',
  'sect-herb-garden': 'sect',
  'sect-cave': 'sect',
  'sect-gate': 'sect',
  'sect-gate-sweep': 'sect',
  'sect-spirit-vein-mining': 'sect',
  'sect-task-battle': 'sect',
  'sect-methods': 'sect-methods',
  'sect-abilities': 'sect-methods',
  'sect-transfer': 'sect-transfer',
  'sect-visit': 'sect-transfer',
  'sect-foreign-gate': 'sect-transfer',
  // 山下
  map: 'map',
  wild: 'map',
  dungeon: 'dungeon',
  'dungeon-history': 'dungeon-history',
  'dungeon-history-detail': 'dungeon-history',
  tower: 'tower',
  'tower-battle': 'tower',
  inquiry: 'inquiry',
  hunt: 'hunt-team',
  'hunt-team': 'hunt-team',
  market: 'market',
  'black-market': 'market',
  'market-recycle': 'market-recycle',
  'tianjiao-vault': 'tianjiao-vault',
  auction: 'auction',
  // 往来
  'world-chat': 'world-chat',
  journal: 'journal',
  rankings: 'rankings',
  'arena-sparring': 'rankings',
  'battle-history': 'rankings',
  'battle-challenge': 'rankings',
  'battle-replay': 'rankings',
  // 杂项
  download: 'download',
  redeem: 'redeem',
  'merit-ledger': 'merit-ledger',
  community: 'community',
  feedback: 'feedback',
  settings: 'settings',
  'identity-reshape': 'identity-reshape',
  'fate-reshape': 'identity-reshape',
};

/** 不对应哪个页面、但同样由主线打开的东西。 */
export const STORY_EXTRA_GATES = ['yield'] as const;

const gates = new Set<string>([
  ...Object.values(STORY_SCENE_GATES),
  ...STORY_EXTRA_GATES,
]);

/** 章节数据里写的门编号认不认得。 */
export function isStoryGate(id: string): boolean {
  return gates.has(id);
}

/**
 * 一道门眼下开没开。unlocked 为空表示主线不设限（新手期已过）。
 */
export function storyGateOpen(
  unlocked: readonly string[] | null | undefined,
  gate: string,
): boolean {
  return !unlocked || unlocked.includes(gate);
}

/** 一个场景眼下进不进得去。表里没有的场景一直开着。 */
export function storySceneOpen(
  unlocked: readonly string[] | null | undefined,
  sceneId: string | null | undefined,
): boolean {
  const gate = sceneId ? STORY_SCENE_GATES[sceneId] : undefined;
  return !gate || storyGateOpen(unlocked, gate);
}

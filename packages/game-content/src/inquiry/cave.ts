import type { InquiryDirectorDraft } from '@daoyou/game-domain/inquiry';
import type { DungeonCostRank } from '@daoyou/game-domain/dungeon';

export const INQUIRY_NODE_IDS = ['SAT_TN_01', 'SAT_TN_04', 'SAT_TN_07'] as const;

export type InquiryNodeId = (typeof INQUIRY_NODE_IDS)[number];

export function isInquiryNode(nodeId: string): nodeId is InquiryNodeId {
  return (INQUIRY_NODE_IDS as readonly string[]).includes(nodeId);
}

export const INQUIRY_LOCATION_NAMES = {
  mouth: '洞口',
  hall: '内室',
} as const;

/** Action costs shared by every cave node. Ranks are resolved from the map realm. */
export const CAVE_ACTION_COSTS = {
  steady_array: { type: 'spirit_stones', rank: 'minor' },
  force_seam: { type: 'hp_loss', rank: 'minor' },
  force_seam_life: { type: 'lifespan', rank: 'minor' },
} as const satisfies Record<
  string,
  { type: 'spirit_stones' | 'hp_loss' | 'lifespan'; rank: DungeonCostRank }
>;

export const CAVE_TRUTHS = {
  mouth_cache: {
    cache: 'mouth_jade',
    casket: 'leave_shut',
    casketStartsBattle: true,
  },
  altar_cache: {
    cache: 'altar_item',
    casket: 'open',
    casketStartsBattle: false,
  },
} as const;

/** Used when the director cannot produce a case that passes the compiler. */
export const CAVE_FALLBACK_DRAFT = {
  truthId: 'mouth_cache',
  cast: [
    { name: '周敛', relation: '洞主，坐化于内室' },
    { name: '沈无咎', relation: '师弟，补过洞口禁制' },
  ],
  truthText:
    '正本封在周敛齿间的温玉里。祭坛玉简是沈无咎留下的残抄，敛骨匣是会放出守剑傀的阵眼。',
  opening:
    '瀑布把洞口遮住了一半。禁制上的新刻痕从外面补进来，水帘边的石缝却还闭着。',
  clues: {
    outward_seal: {
      title: '外补的禁制',
      body: '洞口禁制是从洞外向内补刻的，不像洞主自己封洞。',
      assertsCache: null,
    },
    altar_script: {
      title: '祭坛玉简',
      body: '祭坛玉简笔迹圆转，读起来像一份功法残抄。',
      assertsCache: null,
    },
    wall_script: {
      title: '洞壁题字',
      body: '洞壁题字枯硬，落款是洞主周敛。',
      assertsCache: null,
    },
    handwriting_diff: {
      title: '笔迹不合',
      body: '祭坛玉简和洞壁题字不是同一人书写。',
      assertsCache: null,
    },
    corpse_cache: {
      title: '齿间温玉',
      body: '遗骸齿间含着一枚尚温的玉，玉里封着功法正本。',
      assertsCache: 'mouth_jade',
    },
    seam_note: {
      title: '石缝残笺',
      body: '残笺写着正本在温玉里，匣子一开守剑傀就会醒。落款是沈无咎。',
      assertsCache: 'mouth_jade',
    },
  },
  objects: {
    seal_marks: {
      name: '洞口刻痕',
      examineText: '新刻的禁制压在旧纹上，刀口从洞外指向洞内。',
    },
    stone_seam: {
      name: '水帘石缝',
      examineText: '石缝夹着一角残笺，纸边还是干的。',
    },
    corpse: {
      name: '坐化遗骸',
      examineText: '遗骸保持坐姿，牙关并没有完全合死。',
    },
    altar_item: {
      name: '祭坛玉简',
      examineText: '玉简放在祭坛正中，光泽新得不像洞里的东西。',
    },
    wall_inscription: {
      name: '洞壁题字',
      examineText: '石壁上的字又深又硬，落款清楚写着周敛。',
    },
    casket: {
      name: '敛骨匣',
      examineText: '匣缝里漏出一层不稳的光，像有东西在里面醒着。',
    },
  },
} as const satisfies InquiryDirectorDraft;

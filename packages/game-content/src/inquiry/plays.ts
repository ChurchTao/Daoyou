import type { InquiryDirectorDraft, InquiryPlay } from '@daoyou/game-domain/inquiry';
import { getMapNode } from '../world/map.js';

const obstacleCosts = (nameHint: string): InquiryPlay['objects'][number]['blocked'] => ({
  clueId: 'hidden_note',
  pattern: '闭|抠|撬|合死|伸不进',
  costs: [
    {
      id: 'steady',
      type: 'spirit_stones',
      rank: 'minor',
      label: `${nameHint}抠不开，用灵石稳住`,
      revealsClue: false,
      resultText: '灵石嵌进去，缝隙松了一寸。',
    },
    {
      id: 'force_body',
      type: 'hp_loss',
      rank: 'minor',
      label: `${nameHint}抠不开，硬拨会伤及气血`,
      revealsClue: true,
      resultText: '',
    },
    {
      id: 'force_life',
      type: 'lifespan',
      rank: 'minor',
      label: `${nameHint}抠不开，以寿元震开`,
      revealsClue: true,
      resultText: '',
    },
  ],
});

function play(input: InquiryPlay): InquiryPlay {
  return input;
}

export const INQUIRY_PLAYS = [
  play({
    id: 'cave_inheritance',
    startLocationId: 'mouth',
    spoilerTerms: ['正本'],
    locations: [
      { id: 'mouth', name: '洞口' },
      { id: 'hall', name: '内室' },
    ],
    objects: [
      { id: 'seal_marks', locationId: 'mouth', clueId: 'outward_seal' },
      { id: 'stone_seam', locationId: 'mouth', blocked: { ...obstacleCosts('石缝')!, clueId: 'seam_note', itemId: 'seam_letter' } },
      { id: 'corpse', locationId: 'hall', clueId: 'corpse_cache', itemId: 'mouth_jade' },
      { id: 'altar_item', locationId: 'hall', clueId: 'altar_script', takeAfterOpen: true },
      { id: 'wall_inscription', locationId: 'hall', clueId: 'wall_script' },
      {
        id: 'casket',
        locationId: 'hall',
        container: {
          pattern: '光|缝|封|响',
          openText: '匣盖松了一线。',
          battleWonText: '守剑傀倒下了，匣缝里的光灭了。',
        },
      },
    ],
    compares: [
      { id: 'handwriting', needs: ['altar_script', 'wall_script'], reveals: 'handwriting_diff', label: '对照两处笔迹' },
    ],
    clueIds: ['outward_seal', 'seam_note', 'corpse_cache', 'altar_script', 'wall_script', 'handwriting_diff'],
    truths: [
      { id: 'mouth_cache', answerId: 'corpse', containerJudgement: 'leave_shut', containerStartsBattle: true },
      { id: 'altar_cache', answerId: 'altar_item', containerJudgement: 'open', containerStartsBattle: false },
    ],
    verdict: {
      requiredClueIds: ['outward_seal', 'corpse_cache', 'altar_script', 'wall_script', 'handwriting_diff'],
      answerLabel: '正本在',
      answers: [
        { id: 'corpse', label: '遗骸' },
        { id: 'altar_item', label: '祭坛物件' },
      ],
      containerLabel: '匣子',
      containerOptions: [
        { id: 'leave_shut', label: '不该打开' },
        { id: 'open', label: '该打开' },
      ],
    },
  }),
  play({
    id: 'forbidden_trial',
    startLocationId: 'gate',
    spoilerTerms: ['真眼'],
    locations: [
      { id: 'gate', name: '雾门' },
      { id: 'yard', name: '试炼坪' },
    ],
    objects: [
      { id: 'mist_mark', locationId: 'gate', clueId: 'outer_array' },
      { id: 'stone_lock', locationId: 'gate', blocked: { ...obstacleCosts('石锁')!, clueId: 'lock_note' } },
      { id: 'trial_stone', locationId: 'yard', clueId: 'stone_script' },
      { id: 'wood_vein', locationId: 'yard', clueId: 'vein_script' },
      {
        id: 'trial_box',
        locationId: 'yard',
        container: {
          pattern: '光|缝|封|响',
          openText: '试炼匣的盖缝亮了一下。',
          battleWonText: '阵灵退回匣底，光也灭了。',
        },
      },
    ],
    compares: [
      { id: 'scripts', needs: ['stone_script', 'vein_script'], reveals: 'script_diff', label: '对照石碑和木纹' },
    ],
    clueIds: ['outer_array', 'lock_note', 'stone_script', 'vein_script', 'script_diff'],
    truths: [
      { id: 'stone_cache', answerId: 'trial_stone', containerJudgement: 'leave_shut', containerStartsBattle: true },
      { id: 'vein_cache', answerId: 'wood_vein', containerJudgement: 'open', containerStartsBattle: false },
    ],
    verdict: {
      requiredClueIds: ['outer_array', 'stone_script', 'vein_script', 'script_diff'],
      answerLabel: '真眼在',
      answers: [
        { id: 'trial_stone', label: '试炼石' },
        { id: 'wood_vein', label: '木灵纹' },
      ],
      containerLabel: '试炼匣',
      containerOptions: [
        { id: 'leave_shut', label: '不该打开' },
        { id: 'open', label: '该打开' },
      ],
    },
  }),
  play({
    id: 'scripture_cellar',
    startLocationId: 'stair',
    spoilerTerms: ['真卷'],
    locations: [
      { id: 'stair', name: '梯口' },
      { id: 'cellar', name: '地窖' },
    ],
    objects: [
      { id: 'stair_seal', locationId: 'stair', clueId: 'stair_mark' },
      { id: 'shelf_gap', locationId: 'stair', blocked: { ...obstacleCosts('书架缝')!, clueId: 'shelf_note' } },
      { id: 'scroll_a', locationId: 'cellar', clueId: 'scroll_a_text' },
      { id: 'scroll_b', locationId: 'cellar', clueId: 'scroll_b_text' },
      {
        id: 'book_box',
        locationId: 'cellar',
        container: {
          pattern: '光|缝|封|响',
          openText: '书匣盖缝松了一线。',
          battleWonText: '守阁傀倒在匣前，光灭了。',
        },
      },
    ],
    compares: [
      { id: 'scrolls', needs: ['scroll_a_text', 'scroll_b_text'], reveals: 'scroll_diff', label: '对照两卷笔迹' },
    ],
    clueIds: ['stair_mark', 'shelf_note', 'scroll_a_text', 'scroll_b_text', 'scroll_diff'],
    truths: [
      { id: 'scroll_a_cache', answerId: 'scroll_a', containerJudgement: 'leave_shut', containerStartsBattle: true },
      { id: 'scroll_b_cache', answerId: 'scroll_b', containerJudgement: 'open', containerStartsBattle: false },
    ],
    verdict: {
      requiredClueIds: ['stair_mark', 'scroll_a_text', 'scroll_b_text', 'scroll_diff'],
      answerLabel: '真卷是',
      answers: [
        { id: 'scroll_a', label: '甲卷' },
        { id: 'scroll_b', label: '乙卷' },
      ],
      containerLabel: '书匣',
      containerOptions: [
        { id: 'leave_shut', label: '不该打开' },
        { id: 'open', label: '该打开' },
      ],
    },
  }),
] as const;

const PLAYS = new Map<string, InquiryPlay>(INQUIRY_PLAYS.map((item) => [item.id, item]));

export function getInquiryPlay(playId: string): InquiryPlay | null {
  return PLAYS.get(playId) ?? null;
}

export function listInquiryPlays(): InquiryPlay[] {
  return [...PLAYS.values()];
}

export function inquiryPlayForNode(nodeId: string): InquiryPlay | null {
  const node = getMapNode(nodeId);
  const playId = node && 'dungeon_config' in node ? node.dungeon_config?.inquiry_play : undefined;
  if (!playId) return null;
  return getInquiryPlay(playId);
}

function draft(
  truthId: string,
  cast: InquiryDirectorDraft['cast'],
  truthText: string,
  locations: Record<string, string>,
  clues: InquiryDirectorDraft['clues'],
  objects: InquiryDirectorDraft['objects'],
): InquiryDirectorDraft {
  return { truthId, cast, truthText, locations, clues, objects };
}

const clue = (title: string, body: string, assertsAnswer: string | null = null) => ({
  title,
  body,
  assertsAnswer,
});
const object = (name: string, examineText: string) => ({ name, examineText });

export const INQUIRY_FALLBACKS: Record<string, InquiryDirectorDraft> = {
  cave_inheritance: draft(
    'mouth_cache',
    [
      { name: '周敛', relation: '洞主，坐化于内室' },
      { name: '沈无咎', relation: '师弟，补过洞口禁制' },
    ],
    '功法封在周敛齿间。祭坛玉简是沈无咎留下的残抄，敛骨匣会放出守剑傀。',
    {
      mouth: '瀑布把洞口遮住了一半。禁制上的新刻痕从外面补进来，水帘边的石缝却还闭着。',
      hall: '内室比洞口干。正中坐着一具遗骸，石壁上刻着字，祭坛上放着一枚玉简，旁边一只匣子的缝里漏着光。',
    },
    {
      outward_seal: clue('外补的禁制', '洞口禁制是从洞外向内补刻的，不像洞主自己封洞。'),
      seam_note: clue('石缝残笺', '残笺写着功法在遗骸齿间，匣子一开守剑傀就会醒。', 'corpse'),
      corpse_cache: clue('齿间温玉', '遗骸齿间含着一枚尚温的玉，玉里封着功法。', 'corpse'),
      altar_script: clue('祭坛玉简', '祭坛玉简笔迹圆转，读起来像一份功法残抄。'),
      wall_script: clue('洞壁题字', '洞壁题字枯硬，落款是洞主周敛。'),
      handwriting_diff: clue('笔迹不合', '祭坛玉简和洞壁题字不是同一人书写。'),
    },
    {
      seal_marks: object('洞口刻痕', '新刻的禁制压在旧纹上，刀口从洞外指向洞内。'),
      stone_seam: object('水帘石缝', '石缝闭得死紧，手指抠不进去。'),
      corpse: object('坐化遗骸', '遗骸保持坐姿，牙关并没有完全合死。'),
      altar_item: object('祭坛玉简', '玉简放在祭坛正中，光泽新得不像洞里的东西。'),
      wall_inscription: object('洞壁题字', '石壁上的字又深又硬，落款清楚写着周敛。'),
      casket: object('敛骨匣', '匣缝里漏出一层不稳的光，像有东西在里面醒着。'),
    },
  ),
  forbidden_trial: draft(
    'stone_cache',
    [
      { name: '韩砥', relation: '后山试炼的守阵人' },
      { name: '柳青', relation: '后来补过雾门的弟子' },
    ],
    '真眼在试炼石里。木灵纹是后来补上的，试炼匣会放出阵灵。',
    {
      gate: '雾门只剩半扇。石锁闭着，门楣上的刻痕像是从外面补进去的。',
      yard: '试炼坪中央立着一块石，旁边木纹沿地砖爬向一只匣子，匣缝里有光。',
    },
    {
      outer_array: clue('外补的雾门', '雾门禁制是从门外向内补刻的。'),
      lock_note: clue('石锁内笺', '内笺写着真眼在试炼石，匣子一开阵灵就会醒。', 'trial_stone'),
      stone_script: clue('试炼石', '石上的字枯硬，落款是韩砥。', 'trial_stone'),
      vein_script: clue('木灵纹', '木纹旁的字圆转，不像石上那个人。'),
      script_diff: clue('两处不合', '试炼石和木灵纹不是同一人留下的。'),
    },
    {
      mist_mark: object('雾门刻痕', '新刻压在旧纹上，刀口从雾门外指向门内。'),
      stone_lock: object('石锁', '石锁闭得死紧，手指抠不进去。'),
      trial_stone: object('试炼石', '石面又深又硬，落款清楚写着韩砥。'),
      wood_vein: object('木灵纹', '木纹颜色新，贴着地砖爬向匣子。'),
      trial_box: object('试炼匣', '匣缝里漏出一层不稳的光。'),
    },
  ),
  scripture_cellar: draft(
    'scroll_a_cache',
    [
      { name: '顾册', relation: '藏经阁旧主' },
      { name: '宋纬', relation: '后来改过梯口禁制的弟子' },
    ],
    '真卷是甲卷。乙卷是后来放上的残抄，书匣会放出守阁傀。',
    {
      stair: '梯口很窄。禁制从楼梯外补进来，书架缝闭着。',
      cellar: '地窖里并排两卷书，靠墙一只书匣的缝里漏着光。',
    },
    {
      stair_mark: clue('外补的梯口', '梯口禁制是从外面补进来的。'),
      shelf_note: clue('架缝残签', '残签写着真卷是甲卷，书匣一开守阁傀就会醒。', 'scroll_a'),
      scroll_a_text: clue('甲卷', '甲卷的字枯硬，落款是顾册。', 'scroll_a'),
      scroll_b_text: clue('乙卷', '乙卷的字圆转，纸也新。'),
      scroll_diff: clue('两卷不合', '甲卷和乙卷不是同一人书写。'),
    },
    {
      stair_seal: object('梯口禁制', '新刻压在旧纹上，刀口从楼梯外指向梯内。'),
      shelf_gap: object('书架缝', '书架缝闭得死紧，手指抠不进去。'),
      scroll_a: object('甲卷', '卷面发黄，字迹又深又硬。'),
      scroll_b: object('乙卷', '卷面还白，字迹圆转。'),
      book_box: object('书匣', '匣缝里漏出一层不稳的光。'),
    },
  ),
};

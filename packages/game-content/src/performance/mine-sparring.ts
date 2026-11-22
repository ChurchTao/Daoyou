import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import type { CombatV6SectId } from '@daoyou/game-domain/combat';
import {
  MINE_SPARRING_BATTLE,
  mineSparringFlag,
  type MineSparringEffect,
} from '../story/battles.js';
import { describe, say } from './mine-lessons.js';
import { getMountainGateBackdrop } from './mountain-gate-arrivals.js';

const won = { flag: `battle.${MINE_SPARRING_BATTLE}.won` };
const lost = { flag: `battle.${MINE_SPARRING_BATTLE}.lost` };
type BattleLine = ReturnType<typeof describe> | ReturnType<typeof say>;

const withEffect = (effect: MineSparringEffect, cue: BattleLine) =>
  ({ ...cue, when: { flag: mineSparringFlag(effect) } });
const afterMove = (effect: MineSparringEffect, text: string) =>
  withEffect(effect, describe(text));

const battleDetails: Partial<Record<CombatV6SectId, PerformanceCue[]>> = {
  tianyan: [
    afterMove('wood-fire', '火接出去时，腕上那点青色换成了火色。早课上你看见过一回，这次印留在自己手上。'),
  ],
  jiujie: [
    afterMove('thunder-both', '你记得头一声雷才响，另一只木人身上也跟着炸开了。'),
  ],
  bailu: [
    afterMove('poxie-both', '你只朝着其中一只开口，旁边那只身上也响了一声。'),
  ],
  wanqiao: [
    afterMove('rift-echo', '裂帛打中木人后，木头里又闷响了一次。两声都在木人身上，离石壁还有好几步。'),
  ],
  xiaoyue: [
    afterMove('beast-followup', '虎扑打中以后，跟你上场的灵兽也补了一击。两下都落在同一只木人身上。'),
  ],
};

type BattleReaction = readonly [MineSparringEffect, ...BattleLine[]];
const reactions: Record<
  CombatV6SectId,
  { win: BattleReaction; lose: BattleReaction }
> = {
  lingxiao: {
    win: ['triple', say('peer', '听到第三声，我还以为又裂了一面盾。')],
    lose: ['triple', say('player', '三剑都落下去了。下回我得想想先打哪只，早上的木桩可不用挑。')],
  },
  wuxiang: {
    win: ['pierce', describe('破妄指打中的那一声，你在场里听得很清楚。隔着一截，你已经能点中会动的木人了。')],
    lose: ['pierce', say('peer', '那一指打得实，我在外头都听见了。'), say('player', '点得中。下回还得顾着另一只。')],
  },
  tianyan: {
    win: ['fire-both', say('peer', '隔着那么几步，两只都烧着了。等我上场，也想这么试一回。')],
    lose: ['wood', say('player', '藤绊得住一只。下回我还得多看一眼，另一只到了哪儿。')],
  },
  youdu: {
    win: ['siphon', say('peer', '那张符一黑，我就想起早上接的那两拳。待会儿看我能不能早一点把手腾出来。')],
    lose: ['siphon', say('peer', '早上光举盾，第一拳就给我砸坐下了。等我上去，也先让它那张符黑一黑。')],
  },
  jiujie: {
    win: ['thunder', say('peer', '方才雷响，我先看了眼自己的鞋。早上那下真把我吓着了。')],
    lose: ['thunder', say('player', '练功板挨了雷就待在那儿。木人打中了，我还得接着盯。')],
  },
  bailu: {
    win: ['poxie', describe('那个「邪」字一落，木人身上便啪地响了一声。早上掀下来的是纸符，这回动的是一副木架。')],
    lose: ['poxie', say('peer', '我听见你把两个字都说全了。换我站里头，木拳一伸过来，怕是话都顾不上说。')],
  },
  wanqiao: {
    win: ['rift', describe('裂帛打在木人身上的那声很短，像早上绷紧的布豁开一道口。你这回听得准，声是从木头里起的。')],
    lose: ['rift', say('player', '那一声落哪儿，我听清了。下回得早点听木脚，等墙把声音送回来就晚了。')],
  },
  xiaoyue: {
    win: ['pounce', describe('虎扑结结实实打中时，你才知道早上推木桩那点力，用在会走的木人身上也够。')],
    lose: ['pounce', say('player', '光想着要扑中。扑过去以后，下一步往哪儿站，我还得练。')],
  },
};

function verdictReaction(
  skip: string,
  outcome: typeof won,
  [effect, ...cues]: BattleReaction,
): PerformanceCue[] {
  return [
    { type: 'goto', mark: skip, when: { ...outcome, absent: true } },
    ...cues.map((cue) => withEffect(effect, cue)),
    { type: 'mark', id: skip },
  ];
}

const watched: Record<CombatV6SectId, PerformanceCue[]> = {
  lingxiao: [
    describe('木盾还没歪，同门的左脚就从砖缝边滑了出去。你顺着那只脚往上看，正赶上他把身子拧过去，盾也跟着偏到了左边。矮木人的拳从右侧擦过盾沿。'),
    say('peer', '看见没？'),
    say('player', '左脚先退。盾是你转过去以后才偏的。下次沿这道砖缝退一步，看看还能不能把盾举正。'),
  ],
  wuxiang: [
    describe('矮木人一抬肘，同门就把手贴回胸前。拳从原处扫过去，连裹手背的布都没碰着。等他出来，还把手伸出来让你看。'),
    say('player', '没挨着。它刚抬手，你就缩回来了。'),
    describe('他低头摆了一遍接拳的姿势，肘往外挪，手背藏了进去。'),
    say('peer', '这样兴许敢等它近一点。'),
  ],
  tianyan: [
    describe('同门一起手就把火送了出去。两只木人身上都见了火，举盾的还在棚前，矮的已经踩过院中那块缺角的砖。同门刚收手便得退，袖口险些叫木拳卷住。'),
    say('player', '矮的。你手还朝前伸着，它已经过了那块缺角的砖。'),
    say('peer', '那下次，我也先拿藤招呼它。'),
  ],
  youdu: [
    describe('纸符上的墨一散，同门便把盾举起来。木人打过一拳，收回胳膊时，他从盾后探过半个头，还是等到第二拳砸上来才还手。'),
    say('player', '多等了一拳。头一拳过后，它收手收得慢，胸前就露着。'),
    say('peer', '我那时听见盾在响，光顾着看看裂没裂。'),
  ],
  jiujie: [
    describe('同门刀还没落，右肩已经抬过了左肩。一星电光从刀尖脱开，斜落在他脚旁。等他真的劈下去，刀上早没剩多少光。'),
    say('player', '提刀的时候就掉了。你抬刀，肩也跟着往上跑。你试试只抬手。'),
    describe('同门在门外提了遍刀，自己朝右肩看过去。'),
    say('peer', '怪不得每回都是右脚麻。'),
  ],
  bailu: [
    describe('同门喊出一个「破」字，矮木人恰好从侧面过来。他忙着转脸，第二个字在嘴边只剩一点气。等他出来问你可曾听清，你把两个字各念了一回。'),
    say('player', '头一个隔着门都听得实。第二个我等了半天。'),
    say('peer', '那只跑过来，我就忘了嘴还张着。'),
  ],
  wanqiao: [
    describe('同门朝两只木人之间送出一声。声响从石壁折回来，木脚照旧往前走。他收住气，瞄着举盾那只的左肩又出了一招。这回木肩里短短地响了一声。'),
    say('player', '你头一招叫墙送回来了。后来冲着它左肩那一招才打中。'),
  ],
  xiaoyue: [
    describe('同门还没伏低，两手已经伸出去。后脚擦着砖往外滑，人先往前栽了。他只好抢出一步，才赶在木人跟前把身子稳住。'),
    say('player', '手先到的。脚还在那儿滑。咪咪早上追绳头，你瞧它蹲下以后还等了等。'),
    say('peer', '我还当脚蹬早了，原来手比脚还急。'),
    describe('他伏低再比了一次，咪咪也从台阶上起来找早上那截绳子。'),
  ],
};

const cast = {
  player: { name: '你' },
  teacher: { name: '{instructor}' },
  peer: { name: '隔壁同门' },
};

export function mineSparringScripts(sectId?: CombatV6SectId) {
  const scene = {
    type: 'scene',
    alt: '山门 · 练功场',
    src: sectId ? getMountainGateBackdrop(sectId) : undefined,
  } as const;
  const yard = parsePerformanceScript({
    id: 'mine-sparring-yard',
    title: '木人会还手',
    requires: ['instructor'],
    cast,
    cues: [
      scene,
      { type: 'title', kicker: '下午', text: '木人会还手' },
      describe('你刚跨过练功场的红线，同门就在身后喊你。'),
      say('peer', '打完等我一会儿。早上托你的事，别忘了。'),
      describe('教习扳开闸，棚里当啷一响。举盾的木人扶着棚柱站起来，把盾往身前一竖。你在矿上搬过差不多大的盖板，得两只手抱，它用一条胳膊就举到了下巴底下。'),
      describe('咪咪耳朵一转，你心里立刻觉出它在催你往右看。矮的那只已经绕过盾沿，离你只剩几步。早上还能站稳了想怎么起手。眼下再等，它的拳就先到了。'),
      { type: 'choice', options: [{ label: '（迎上去）', outcome: 'done' }] },
      { type: 'end', outcome: 'done' },
    ],
  });
  const verdict = parsePerformanceScript({
    id: 'mine-sparring-verdict',
    title: '回到场边',
    requires: ['instructor'],
    cast,
    cues: [
      scene,
      { type: 'title', text: '回到场边' },
      {
        ...describe('最后那只木人膝弯一折，铜箍先撞在地上。它伸手撑了一次，还是歪倒下去。教习等你走回场门，拿起试手簿，在你的名字旁写了个「胜」。'),
        when: won,
      },
      { ...say('peer', '坐这儿，看得见脚底下。我在外头听着，比早上轮到自己还急。'), when: won },
      {
        ...describe('教习扳回闸柄，收住两只木人。试手簿摊在场边，他在你的名字旁写了个「负」。'),
        when: lost,
      },
      { ...say('teacher', '先坐会儿。想重来，等我把它们放回原位，随时喊我。'), when: lost },
      { ...say('peer', '来，坐我这儿。待会儿我上场，你从这边看就行。'), when: lost },
      ...(sectId ? battleDetails[sectId] ?? [] : []),
      ...(sectId ? [
        ...verdictReaction('after-win', won, reactions[sectId].win),
        ...verdictReaction('after-loss', lost, reactions[sectId].lose),
      ] : []),
      {
        type: 'choice',
        when: lost,
        options: [
          { label: '（留下看同门试手）', outcome: 'done' },
          { label: '（再试一回）', outcome: 'retry' },
        ],
      },
      { type: 'end', outcome: 'done' },
    ],
  });
  const watch = parsePerformanceScript({
    id: 'mine-sparring-watch',
    title: '轮到同门',
    requires: ['instructor'],
    cast,
    cues: [
      scene,
      { type: 'title', text: '轮到同门' },
      describe('教习把两个木人摆回棚下。同门进门以前还回头找你，你朝他招招手，让他知道你在场边。闸又响了一声。'),
      ...(sectId ? watched[sectId] : [
        describe('你记着早上答应他的事，一直看到他下场，才把自己瞧见的说给他听。'),
      ]),
      describe('散场时，同门在门柱前停下，指着一张送药的差帖让你看。'),
      { type: 'letter', title: '白水镇送药差', text: '丹房有一匣药须送到白水镇药铺。两人同行。' },
      say('peer', '这趟要两个人。你替我看招看得细，要是肯去，我想跟你搭个伴。你走过那条路么？'),
      say('player', '没到过那儿。要是走水路，我知道该找谁问船。'),
      say('peer', '那我去丹房问问，这匣药该怎么带。'),
      describe('你想起阿禾也替药婆捎药。他要是知道你也开始替人送药，大概得先问你认不认路。'),
      say('player', '行。领差的人在哪儿？'),
      { type: 'end', outcome: 'done' },
    ],
  });
  return [yard, verdict, watch];
}

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
    afterMove('wood-fire', '火才放出去，腕上的青印就换了颜色，跟早课上看到的一样。'),
  ],
  jiujie: [
    afterMove('thunder-both', '引雷斩一出，两只木人身上都炸响了。'),
  ],
  bailu: [
    afterMove('poxie-both', '你只朝着其中一只开口，旁边那只身上也响了一声。'),
  ],
  wanqiao: [
    afterMove('rift-echo', '裂帛打中的地方又闷响了一声，隔着好几步也能听出来。'),
  ],
  xiaoyue: [
    afterMove('beast-followup', '你刚扑中，灵兽就从你身边跟上来，也打了那木人一下。'),
  ],
};

type BattleReaction = readonly [MineSparringEffect, ...BattleLine[]];
const reactions: Record<
  CombatV6SectId,
  { win: BattleReaction; lose: BattleReaction }
> = {
  lingxiao: {
    win: ['triple', say('peer', '听到第三声，我还以为又裂了一面盾。')],
    lose: ['triple', say('player', '三剑总算打全了。下回我先盯跑得快的那只。')],
  },
  wuxiang: {
    win: ['pierce', describe('木人在走，那一指也正正点在你瞄的地方。')],
    lose: ['pierce', say('peer', '那一指打得实，我在外头都听见了。'), say('player', '点得中。下回还得顾着另一只。')],
  },
  tianyan: {
    win: ['fire-both', say('peer', '那团火是一起落的？我在外头看，两只身上都着了。')],
    lose: ['wood', say('player', '下回缠住一只，手就得空出来，另一只也在往这边走。')],
  },
  youdu: {
    win: ['siphon', say('peer', '等我上去，符一黑我就准备还手。你替我数数，我挡了几拳。')],
    lose: ['siphon', say('peer', '早上光举盾，第一拳就给我砸坐下了。等我上去，也先让它那张符黑一黑。')],
  },
  jiujie: {
    win: ['thunder', say('peer', '方才雷响，我先看了眼自己的鞋。早上那下真把我吓着了。')],
    lose: ['thunder', say('player', '我只顾看雷落在哪儿了。下回出了刀就往边上让。')],
  },
  bailu: {
    win: ['poxie', describe('早上一个「邪」字能掀掉纸符。刚才你把这个字说全，连木架都给震得响了一声。')],
    lose: ['poxie', say('peer', '我听见你把两个字都说全了。换我站里头，木拳一伸过来，怕是话都顾不上说。')],
  },
  wanqiao: {
    win: ['rift', describe('打中那一下又脆又短，跟早上撕开布时一个声儿。')],
    lose: ['rift', say('player', '我听见打中了。下回就听它的脚，别等回声。')],
  },
  xiaoyue: {
    win: ['pounce', describe('这一扑打中了。早上脚下那一下没白练。')],
    lose: ['pounce', say('player', '下次先看哪儿能落脚。我光顾着扑了。')],
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
    describe('你一直盯着同门的脚。左脚刚退过砖缝，他的身子便跟着一拧，木拳擦着盾的右边过去了。'),
    say('peer', '看见没？'),
    say('player', '左脚先退。你顺着这条砖缝退半步试试，盾举着，身子别转。'),
  ],
  wuxiang: [
    describe('矮木人一抬肘，同门就把手贴回胸前。拳从原处扫过去，连裹手背的布都没碰着。等他出来，还把手伸出来让你看。'),
    say('player', '没挨着。它刚抬手，你就缩回来了。'),
    describe('他低头摆了一遍接拳的姿势，肘往外挪，手背藏了进去。'),
    say('peer', '这样兴许敢等它近一点。'),
  ],
  tianyan: [
    describe('两只木人都挨了火。举盾的还在棚前，矮的已经追到同门跟前，他退得快，拳才没刮住袖口。'),
    say('player', '矮的先到。你还没收手，它就过了场中那块缺角砖。'),
    say('peer', '那下次，我也先拿藤招呼它。'),
  ],
  youdu: [
    describe('纸符一黑，同门就举起盾。挡过第一拳，他从盾后探头看了一眼，等木人再打上来才还手。'),
    say('player', '多等了一拳。头一拳过后，它收手收得慢，胸前就露着。'),
    say('peer', '我那时听见盾在响，光顾着看看裂没裂。'),
  ],
  jiujie: [
    describe('同门刀还没落，右肩已经抬过了左肩。一星电光从刀尖脱开，斜落在他脚旁。等他真的劈下去，刀上早没剩多少光。'),
    say('player', '刀还没落，雷就掉了。你提刀时右肩也提了起来，再比一下？'),
    describe('同门在门外提了遍刀，自己朝右肩看过去。'),
    say('peer', '怪不得每回都是右脚麻。'),
  ],
  bailu: [
    describe('同门喊完「破」，矮木人就从侧面冲来。他忙着转脸，后半声轻得几乎听不见。一出场他就问你听清了没有。'),
    say('player', '我就听见个「破」字。'),
    say('peer', '那只跑过来，我就忘了嘴还张着。'),
  ],
  wanqiao: [
    describe('同门朝两只木人之间送出一声。声响从石壁折回来，木脚照旧往前走。他收住气，瞄着举盾那只的左肩又出了一招。这回木肩里短短地响了一声。'),
    say('player', '头一声是从墙上回来的。第二声闷，当时我还听见木脚在往前走，隔了几步都分得开。'),
  ],
  xiaoyue: [
    describe('同门还没伏低，两手已经伸出去。后脚擦着砖往外滑，人先往前栽了。他只好抢出一步，才赶在木人跟前把身子稳住。'),
    say('player', '手先伸的，脚还打滑。你想想咪咪扑绳头那一回，它蹲稳了才蹬。'),
    say('peer', '我还当脚蹬早了，原来手比脚还急。'),
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
      say('peer', '打完先别走，下一个就轮到我。'),
      describe('教习一扳闸，棚里当啷一响。你在矿上搬这么大的盖板得用两只手，迎面那木人抬起一条胳膊就把盾竖到了下巴底下。'),
      describe('咪咪在催你往右看。矮木人已经绕出盾沿，拳头抬起来了。'),
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
        ...describe('最后一只木人倒下时，膝上的铜箍磕得一响。你走到场边，教习在簿子上给你记了个「胜」。'),
        when: won,
      },
      { ...say('peer', '来，坐我这儿。你等会儿替我看，这儿瞧得清。'), when: won },
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
      describe('两个木人摆回了原位。同门进场前回头找你，你朝他招招手。教习开了闸。'),
      ...(sectId ? watched[sectId] : [
        describe('你记着早上答应他的事，一直看到他下场，才把自己瞧见的说给他听。'),
      ]),
      describe('散场时，同门把你叫到门边看差帖。'),
      { type: 'letter', title: '白水镇送药差', text: '丹房有一匣药须送到白水镇药铺。两人同行。' },
      say('peer', '要不要跟我去一趟？白水镇你认得路么？'),
      say('player', '镇子没去过。我认识常往下游跑的船家，可以问他。'),
      say('peer', '那就走，先到丹房问药。'),
      { type: 'end', outcome: 'done' },
    ],
  });
  return [yard, verdict, watch];
}

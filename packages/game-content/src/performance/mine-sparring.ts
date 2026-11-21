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
const withEffect = (effect: MineSparringEffect, cue: ReturnType<typeof describe> | ReturnType<typeof say>) =>
  ({ ...cue, when: { flag: mineSparringFlag(effect) } });
const afterMove = (effect: MineSparringEffect, text: string) =>
  withEffect(effect, describe(text));

const fightRecollections: Record<CombatV6SectId, PerformanceCue[]> = {
  lingxiao: [
    afterMove('triple', '方才使断尘，头一剑落下你险些把力都送出去。等第二剑追上，你才照教习说的把劲留到第三剑。虎口还在跳，手背上粘着一片碎屑。'),
  ],
  wuxiang: [
    afterMove('pierce', '你还记得木拳在眼前晃过，等胸前那片木头从臂弯底下露出来，你才送出两指。隔着一截，木胸已经响了。手上连一点木灰也没有。'),
  ],
  tianyan: [
    afterMove('wood', '方才细藤从砖缝钻出来，搭住木人的脚踝。木脚在砖上拖过半步，你抬手还有工夫看一眼，腕上那道青印真留住了。'),
    afterMove('wood-fire', '腕上的青印一热，你便将火送了出去。火落到木头上那声，比早上打练功靶还响。'),
    afterMove('fire-both', '两只木人隔着几步，身前都焦了一块。你那一手火只放了一次。'),
  ],
  youdu: [
    afterMove('siphon', '墨沿着符上那一竖晕开时，木人的拳照样举了起来。早上得等教习指给你看，方才你一见符黑了，就认出了该还手的时候。'),
  ],
  jiujie: [
    afterMove('guard', '天罡护体一运起来，袖里就起了细碎的电光，手臂上的寒毛全立着。'),
    afterMove('thunder', '方才手一麻，你险些松开五指。刃放低，雷才跟着刀背过去。你闻到了焦木味，手里却轻飘飘的，连刀柄在哪根指头底下都摸不准。'),
    afterMove('thunder-both', '头一声才落，旁边又炸了一声。另一只木人身上也腾起了烟。'),
  ],
  bailu: [
    afterMove('poxie', '破邪喊出头一个字，你还存着半口气。等第二个字说完，木人胸前啪的一声。你在场里听得清，自己那两个字一轻一重。'),
    afterMove('poxie-both', '你只朝着其中一只开口。响过一声，旁边那只也跟着挨了一记。'),
    afterMove('fuyuan', '念过复元，方才能把一口气吸到底，身上也松了些。'),
  ],
  wanqiao: [
    afterMove('rift', '那一声比早上撕布还短。头一下就在木人身上响，隔了一会儿，石壁才送回来一点余音。这回你听清了。'),
    afterMove('rift-echo', '木人迈出去以后，挨过一下的木节也跟着响。那声随木脚往前，跟石壁送回来的余音分得很清。'),
  ],
  xiaoyue: [
    afterMove('pounce', '方才两手刚要抬，后脚还在砖上滑。你多等了半拍，才蹬出去。掌根挨到木头那一下，力从脚底直顶到指尖。'),
    afterMove('beast-followup', '等你在木人跟前落脚，跟你上场的灵兽也赶上来补了一击。又一声，打的还是同一只。'),
  ],
};

const reactions: Record<
  CombatV6SectId,
  { win: readonly [MineSparringEffect, string, string]; lose: readonly [MineSparringEffect, string, string] }
> = {
  lingxiao: {
    win: ['triple', '第三声我还当是木人打着你了。', '前两剑省下的劲都在那一声里。你看，我这手还在跳。'],
    lose: ['triple', '那三下听得真切。我还当它就要倒了。', '早上劈过三剑，木桩还肯等我喘口气。'],
  },
  wuxiang: {
    win: ['pierce', '隔着那么远，也能点准？', '就跟早上打板子一样，得先看准一块。'],
    lose: ['pierce', '我看见你点中了，还以为它会停。', '我也等着它停呢。它一抬胳膊，我才想起来那点凹痕挡不了拳。'],
  },
  tianyan: {
    win: ['wood-fire', '你先留那点儿青的，就为了后头这把火？', '嗯。方才把火送出去的时候，我手腕还是热的。'],
    lose: ['wood', '有一只我瞧见你拖住了。', '能绊住一只。下回我还得留神另一只走了几步。'],
  },
  youdu: {
    win: ['siphon', '我在门边只看见那张符。墨一散就能打？', '趁它还黑着。'],
    lose: ['siphon', '我刚瞧见墨散开，还以为它要收手。', '早上教习就叫我看它那一拳。照打。'],
  },
  jiujie: {
    win: ['thunder', '我还以为今天又要领把新刀。', '刀好好的。焦味是从场里来的。'],
    lose: ['thunder', '我只听见响。怎么，你那手也会麻？', '早上打练功板，可没有这么麻。'],
  },
  bailu: {
    win: ['poxie', '你在里头喊得那么响，嗓子疼么？', '还好。第一字我没使多少劲。'],
    lose: ['poxie', '我听你喊全了。', '它挨了也还会来。喊完得赶紧看它的手。'],
  },
  wanqiao: {
    win: ['rift', '我方才耳朵还朝着墙。你在里头分得开？', '得先知道它走到哪儿。打在木头上，声音短。'],
    lose: ['rift', '那一下我听准了。', '站在里头还能听见墙送回来一声。我可不能每回都等着把它听完。'],
  },
  xiaoyue: {
    win: ['pounce', '刚瞧见你要抬手，怎么还停了半拍？', '砖滑，踩稳才蹬得出去。'],
    lose: ['pounce', '方才那一扑是挨着了的。我在外面都听见了。', '扑上去只要一蹬。落了脚还得站得住，我才想起这茬。'],
  },
};

function verdictReaction(
  skip: string,
  outcome: typeof won,
  [effect, question, reply]: (typeof reactions)[CombatV6SectId]['win'],
): PerformanceCue[] {
  return [
    { type: 'goto', mark: skip, when: { ...outcome, absent: true } },
    withEffect(effect, say('peer', question)),
    withEffect(effect, say('player', reply)),
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
    describe('同门送出第一声，两只木人还往前走，石壁却回了他一下。第二声才听见木头响，就在举盾那只的左肩。'),
    describe('他出来一路朝墙看。你叫他站到你刚才的位置，先指石壁，再指场内。'),
    say('player', '先这边。第二声才在木人身上。'),
  ],
  xiaoyue: [
    describe('同门还没伏低，两手已经伸出去。后脚擦着砖往外滑，人先往前栽了。他只好抢出一步，才赶在木人跟前把身子稳住。'),
    say('player', '手先到的。脚还在那儿滑。咪咪早上追绳头，你瞧它蹲下以后还等了等。'),
    describe('同门屈了屈膝盖。咪咪见他又伏低了，立刻坐起来找那截绳子。'),
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
      describe('咪咪耳朵一转，你心里立刻觉出它在催你往右看。矮的那只已经绕过盾沿，离你只剩几步。早上对着木桩，你还能细想怎么起手。眼下再等，它的拳就先到了。'),
      { type: 'choice', options: [{ label: '（上场试手）', outcome: 'done' }] },
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
        ...describe('闸柄在身后一响，木人的拳停了。你还抬着胳膊，过了一会儿才听见教习叫你出来。他等你放下手，在你的名字旁写了个「负」。'),
        when: lost,
      },
      { ...say('teacher', '先坐会儿。想重来，等我把它们放回原位，随时喊我。'), when: lost },
      { ...say('peer', '我待会儿就上。你坐着看就行，要是瞧见了，下来跟我说一声。'), when: lost },
      ...(sectId ? fightRecollections[sectId] : []),
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
      describe('教习把两个木人摆回棚下。同门进门以前还回头找你，你往门边让了让，好让他知道你坐在哪儿。闸又响了一声。'),
      ...(sectId ? watched[sectId] : [
        describe('你记着早上答应他的事，一直看到他下场，才把自己瞧见的说给他听。'),
      ]),
      describe('你们等教习把木人归位。同门去拿水，回来递给你一碗，另一只手上还多了张差帖。'),
      { type: 'letter', title: '白水镇送药差', text: '丹房有一匣药须送到白水镇药铺。两人同行。' },
      say('peer', '你走过白水镇那条路么？'),
      say('player', '没到过那儿。要是走水路，我知道该找谁问船。'),
      say('peer', '你愿不愿意跟我领这张？我去问丹房，看看送的药该怎么带。'),
      describe('你想起阿禾也替药婆捎药。他要是知道你也开始替人送药，大概得先问你认不认路。'),
      say('player', '行。领差的人在哪儿？'),
      { type: 'end', outcome: 'done' },
    ],
  });
  return [yard, verdict, watch];
}

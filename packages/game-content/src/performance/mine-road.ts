import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import { SECT_ORGANIZATION_DEFINITIONS } from '../sect-organization/definitions.js';

export const MINE_ROAD_SCRIPT = 'mine-departure-routes';

export function mineRoadFlag(sectId: string) {
  return 'mine-road.' + sectId;
}

const dockTalk: Record<string, [question: string, answer: string]> = {
  lingxiao: [
    '红尘剑宗的人真会御剑？',
    '柳湾涨大水那年，有户人家蹲在屋脊上。去救人的船被断木堵住了，撑船的说，有个剑宗弟子踩着剑从他篙尖上掠过去，回来的时候，剑上多站了个抱灯的小孩。那晚雨下得那么大，他记得孩子手里那点光还亮着。',
  ],
  wuxiang: [
    '无相禅宗的人也下山么？',
    '往北送矿的车夫说，他有一回叫塌下来的石头堵在矿里。无相来个赤脚和尚，从缝里爬进去，用肩扛了半宿石顶。车夫是最后一个出来的，和尚在后头问他能不能给口水，说一直怕肩膀动，连口唾沫都没敢咽。',
  ],
  tianyan: [
    '天衍圣地在昆吾山？',
    '是。贩药的去过，说昆吾山有几座峰，隔着一条沟，两边田里各过各的时节。他去的时候脚底还是雪，一抬头，对面已经有人割稻了。下山时人家给了他两穗尝鲜，他揣到渡口，叫我伸手摸，谷粒还带着太阳晒过的热气。',
  ],
  youdu: [
    '幽都那边也有渡船？',
    '有。运盐的老刘跟我讲过，他爹当年沉在冥海，连船都没找着。老刘后来去幽都守了一夜灯，快天亮时，雾里漂来一条空船。船头搁着根短桨，他捡起来摸了半天。桨上缺的那个角，是他小时候亲手削坏的。',
  ],
  jiujie: [
    '九劫天宫真在云上？',
    '背盐的常在那边山脚歇脚。有回他看见峰顶劈下一道雷，白光里露出个人来。他当是有人摔下山了，瞧仔细了，那人竟迎着雷往上走。背盐的数到第七步，云就合上了。他回过神来，扁担上的盐包已经淋湿了。',
  ],
  bailu: [
    '白鹿书院也教仙术？',
    '晋京有条街起过火，风刮得瓦都飞了。听挑水的说，书院一位先生借了他的桶盖，写个「止」字，搁在街口。那一夜火烧到桶盖跟前，再往前一步也没挪。隔天挑水的去捡，木头连道焦印都没有。',
  ],
  wanqiao: [
    '说说万窍山吧。',
    '卖竹笛的说，有年旱得池塘见了底，他在万窍山歇脚，忽然听见雨打得满山竹叶都响。他跑出去收笛子，石阶还是干的。领路的人叫他听完，说那是祖师上山那天下的雨，谷里一直留着。',
  ],
  xiaoyue: [
    '百兽崖的灵兽亲人么？',
    '跑山货的只见过一头黑虎。他说有个病孩子趴在虎背上，那虎沿着光溜溜的崖壁往下走，跟下田埂一样。走到山脚，孩子还睡着。孩儿他娘追到药铺要谢送他下来的弟子，弟子指给她看，那虎还伏在门口，等人给它挠背呢。',
  ],
};

export function createMineRoadChoice(mode: 'remember' | 'visit' = 'remember') {
  const sects = Object.values(SECT_ORGANIZATION_DEFINITIONS);
  const asking = mode === 'remember';
  const cues: PerformanceCue[] = [
    { type: 'scene', alt: asking ? '渡口 · 船头' : '山脚 · 岔路' },
    ...(asking
      ? ([
          {
            type: 'line',
            speaker: 'he',
            text: '我随船跑这些年，听过不少山上的事。你想问哪一家？',
          },
          { type: 'mark', id: 'ask' },
        ] satisfies PerformanceCue[])
      : ([
          {
            type: 'narration',
            text: '你在岔路口停了停，把手头几张路帖重新翻了一遍。',
          },
        ] satisfies PerformanceCue[])),
    {
      type: 'choice',
      options: sects.map(({ id, name }) =>
        asking
          ? { label: dockTalk[id]?.[0] ?? name + '该怎么走？', jump: id }
          : { label: '去' + name + '看看', outcome: id },
      ),
    },
  ];
  if (asking) {
    for (const { id, name } of sects) {
      const answer =
        dockTalk[id]?.[1] ?? '我只认得这里到岔口的一段。帖你带着，到了再问。';
      cues.push(
        { type: 'mark', id },
        { type: 'line', speaker: 'he', text: answer },
        {
          type: 'choice',
          options: [
            {
              label: '先去' + name + '看看',
              outcome: 'done',
              set: mineRoadFlag(id),
            },
            { label: '（再问一家）', jump: 'ask' },
          ],
        },
      );
    }
  }
  return parsePerformanceScript({
    id: asking ? MINE_ROAD_SCRIPT : 'mine-gate-routes',
    title: '山门路帖',
    requires: [],
    cast: asking ? { he: { name: '阿禾' } } : {},
    cues: [...cues, { type: 'end', outcome: 'done' }],
  });
}

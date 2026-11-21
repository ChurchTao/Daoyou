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
    '柳湾有一年涨大水，一户人家叫水困在屋脊上。去救人的船过不去，船老大说，有个剑宗弟子从他篙尖上飞过去。等飞回来，剑上多了个小孩，两手还护着从家里带出来的灯。',
  ],
  wuxiang: [
    '无相禅宗的人也下山么？',
    '北边的矿塌过一回，去井口接货的车夫赶上了。无相有个赤脚和尚，从矿口的窄缝钻进去，拿肩抵住快要落下来的石板。车夫在外头接人，说井下的人都得贴着那和尚的腿爬。等到最后一个人出来，才轮到他自己。',
  ],
  tianyan: [
    '天衍圣地在昆吾山？',
    '是。有人上昆吾山卖药，在雪里走了好久，脚都快冻木了。到沟边一看，对面坡上有人卷着裤腿下田，正割稻子呢。他同我说，隔着那条沟，两边过的节气都不一样。',
  ],
  youdu: [
    '幽都的船也走夜路？',
    '走夜路，认灯。我听运盐的老刘说，他爹当年沉在冥海，连船也没找着。他后来去幽都求人点盏灯，在岸边守了一夜。快天亮时，雾里漂来一条空船，船头搁着根短桨。老刘认得桨上缺的那个角，是他小时候亲手削坏的。',
  ],
  jiujie: [
    '九劫天宫真在云上？',
    '宫门在哪儿，山脚的人看不见。倒有个挑盐的跟我讲，峰顶打雷那天，他看见白光里有个人，还当是给雷劈下来了。那人一步一步往高处走，走了几步，身形离山壁越来越远。',
  ],
  bailu: [
    '白鹿书院也教仙术？',
    '晋京有条街起过火，风又大，挑水的人说浇都来不及。书院一位先生跟他借了桶盖，写个「止」字，立在街口。火到桶盖前就停了。第二天他还拿那盖子盖水桶，木头上连个焦印都没有。',
  ],
  wanqiao: [
    '万窍山有什么稀奇事？',
    '卖笛子的去过。那年旱得塘底都裂开了，他在山里听见雨打竹叶，跑出去伸手接，一滴没接着。领路的人告诉他，那场雨真下过，是祖师上山那一天的。若是想再听，顺这条谷往里走就有。',
  ],
  xiaoyue: [
    '百兽崖的灵兽亲人么？',
    '我听跑南疆山货的人讲，崖上有个孩子得了急病，是头黑虎送下来的。那头虎驮着他，顺崖壁走下来，底下的人看得腿软。孩子到药铺还伏在它背上睡。等他娘赶到，虎还在药铺门口，听见孩子醒了才走。',
  ],
};

export function createMineRoadChoice(mode: 'remember' | 'visit' = 'remember') {
  const sects = Object.values(SECT_ORGANIZATION_DEFINITIONS);
  const asking = mode === 'remember';
  const cues: PerformanceCue[] = [
    { type: 'scene', alt: asking ? '渡口 · 船头' : '山脚 · 接引亭' },
    ...(asking
      ? ([
          {
            type: 'line',
            speaker: 'he',
            text: '这几家我都听人讲过。你想先问哪一家？',
          },
          { type: 'mark', id: 'ask' },
        ] satisfies PerformanceCue[])
      : ([
          {
            type: 'narration',
            text: '守阵的人问你，想去哪家山门。',
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
        dockTalk[id]?.[1] ?? '这家我知道得少。你带上路帖，到山门问问。';
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

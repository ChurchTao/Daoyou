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
    '柳湾涨大水那回，救人的船过不去。船老大同我说，他一篙撑下去还没碰着底，剑宗的人就从他头顶飞过去了。回来的时候，剑上多了个小孩。孩子两只手还护着灯，也不知怎么从屋里抱出来的。',
  ],
  wuxiang: [
    '无相禅宗的和尚有什么本事？',
    '北边塌过矿，接货的车夫就在井口。他说有个无相的和尚，光着脚挤进缝里，用肩扛住顶上掉下来的石板。里头的人挨着他的腿，一个一个爬出来。最后一个都爬出去了，和尚才从缝里钻出来。',
  ],
  tianyan: [
    '天衍圣地那座昆吾山，去过的人多么？',
    '有个上山卖药的回来跟我讲，他在雪里走得脚都木了，到沟边一抬头，对面的人正卷着裤腿割稻。两边就隔了一条沟。',
  ],
  youdu: [
    '你听过幽都那边的事么？',
    '运盐的老刘跟我说，他爹当年沉在冥海，船也没找着。他请幽都的人点了盏灯，在岸上等到天快亮，雾里真漂来条空船。老刘看见船头那根短桨就认出来了。桨缺了个角，是他小时候拿刀削坏的。',
  ],
  jiujie: [
    '九劫天宫真在云上？',
    '宫门我没见过。有个挑盐的倒跟我说，峰顶打雷那会儿，他瞧见白光里有个人，还当这人要摔下来。等雷再亮，那人往上又走了几步，脚底下早没有山路了。',
  ],
  bailu: [
    '白鹿书院也教仙术？',
    '晋京街上有一回走水，风大，挑水都来不及。书院的先生借了个桶盖，写个「止」字，往街口一立。火到那儿就过不去了。借盖子的人跟我说，他第二天照旧拿它盖桶，上面连点焦印都没有。',
  ],
  wanqiao: [
    '万窍山有什么稀奇事？',
    '卖笛子的去过。那年旱得塘底都裂了，他在山里听见雨打竹叶，跑出去接，手伸出去半天还是干的。领路的说，雨是下过，祖师上山那天就下的。你想听，今天往那道谷里走，还听得见。',
  ],
  xiaoyue: [
    '百兽崖的灵兽亲人么？',
    '有个跑南疆山货的亲眼见过，崖上孩子得了急病，是头黑虎驮去药铺的。那虎沿着直崖往下走，底下的人光抬头看都腿软。等孩子他娘赶来，黑虎还在门口趴着，听见孩子醒了才走。',
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
            text: '路帖你先拿着。这几家的事我听过一些，想问哪家？',
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

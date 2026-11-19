import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import { SECT_ORGANIZATION_DEFINITIONS } from '../sect-organization/definitions.js';
import { getSectLandmarkBySectId } from '../world/map.js';

// 伙计听来的闲话，和门派自己的立传分开写。新山门还没写轶事时，他也能给人指路。
type TavernCue = Extract<PerformanceCue, { type: 'line' | 'narration' }>;
const gossip: Record<string, { question: string; cues: TavernCue[] }> = {
  lingxiao: {
    question: '红尘剑宗的人真能踩着剑飞？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '我舅在元武国摆渡，亲眼见过。剑宗有个姑娘三天两头坐他的船。有一回缆绳断了，她踩着剑先飞过去，把绳头送回我舅手上。我舅吓了一跳，问她既会飞，何苦天天给他两个钱。',
      },
      {
        type: 'line',
        speaker: 'waiter',
        text: '她说，上船能剥菱角吃。你看，我舅后来给她留了一筐，自己倒没得吃，还跟我讨。',
      },
      {
        type: 'narration',
        text: '小二从柜上抓了一撮菱角给你。你拿了一颗，咬了两回才把壳咬开。',
      },
    ],
  },
  wuxiang: {
    question: '无相禅宗收徒么？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '收啊。去年有个无相禅宗的和尚在檐下讨饭，我端了个冷馒头给他。他拿起来捂了一会儿，再掰开时，还往外冒热气呢。',
      },
      { type: 'narration', text: '你看了看小二的手。他把手背到身后。' },
      {
        type: 'line',
        speaker: 'waiter',
        text: '吃完他把碗还给我。外头风大，碗沿搁在我手里，摸着还是暖的。',
      },
    ],
  },
  tianyan: {
    question: '天衍圣地在哪儿？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '在昆吾山。上回有个运药苗的在我这儿歇脚，苗都蔫了，他正跟车夫吵呢。有位天衍圣地的女弟子听了半天，管我要半碗井水。她蹲在车边掐了几下诀，水才沾着泥，原先趴在筐沿上的叶子，一片片全支起来了。',
      },
      { type: 'line', speaker: 'player', text: '那还吵么？' },
      {
        type: 'line',
        speaker: 'waiter',
        text: '吵。车夫说你看，早叫你浇水了。',
      },
    ],
  },
  youdu: {
    question: '小二，幽都怎么走？',
    cues: [
      {
        type: 'narration',
        text: '小二手里的抹布停了停。他绕到你这边来，替你把桌角擦了一遍。',
      },
      {
        type: 'line',
        speaker: 'waiter',
        text: '得坐船去冥海。你要遇上那条运油船，船老大准会跟你讲他师弟落水那一回。人掉下船以后，捞了半夜都没捞着。他去求幽都的人帮忙，人家在岸边点了盏灯，让他喊师弟小时候的名字。',
      },
      {
        type: 'line',
        speaker: 'waiter',
        text: '我问他后来找着人没有。那船老大说，第二天一早有人把他推醒，一睁眼就是他师弟，坐在床沿上讨一件干衣裳。',
      },
    ],
  },
  jiujie: {
    question: '九劫天宫也在招人？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '收不收徒，你得上山问管名册的。我只见过他们下来买瓦。那人背着刀，有个伙计伸手要替他挂，手才挨到鞘，啪的一声，连攥在手心的抹布都烧了个洞。',
      },
      {
        type: 'line',
        speaker: 'waiter',
        text: '客人说那刀里引了雷，一碰还会往外跑。他也不敢再把刀搁下，抱着喝完一碗茶。掌柜那天也没催他腾桌。',
      },
    ],
  },
  bailu: {
    question: '在白鹿书院能修仙么？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '能啊。去年正月，店前头有人为了半吊钱打架，两根扁担都举起来了。晋京来的一个书生隔着窗叫了声放下。你猜怎么着，两根扁担一齐落地。我蹲在灶后头，手里还掉了把菜刀。',
      },
      { type: 'line', speaker: 'player', text: '他是白鹿书院的？' },
      {
        type: 'line',
        speaker: 'waiter',
        text: '嗯。他那日还问我借了根麻绳捆书，我可记得牢。回头我得找他要。',
      },
    ],
  },
  wanqiao: {
    question: '早上拿竹管捎话的姑娘是万窍山的？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '是。她上回坐的也是你这桌。吃着饭忽然叫我下楼，看看酒瓮底下漏没漏。我说你隔着一层楼板也闻得着酒？她说她是听见的，一滴一滴往下落，都替我数到七了。',
      },
      { type: 'narration', text: '你低头贴近桌沿，只听见楼下有人在剁姜。' },
    ],
  },
  xiaoyue: {
    question: '百兽崖的人，平日怎么跟灵兽相处？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '有个百兽崖的弟子常来吃面，回回都坐窗边。我给他的面切了几片肉，他一低头，窗外就伸进一只猿爪来够那肉。我头回拿筷子去敲，他连忙按着我手，说那只猿是他师兄。',
      },
      {
        type: 'line',
        speaker: 'waiter',
        text: '后来那人来吃面，那只猿在院里踩着井沿走。他也上去跟着走了两圈，走得比猿慢，一下来鞋都湿了。你要去，沿南边挑山货的人走的路问就是。',
      },
    ],
  },
};

export function createTavernConversation(available?: ReadonlySet<string>) {
  const sects = Object.values(SECT_ORGANIZATION_DEFINITIONS);
  const cues: PerformanceCue[] = [
    { type: 'scene', alt: '山口集 · 酒楼窗下' },
    { type: 'title', kicker: '自己报的名字', text: '跑堂的耳朵' },
    {
      type: 'narration',
      text: '小二搬了张矮凳，在你桌边坐下。他手里夹着几张纸，最上头一张折了角，写着哪一日有船。',
    },
    {
      type: 'line',
      speaker: 'waiter',
      text: '你先吃。这些是客人留下的路帖，去各家山门怎么搭车、怎么坐船，上头都写着。你想打听哪一家？我给你找。',
    },
    { type: 'mark', id: 'ask' },
    {
      type: 'choice',
      options: sects.map(({ id, name }) => ({
        label: gossip[id]?.question ?? name + '呢？',
        jump: id,
      })),
    },
  ];
  for (const { id, name } of sects) {
    const localStory = gossip[id]?.cues;
    const landmark = getSectLandmarkBySectId(id);
    cues.push(
      { type: 'mark', id },
      ...(localStory ?? [
        {
          type: 'line',
          speaker: 'waiter',
          text: '这家的客人我没碰上过。你等我找找，有张帖子倒记着他们山门前的路。',
        },
        ...(landmark
          ? [
              {
                type: 'letter' as const,
                title: name,
                text: landmark.description,
              },
            ]
          : []),
      ]),
    );
    const options: Extract<PerformanceCue, { type: 'choice' }>['options'] = [];
    if (!available || available.has(id)) {
      options.push({ label: '去' + name + '看看。', outcome: id });
    } else {
      cues.push({
        type: 'line',
        speaker: 'waiter',
        text: '这家收徒有条件，你眼下还达不到。要不要再问一家？',
      });
    }
    options.push({ label: '再问一家。', jump: 'ask' });
    cues.push({ type: 'choice', options });
  }
  cues.push({ type: 'end', outcome: 'done' });
  return parsePerformanceScript({
    id: 'mountain-tavern',
    title: '跑堂的耳朵',
    requires: [],
    cast: {
      player: { name: '你' },
      waiter: { name: '酒楼小二', portrait: 'icon:portrait-merchant-m' },
    },
    cues,
  });
}

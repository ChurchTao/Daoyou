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
    question: '元武国的红尘剑宗呢？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '我舅在元武国摆渡。那儿有个背剑的姑娘，三天两头来坐他的船。有一回缆绳断了，她踩着剑先过去，把绳头送回他手上。我舅吓了一跳，问她既会飞，何苦天天给他两个钱。',
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
        text: '收啊。去年一个南边来的和尚在檐下化缘，我拿了个冷馒头给他。他攥着馒头等我把账算完，再递回来的时候，还往外冒热气呢。',
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
        text: '昆吾山。上回有个运药苗的在我这儿歇脚，苗都蔫了，正跟车夫吵呢。天衍来的女客听了半天，管我要半碗井水。她蹲在车边掐了几下诀，水才沾着泥，原先趴在筐沿上的叶子，一片片全支起来了。',
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
        text: '到冥海得走水路。给那边运油的船老大说，他师弟掉下船那晚，连个水花都没见着。幽都的人在岸上点一盏灯，管他要那小子的乳名。越少人知道的越好。',
      },
      {
        type: 'line',
        speaker: 'waiter',
        text: '我问他第二日怎么样。那船老大说，早上叫人推醒，睁眼就是他师弟，过来讨一件干衣裳。',
      },
    ],
  },
  jiujie: {
    question: '九劫天宫也在招人？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '我光见过他们下来买瓦。买瓦的人背着刀，有个伙计伸手要替他挂，手才挨到鞘，啪的一声，连攥在手心的抹布都烧了个洞。',
      },
      {
        type: 'line',
        speaker: 'waiter',
        text: '那客人说刀里的雷还没炼透，也不敢再搁下，抱着刀喝完一碗茶。掌柜那天也没催他腾桌。',
      },
    ],
  },
  bailu: {
    question: '在白鹿书院能修仙么？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '去年正月，店前头有人为了半吊钱打架，两根扁担都举起来了。晋京来的一个书生隔着窗叫了声放下。你猜怎么着，两根扁担一齐落地。我蹲在灶后头，手里还掉了把菜刀。',
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
    question: '方才那姑娘是万窍山的？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '是。她上回坐的也是你这桌。吃着饭忽然叫我下楼，看看酒瓮底下漏没漏。我说你隔着一层楼板也闻得着酒？她说一滴一滴往下掉，我都替你数到七了。',
      },
      { type: 'narration', text: '你低头贴近桌沿，只听见楼下有人在剁姜。' },
    ],
  },
  xiaoyue: {
    question: '百兽崖的人常下山么？',
    cues: [
      {
        type: 'line',
        speaker: 'waiter',
        text: '有一个认得。他吃面得坐窗边，碗里切几片肉。人一低头，窗外就伸进一只爪子。我头回拿筷子去敲，他连忙按着我手，说是他师兄。',
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
      text: '你先吃。西去东去的路，这张写半截，那张又写半截。你说个山门的名字，我给你找。',
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
        text: '我瞧瞧。你如今上去，人家也不收。再看看旁的？',
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

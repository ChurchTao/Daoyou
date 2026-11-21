import {
  parsePerformanceScript,
  type PerformanceCue,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';
import { getSectOrganizationDefinition } from '../sect-organization/definitions.js';
import highWater from './data/mountain-high-water.json' with { type: 'json' };

type GateLine = [speaker: 'player' | 'clerk', text: string];

const introductions: Record<string, { backdrop: string; lines: GateLine[] }> = {
  lingxiao: {
    backdrop: 'lingxiao.webp',
    lines: [
      ['player', '刚才在断桥渡我的，也是红尘剑宗的弟子？我能学她那样御剑么？'],
      [
        'clerk',
        '是本门的。我们这儿主修剑法。新来的先练手上这把剑，练稳了再学御剑。她今日在桥上帮了谁、遇见什么险，回来还要往剑录阁记一笔。',
      ],
      ['player', '渡个人也要记在剑谱上？'],
      [
        'clerk',
        '阁里另有本册子记这些事。祖师从前在城里给人磨剑，受过街坊的照应。后来在山上收了徒，常让徒弟下山帮忙。碰见难办的事就记下来，下一个去的人心里也好有个数。',
      ],
    ],
  },
  wuxiang: {
    backdrop: 'wuxiang.webp',
    lines: [
      [
        'player',
        '方才门口那位师兄，一见面就问我的脚。咱们这儿修行，也教人治伤么？',
      ],
      [
        'clerk',
        '教。早些年寺里就在莲池边给上山打水的人看病。现在也有弟子专学怎么用法术救人、护住同伴。你去石坪上看看，那边还有一群练拳脚的，遇着要动手的事，他们先上。',
      ],
      ['player', '练拳的和给人看病的，都住在这寺里？'],
      [
        'clerk',
        '是啊，吃饭还坐一桌。石坪上哪个练得太狠，晚上也得去找那几个会治伤的。',
      ],
    ],
  },
  tianyan: {
    backdrop: 'tianyan.webp',
    lines: [
      ['player', '方才有个师兄追着雨跑，说要接水炼药。你们这儿主要教炼丹么？'],
      [
        'clerk',
        '丹房自有人教。我们天衍最擅长的是五行法术，讲究几门法术搭着用。比如交手时，先用一道木行法术，再接一道火法，火就能烧到更多对手。',
      ],
      ['player', '这是祖师传下来的法子？'],
      [
        'clerk',
        '对。早年那几座护山阵各自都快撑不住了，祖师衡玑子把它们接在一处，让剩下的灵气从一座流到另一座，才救了回来。这几座阵还在五峰底下。',
      ],
    ],
  },
  youdu: {
    backdrop: 'youdu.webp',
    lines: [
      [
        'player',
        '我坐船来的，一上岸就有人提灯来接。听说幽都的人也用灯给走散的魂引路？',
      ],
      [
        'clerk',
        '接船那盏是照路的。要找走散的魂，得另点招魂灯，再喊它认得的名字。开山那几位早年就在打过仗、闹过疫病的地方做这个，替找不着路的魂寻个归处。',
      ],
      ['player', '这门法术跟人交手的时候也能用么？'],
      [
        'clerk',
        '能。门里有人会拦住敌人的魂，让他动作慢下来，有人会用魂毒，让伤隔一阵再发作。记住一条门规，不能把活人完整的魂拘来给自己使唤。',
      ],
    ],
  },
  jiujie: {
    backdrop: 'jiujie.webp',
    lines: [
      ['player', '刚才一道雷劈下来，石阶都在震。你们怎么敢在这儿住？'],
      [
        'clerk',
        '祖师刚上山时，屋顶也叫雷劈坏过。后来他学会了拿刀引雷，能把雷引到离屋子远些的地方。有人见山上住得下了，才敢来跟他学。你方才在石碑下等，也是为了避开那一道雷。',
      ],
      ['player', '那我来学雷法，也得拿刀去接雷么？'],
      [
        'clerk',
        '入门先听教习讲。喜欢用兵器的，可以学把雷引进兵器，近身交手时再放出去。喜欢施法的，可以学隔着一段路把雷引到对手身上。你先想想自己喜欢哪种打法。',
      ],
    ],
  },
  bailu: {
    backdrop: 'bailu-v1.webp',
    lines: [
      ['player', '门口那位师兄还在背书。来白鹿书院求仙，也要先读书么？'],
      [
        'clerk',
        '要读，也要练字。我们这里教人把灵力用在说出的话、写下的字里。练成了，有人一句话就能叫对手施不出法术，有人写一篇文章就能拿去驱邪。',
      ],
      ['player', '我在家只认过几个字，跟得上么？'],
      [
        'clerk',
        '跟得上，读不明白就问。书院从前是间草堂，连京城摆摊的人也能进来听课。刚才给你领路那孩子，头一回来，还得拿手指一字一字点着念。',
      ],
    ],
  },
  wanqiao: {
    backdrop: 'wanqiao.webp',
    lines: [
      [
        'player',
        '方才领我的姑娘，早上拿竹管录话给她爹听。这也是万窍山教的么？',
      ],
      [
        'clerk',
        '是。门里教的是用声音施法，那竹管就能把说过的话留住，捎去别处放给人听。祖师当年听风吹过石壁上的洞，觉得像有人在吹笛。他后来练到不用笛子，单靠呼吸就能把灵力送进声音里。',
      ],
      ['player', '那要跟人交手，声音也能伤人？'],
      [
        'clerk',
        '能。有人把声音放开，一声就能打到好几个。也有人把声音留在对手身上，当时听不出多大动静，过一会儿那股劲还会发作。',
      ],
    ],
  },
  xiaoyue: {
    backdrop: 'xiaoyue.webp',
    lines: [
      ['player', '我带了只猫。来百兽崖学艺，是不是得带着灵兽练？'],
      [
        'clerk',
        '你想跟它一块儿练，门里有人教怎么跟灵兽配合。想自己练，也可以照着野兽扑打的样子练身手，练到后来，自己就能变出兽形。',
      ],
      ['player', '路上那群鹿，也是门里养的么？'],
      [
        'clerk',
        '是野鹿。早年山里发大水，头一辈门人就是跟着往高处跑的兽群，才摸到这片崖。如今人走石阶，鹿还走山里的老路。碰在一处，就等等它们。',
      ],
    ],
  },
};

export function getMountainGateBackdrop(sectId: string) {
  const file = introductions[sectId]?.backdrop;
  return file ? '/assets/sect/onboarding/' + file : undefined;
}

const arrivals: Record<
  string,
  { title: string; arrival: string; reply: string; speaker?: string }
> = {
  wuxiang: {
    title: '石门底下',
    arrival:
      '绕过莲池，石门底下坐着个赤脚和尚，正用针挑脚后跟的刺。你问管收徒的人在哪儿。他抬头看了看你，把门槛上干净的那一半让出来。',
    reply:
      '管名册的在后院。你先坐会儿，我看你一路上都在跛脚，莫不是鞋里也进了刺？',
  },
  tianyan: {
    title: '雨过山梁',
    arrival:
      '你上昆吾山时，东峰刚下起雨。你在廊下等一个捧碗的弟子经过，打算问他去哪儿拜师。他正探着身子往檐外接雨。',
    reply:
      '问收徒的事？去廊子那头，那儿有人管名册。劳驾往里让让，我还差半碗雨水才够炼药。',
  },
  youdu: {
    title: '灯落在水里',
    arrival:
      '船至无日关，岸上的人提灯来接。你等船头靠实了才敢迈步。那人提灯走出几步，灯的倒影还停在水里。你回头又看了一眼，给他落下好远。',
    reply:
      '脚下当心。刚落过潮，第二级石阶还滑。上去就到山门了，我领你去见管名册的。',
  },
  jiujie: {
    title: '石阶上等雷',
    arrival:
      '上天阶前，领路的弟子把你拦在一块石碑底下。你随他站了一阵。一道白光落到上头，石阶猛一震，几粒碎石越过你的鞋尖滚下去。',
    reply:
      '这道雷过去了，咱们再上。你要问拜师的事，到了顶上找司雷。腿软就扶栏杆，别赶。',
  },
  bailu: {
    title: '松庭里背书',
    arrival:
      '晋京城外，白鹿书院的门敞着。松树下蹲着个背书的人，背到一句卡了壳，就低头看膝上的书。你上前问路，他慌忙用袖子盖住书页。',
    reply: '我以为先生回来了。找掌籍啊？我也得过去，等我把这两句背完。',
  },
  wanqiao: {
    title: '隔溪答话',
    speaker: '青衣姑娘',
    arrival:
      '你进了太岳深谷，问桥头补瓦的人从哪儿进山。话刚落，倒是隔溪竹屋里有人应你。你认得这个声音。清早在泉边，她对着竹管说了好几回话。',
    reply:
      '我给你领路。踩中间那两块石头，鞋就湿不了。要是抱着猫过不来，我拿板子给你搭一搭。',
  },
  xiaoyue: {
    title: '等鹿过去',
    arrival:
      '去百兽崖的石径走到尽头，挑山货的人把担子搁下了。前头一行鹿正过路，最小那只下不去石坎。穿葛衣的门人蹲在几步外等着，一直等到它跳下去，才招手让你们过去。',
    reply: '鹿都过去了，来吧。我领你去找管名册的，石阶还得往上走一段。',
  },
};

export function createMountainGateArrival(
  sectId: string,
  admission: 'join' | 'member' | 'visit',
  backLabel: string,
  options?: { study?: PerformanceScript; admissionBlock?: string },
) {
  const { study, admissionBlock } = options ?? {};
  const { name } = getSectOrganizationDefinition(sectId);
  const entry = arrivals[sectId] ?? {
    title: '到了山门',
    arrival:
      '你按路帖走到石阶尽头，正碰见有人扫地。你多走了两步，绕开他脚边扫成一堆的叶子。',
    reply: '求师的？里边请。过了院子就有人管名册。',
  };
  const alt = name + ' · 山门';
  const src = getMountainGateBackdrop(sectId);
  const gate =
    sectId === 'lingxiao' && !study ? parsePerformanceScript(highWater) : null;
  const introduction: GateLine[] = introductions[sectId]?.lines ?? [
    ['player', '想在这儿学艺，该去问谁？'],
    ['clerk', '门里有教习带新弟子。你若想留下，我给你指路。'],
  ];
  const arrivalCues: PerformanceCue[] = study
    ? [
        { type: 'scene', alt: '山脚 · 接引亭' },
        {
          type: 'narration',
          text: '守阵的人问清你要去哪家，叫你抱稳咪咪。你踏进石阵，还能听见渡埠上叫卖的声音。再迈一步，身后就听不见人声了。你抬头看见了山门。',
        },
        ...study.cues
          .slice(0, -1)
          .map((cue) => (cue.type === 'scene' ? { ...cue, src } : cue)),
      ]
    : gate
      ? gate.cues.slice(0, -1)
      : [
          { type: 'scene', alt, src },
          { type: 'title', kicker: '自己报的名字', text: entry.title },
          { type: 'narration', text: entry.arrival },
          { type: 'line', speaker: 'guide', text: entry.reply },
        ];
  const choices: Extract<PerformanceCue, { type: 'choice' }>['options'] = [];
  if (admission !== 'visit') {
    choices.push({
      label: admission === 'join' ? '拜入' + name : '回本宗核名',
      outcome: 'enter',
    });
  }
  choices.push({ label: backLabel, outcome: 'back' });
  return parsePerformanceScript({
    id: study ? 'mine-gate-study-' + sectId : 'mountain-gate-' + sectId,
    title: study?.title ?? gate?.title ?? entry.title,
    requires: ['receptionist', ...(study?.requires ?? [])],
    cast: {
      player: { name: '你' },
      guide: { name: entry.speaker ?? '山门弟子' },
      ...gate?.cast,
      ...study?.cast,
      clerk: { name: '{receptionist}' },
    },
    cues: [
      ...arrivalCues,
      { type: 'scene', alt: name + ' · 名册前', src },
      ...(study
        ? []
        : ([
            {
              type: 'narration',
              text: '你走到名册前。案后的人搁了笔，把旁边的凳子往你这边推了推。',
            },
            {
              type: 'line',
              speaker: 'clerk',
              text:
                admission === 'join'
                  ? '是来问拜师的事？坐吧，想知道什么，尽管问。'
                  : '坐吧。门里有什么事想问？',
            },
            ...introduction.map(([speaker, text]): PerformanceCue => ({
              type: 'line',
              speaker,
              text,
            })),
          ] satisfies PerformanceCue[])),
      {
        type: 'line',
        speaker: 'clerk',
        text:
          admission === 'join'
            ? '你若定了，我就给你记名。想再看看，也可以。'
            : admission === 'member'
              ? '要核名的话，把名字报给我，我在册上给你找找。'
              : study
                ? '有空再来。回去还走方才那座阵。'
                : '有空再来坐。下山慢些，顺着来时的路走。',
      },
      ...(admission === 'join'
        ? [
            {
              type: 'narration' as const,
              text: '确认后，你会成为本宗弟子。日后想换宗门，又想保留已练的心法，需要用欺天符。',
            },
          ]
        : []),
      ...(admission === 'visit' && admissionBlock
        ? [{ type: 'narration' as const, text: admissionBlock }]
        : []),
      { type: 'choice', options: choices },
      { type: 'end', outcome: 'done' },
    ],
  });
}

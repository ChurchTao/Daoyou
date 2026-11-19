import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import { getSectOrganizationDefinition } from '../sect-organization/definitions.js';
import highWater from './data/mountain-high-water.json' with { type: 'json' };

const introductions: Record<string, { backdrop: string; lines: string[] }> = {
  lingxiao: {
    backdrop: 'lingxiao.webp',
    lines: [
      '从这儿往下瞧，能看见城里卖布的那条街。祖师早年在那儿替人磨剑，受过街坊不少照应。后来在山上开了门，他那把磨石也搬了上来，还在剑录阁。',
      '阁里的旧书，有些你一翻就是剑谱，有些写的全是下山碰见的人和事。你在桥上遇见的那个师姐，回来也得往上头添一笔。今儿渡了谁，遇着什么险，她自己写。',
    ],
  },
  wuxiang: {
    backdrop: 'wuxiang.webp',
    lines: [
      '方才那口池子，原是山民上来取水的地方。早年几位师祖在池边给人看病，谁赶夜路，就在这门底下借一宿。如今每逢雨大，我们照旧把西厢留着。',
      '门里的功课，有人在禅房持愿，养身救人。也有人去石坪上炼那一身血气，练得狠，伤药就得随身带。一个院里吃饭，碗筷搁的是同一张桌。',
    ],
  },
  tianyan: {
    backdrop: 'tianyan.webp',
    lines: [
      '早年五处灵脉一齐衰了，山下的护阵撑不住。祖师衡玑子把各阵剩下的灵气挨着接起来，从木气接到火，转了一圈，又养回木上。那几座阵重新走得动了，如今还在五峰底下。',
      '各峰都有功课。药圃里的弟子得会养木，还得知道上游几时肯放水。学到后来你就明白，刚使过的那道术，会给下一道术留点东西。出门跟人交手，也一样要算在内。',
    ],
  },
  youdu: {
    backdrop: 'youdu.webp',
    lines: [
      '早先门里那几位只是收殓游魂的修士。打过仗的地方，遭了疫的村子，夜里还有人在叫亲人的名字，他们就提灯去看看。有些魂一唤便归，有些走散得久了，得慢慢寻。',
      '这门手艺传下来，能给失魂的人指路，也能把人的魂从身上引开。你若进门，有一条得记得牢。完整的生魂，谁也不许拘来给自己使唤。',
    ],
  },
  jiujie: {
    backdrop: 'jiujie.webp',
    lines: [
      '天阶上头有间旧庐。那是祖师守雷的地方，山下运上去的第一批瓦，没过一夜就剩一半。后来他能把劫雷引进刀里，才有人跟着搬上去住。',
      '有人把雷纳进兵刃，走近了才放出去。有人在远处结印，让天上的雷找准落处。你刚进门，这两样先看着学。听见铜钟响，马上把手里东西搁下，跟人走。',
    ],
  },
  bailu: {
    backdrop: 'bailu-v1.webp',
    lines: [
      '这地方早先是个讲学的草堂，连京城摆摊的人也能进来旁听。后来人多，屋舍才一间间添起来。松庭门朝外开，就是照旧时的规矩。',
      '书读熟了得出去试。有人靠一句话止住争斗，有人把文章写成驱邪的手段。可别嫌背书慢。刚才给你领路那孩子，头一回来，也说自己认得的字够用了。',
    ],
  },
  wanqiao: {
    backdrop: 'wanqiao.webp',
    lines: [
      '谷里从前就有人削竹做笛。祖师住进来，循着风声找着石壁底下那几处空窍，后来才教人怎么从呼吸里炼出一道清音。',
      '他们练久了，隔门也听得出谁在胡乱换气。有弟子把声放开，一谷都听得见。有人把声音收得极细，落到对手身上，隔了几息还会再响。你愿意来，先从廊下那根老竹练起。',
    ],
  },
  xiaoyue: {
    backdrop: 'xiaoyue.webp',
    lines: [
      '老人说，山里涨大水那回，先往高处跑的是兽群。头一辈门人跟它们摸到了这片崖，后来也给山下的人凿了上来的石阶。路边几个喝水的槽，人和兽都用。',
      '进了崖，有人学兽的步子和吐息，自己练成一身本领。也有人跟一只灵兽搭伙，两边学着照应。你家这只猫肯不肯跟着操练，得看它自己。',
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
      '绕过莲池，石门底下坐着个赤脚和尚，正拿鞋凿挑脚后跟的刺。你等他抬头，才问名册在哪儿。他低着头往里挪了挪，把门槛上干净的那一半让给你。',
    reply: '先坐。我看你一脚深一脚浅的，脱了鞋我瞧瞧。',
  },
  tianyan: {
    title: '雨过山梁',
    arrival:
      '你上昆吾山时，东峰赶着下了场雨。几只背篓才收进廊下，雨脚已经过了山梁。檐头一个弟子捧着碗，追着雨往外跑，险些同你撞个满怀。',
    reply: '借过！我得接半碗。那炉药昨晚就等着这一场雨。',
  },
  youdu: {
    title: '灯落在水里',
    arrival:
      '船至无日关，岸上的人提灯来接。你等船头靠实了才敢迈步。那人提灯走出几步，灯的倒影还停在水里。你回头又看了一眼，给他落下好远。',
    reply: '脚下当心。刚落过潮，第二级石阶还滑。',
  },
  jiujie: {
    title: '石阶上等雷',
    arrival:
      '上天阶前，领路的弟子把你拦在一块石碑底下。你随他站了一阵。一道白光落到上头，石阶猛一震，几粒碎石越过你的鞋尖滚下去。',
    reply: '走吧。下一声要等一会儿。别赶，腿软就扶栏杆。',
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
      '踩中间那两块石头，鞋就湿不了。要是抱着猫过不来，我拿板子给你搭一搭。',
  },
  xiaoyue: {
    title: '等鹿过去',
    arrival:
      '去百兽崖的石径走到尽头，挑山货的人把担子搁下了。前头一行鹿正过路，最小那只下不去石坎。穿葛衣的门人蹲在几步外等着，一直等到它跳下去，才招手让你们过去。',
    reply: '来。我领你去找管名册的。猫抱高些，头上那根枝是湿的。',
  },
};

export function createMountainGateArrival(
  sectId: string,
  admission: 'join' | 'member' | 'visit',
  backLabel: string,
) {
  const { name } = getSectOrganizationDefinition(sectId);
  const entry = arrivals[sectId] ?? {
    title: '到了山门',
    arrival:
      '你按路帖走到石阶尽头，正碰见有人扫地。你多走了两步，绕开他脚边扫成一堆的叶子。',
    reply: '求师的？里边请。过了院子就有人管名册。',
  };
  const alt = name + ' · 山门';
  const src = getMountainGateBackdrop(sectId);
  const gate = sectId === 'lingxiao' ? parsePerformanceScript(highWater) : null;
  const arrivalCues: PerformanceCue[] = gate
    ? gate.cues.slice(0, -1)
    : [
        { type: 'scene', alt, src },
        { type: 'title', kicker: '自己报的名字', text: entry.title },
        { type: 'narration', text: entry.arrival },
        { type: 'line', speaker: 'guide', text: entry.reply },
      ];
  const options: Extract<PerformanceCue, { type: 'choice' }>['options'] = [];
  if (admission !== 'visit') {
    options.push({
      label: admission === 'join' ? '拜入' + name : '回本宗核名',
      outcome: 'enter',
    });
  }
  options.push({ label: backLabel, outcome: 'back' });
  return parsePerformanceScript({
    id: 'mountain-gate-' + sectId,
    title: gate?.title ?? entry.title,
    requires: ['receptionist'],
    cast: {
      ...gate?.cast,
      guide: { name: entry.speaker ?? '山门弟子' },
      clerk: { name: '{receptionist}' },
    },
    cues: [
      ...arrivalCues,
      { type: 'scene', alt: name + ' · 名册前', src },
      {
        type: 'narration',
        text: '你在案前站定。管名册的人把手上的一页写完，才抬头与你说话。',
      },
      ...(
        introductions[sectId]?.lines ?? [
          '这几日也有人循着路帖来。你若有想学的，进门后可以先去问教习。',
        ]
      ).map((text): PerformanceCue => ({
        type: 'line',
        speaker: 'clerk',
        text,
      })),
      {
        type: 'line',
        speaker: 'clerk',
        text:
          admission === 'join'
            ? '听明白了就由你自己拿主意。肯留下，我给你记名。'
            : admission === 'member'
              ? '是本门弟子？把名字报来，我查一下册。'
              : '既已有师承，今儿便算来做客。你要再看看，改日尽管来。',
      },
      ...(admission === 'join'
        ? [
            {
              type: 'narration' as const,
              text: '确认拜入后会登记师承。日后无损转宗需用欺天符。',
            },
          ]
        : []),
      { type: 'choice', options },
      { type: 'end', outcome: 'done' },
    ],
  });
}

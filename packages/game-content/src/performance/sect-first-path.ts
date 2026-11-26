import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import type { SectCombatPathView } from '@daoyou/game-domain/sects';
import { getMountainGateBackdrop } from './mountain-gate-arrivals.js';

const lessons: Record<string, string> = {
  'lingxiao.path.zhanchen':
    '斩尘证道讲究一剑破防。对面守得严，你就等他露出空当。若这一剑打倒了人，收得住手，还能再递一剑。',
  'lingxiao.path.guiyi':
    '万剑归一适合久战。先练「断尘」，每出一剑都能蓄些剑意，越往后，剑上的劲越足。',
  'wuxiang.path.compassion':
    '佛心济世教你护人。给一位同伴留道印，你去给别人治伤的时候，这道印也能照应到他。',
  'wuxiang.path.wrath': '魔心修罗得上前打。先用拳撬开守势，瞧准破绽再补一拳。',
  'tianyan.path.hetu':
    '衍法天师讲究相生。木法用过，留一股木气在身上，再用它催火，火便能烧到旁边的敌手。这一路也学护身和疗伤。',
  'tianyan.path.luoshu':
    '执衡真君擅长拆别人的法术。譬如施过木法，再以金法接上，就能破去敌手身上的护持。',
  'youdu.path.soul_judge':
    '拘魂锁命要学拿魂。叫敌人手脚慢一拍，或是留下他的魂，叫旁人救不得。自家人倒下了，也能用所学把他拉回来。',
  'youdu.path.poison_master':
    '蚀魂摧形用魂毒。毒沾上就会一阵阵发作，趁它还没散，法术打在对手身上更重。',
  'jiujie.path.law':
    '霹雳真君要把雷引进兵器。雷蓄得越足，打下去越重。一记重的出完，有时得缓口气才能接着打。',
  'jiujie.path.thunder':
    '踏雷天尊直接引雷落地，能同时劈中几人。雷打出的印还在，你的法术打过去就更厉害。',
  'bailu.path.edict':
    '正言执律学的是制止。练到一句话能叫人住手、止住他的法术，也会教你几样护身的法子。',
  'bailu.path.song':
    '浩气文章先学点名。你挑准一个人，把记号留在他身上，「破邪」打过去，连他身边的人也躲不开。',
  'wanqiao.path.resonance':
    '天籁要叫一声传得远，几个人都听得见。第一声打过了，有时还有余音，能再伤一次人。',
  'wanqiao.path.subtlety':
    '入微学的是把声留住。人走了，身上那点声音还会发作。你再把它引响，伤得更重。',
  'xiaoyue.path.blood':
    '百相化形先照着山兽练身手。练深了，你自己就能化作兽形，学它们扑击、冲阵。',
  'xiaoyue.path.bond':
    '灵兽同契要和你的灵兽一道练。譬如你用「狮搏」打中人，它就能借你这股劲追上去。',
};

export function createSectFirstPath(
  sectId: string,
  place: string,
  paths: readonly SectCombatPathView[],
  afterMorningDemo = false,
) {
  const teacher = afterMorningDemo ? 'instructor' : 'path_teacher';
  const conversation: PerformanceCue[] = afterMorningDemo
    ? [
      {
        type: 'line',
        speaker: 'teacher',
        text: '看好了就挑一路先练。想换路时，再来找我。',
      },
      {
        type: 'letter',
        text: '换流派不花灵石，心法照用。两路分别修炼经脉，换回来可以接着练。',
      },
    ]
    : [
        {
          type: 'line',
          speaker: 'player',
          text: '先生，听说门里有两种练法。我要怎么挑？',
        },
        ...paths.map((path): PerformanceCue => ({
          type: 'line',
          speaker: 'teacher',
          text: lessons[path.id] ?? path.name + '。' + path.description,
        })),
        {
          type: 'line',
          speaker: 'player',
          text: '我要是先学一路，过些日子想换呢？',
        },
        {
          type: 'line',
          speaker: 'teacher',
          text: '来找我就能换。灵石免了，心法照旧能用。两路的经脉各练各的，日后换回去，你还能接着练。',
        },
      ];
  const cues: PerformanceCue[] = [
    { type: 'scene', alt: place, src: getMountainGateBackdrop(sectId) },
    { type: 'title', kicker: place, text: '先从哪一路学' },
    ...conversation,
    {
      type: 'choice',
      options: paths.map((path) => ({
        label: '先修' + path.name,
        outcome: path.id,
      })),
    },
    { type: 'end', outcome: 'done' },
  ];
  return parsePerformanceScript({
    id: 'sect-first-path-' + sectId,
    title: '先从哪一路学',
    requires: [teacher],
    cast: { player: { name: '你' }, teacher: { name: `{${teacher}}` } },
    cues,
  });
}

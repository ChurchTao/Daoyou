import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import type { SectCombatPathView } from '@daoyou/game-domain/sects';
import { getMountainGateBackdrop } from './mountain-gate-arrivals.js';

const lessons: Record<string, string> = {
  'lingxiao.path.zhanchen':
    '想找准时机重打一剑，就学斩尘证道。这一路能破开对手的防御。要是打倒一个，还能找机会紧接着再出一剑。',
  'lingxiao.path.guiyi':
    '万剑归一擅长打久一些。你每使出一次叫「断尘」的剑招，就积一点剑意。积够了，后面的剑招都能打得更重。',
  'wuxiang.path.compassion':
    '佛心济世是救人、护人的练法。比如你给队友留一道印，转头去给另一个人治伤，带印的那个也能跟着受益。',
  'wuxiang.path.wrath':
    '想自己上前跟人打，就学魔心修罗。你出拳有机会打出破绽，下一拳再打中，就能借着那处破绽多伤他一分。',
  'tianyan.path.hetu':
    '衍法天师擅长把法术接起来打。比如先用木行法术，把木的灵力留一点在自己身上。接着施火法，借这股木气，火就能多烧到一个对手。这一路也有疗伤和护身的法术。',
  'tianyan.path.luoshu':
    '执衡真君也会先用木行法术。接下来若用金行法术，就能把对手身上已有的护持打散。想拆掉别人的法术、打乱对方的招数，可以先学这路。',
  'youdu.path.soul_judge':
    '拘魂锁命能让敌人出手变慢。对手若倒下了，你还能拦住他的魂，让人没法救他起来。换成自己这边有人倒地，也有法子救回来。',
  'youdu.path.poison_master':
    '蚀魂摧形靠魂毒伤人。法术打过了，沾上的毒还会一阵一阵发作。等你学深些，趁对手还中了毒再出招，打得也更疼。',
  'jiujie.path.law':
    '霹雳真君把雷引进兵器，能集中力气打一个，也能挥开兵器打几个。出手时引的雷越多，招式就越重。真用了重招，有时得歇一回合才能再打。',
  'jiujie.path.thunder':
    '踏雷天尊用法术引雷，可以一下劈中好几个对手。挨过雷的人身上会留下印记，下回你再用法术打他们，伤得更重。',
  'bailu.path.edict':
    '正言执律靠一句话制住对手。你可以叫他暂时使不出法术，也可以拦他动手。遇上对方先攻过来，这一路还有护住自己的办法。',
  'bailu.path.song':
    '浩气文章擅长主动进攻。你先点一个人的名，给他留个记号。接着使一招叫「破邪」的法术，先打那个人，还能打到别的对手。',
  'wanqiao.path.resonance':
    '天籁适合一下打好几个对手。第一声过去，有的招式还会再响一次。要是响了，就能再打一下。',
  'wanqiao.path.subtlety':
    '入微是把声音留在对手身上。声音留着的时候，他隔一会儿就要受一次伤。你再施法把留在他身上的声音引响，后面伤得还会更重。',
  'xiaoyue.path.blood':
    '百相化形练的是你自己的身手。你照着野兽的样子练，日后能化出兽形。想扑过去打一个人，或是冲上去打倒一片，都有相应的招。',
  'xiaoyue.path.bond':
    '灵兽同契要和你自己的灵兽一块儿上场。譬如你用「狮搏」这一招打中了对手，灵兽下一次出手就能借你的劲，打得更重。',
};

export function createSectFirstPath(
  sectId: string,
  place: string,
  paths: readonly SectCombatPathView[],
) {
  const cues: PerformanceCue[] = [
    { type: 'scene', alt: place, src: getMountainGateBackdrop(sectId) },
    { type: 'title', kicker: place, text: '先从哪一路学' },
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
      text: '回来找我就能换，不收灵石。学过的心法两路都能用。以后你给哪一路练的经脉，就给那一路留着，换回来还能接着练。你先挑一路，待会儿跟着练一遍。',
    },
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
    requires: ['path_teacher'],
    cast: { player: { name: '你' }, teacher: { name: '{path_teacher}' } },
    cues,
  });
}

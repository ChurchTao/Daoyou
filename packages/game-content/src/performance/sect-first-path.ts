import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import type { SectCombatPathView } from '@daoyou/game-domain/sects';
import { getMountainGateBackdrop } from './mountain-gate-arrivals.js';

const lessons: Record<string, string> = {
  'lingxiao.path.zhanchen':
    '斩尘证道，先把力收在一剑上。看清对面哪儿护不住，再破开防御。若能击倒一个，你还有机会顺势追下一剑。',
  'lingxiao.path.guiyi':
    '万剑归一，得多给自己几剑的工夫。每用成一次断尘，剑意便厚一分。剑意攒足了，后面出招都能借上那股力。',
  'wuxiang.path.compassion':
    '佛心济世先给同伴留一道本愿印。你用愿法医伤、护人，印记那头也能分到一份。有人替你挡在前面，你得记得看顾他。',
  'wuxiang.path.wrath':
    '魔心修罗靠近身交手。头一下打出破绽，下一下还得打在那处。显相的时候，烈念越盛，你那一击就越重。',
  'tianyan.path.hetu':
    '衍法天师多用相生。先留一道木行法印，再出焚天流火，火就能多烧到一处。这一路也会调气护身，需要时能疗伤。',
  'tianyan.path.luoshu':
    '执衡真君多用相克。对手正得着别人的术护持，你可先留木印，再接金行法术去拔掉那层增益。遇着比你先得势的人，这一路便好用。',
  'youdu.path.soul_judge':
    '拘魂锁命，手得稳。你能拖慢敌人的动作，拦他魂魄归身，也能把倒下的同伴唤回来。先看场上哪一个人最要紧。',
  'youdu.path.poison_master':
    '蚀魂摧形，把魂毒打进去，几息之内它还要发作。敌人身上已有魂毒，再下手更占便宜。碰见气长的对手，也有办法慢慢耗他。',
  'jiujie.path.law':
    '霹雳真君纳雷入兵。能重击一人，也能挥兵横扫。多引一重，手上的力便增一分。出重招耗气，打完有时得缓上一回合。',
  'jiujie.path.thunder':
    '踏雷天尊隔空御雷。雷落在几个人身上，便能各留一道印。下次对着印出法，伤得更重。引雷入体之后，也可照管更多敌人。',
  'bailu.path.edict':
    '正言执律，先管住对面出什么招。言令可封法术，也可拦拳脚。护身用得好，还能挡掉一回合里头一记打到你身上的伤害或术法妨碍。',
  'bailu.path.song':
    '浩气文章擅长出手诛邪。先点出那人的名字，再施破邪，锋芒先去找他，余势还能及到别人。有志修攻伐的，多从这一路入手。',
  'wanqiao.path.resonance':
    '天籁讲究把一道声音放开。众窍鸣一起，前头好几个人都能中招。有时第一声过去还带出复响，又打一下。',
  'wanqiao.path.subtlety':
    '入微把细音留在对手身上。他当时兴许没觉出多少，过一阵还要受那道余声的伤。你再用引响，后面的发作就更重。',
  'xiaoyue.path.blood':
    '百相化形，先学兽怎么发力，再练到自己身上。化出兽形能近身破敌，也有招式能扫一片。练的是你自个儿的筋骨。',
  'xiaoyue.path.bond':
    '灵兽同契得带上你自己的灵兽。同它并肩时要彼此看着。你用狮搏打中了，它下一次扑咬或施法，便能借你的狮魂添一分力。',
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
      speaker: 'teacher',
      text: '来，坐近些。门里有两种练法，你听完再告诉我，眼下想先学哪一种。',
    },
    ...paths.map((path): PerformanceCue => ({
      type: 'line',
      speaker: 'teacher',
      text: lessons[path.id] ?? path.name + '。' + path.description,
    })),
    {
      type: 'line',
      speaker: 'teacher',
      text: '往后想换，回来跟我说一声就成，切换不用花灵石。两路的心法是共用的，经脉各记各的。你原先练到哪儿，回来还从哪儿接着练。',
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
    cast: { teacher: { name: '{path_teacher}' } },
    cues,
  });
}

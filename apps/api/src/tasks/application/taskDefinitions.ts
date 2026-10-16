import { BREAKTHROUGH_CHALLENGES } from '@daoyou/game-content/combat/breakthrough';
import type {
  TaskDefinition,
  TaskInstanceMetadata,
  TaskStageDefinition,
} from '@daoyou/game-domain/tasks';

type TaskLinkKind =
  | 'alchemy'
  | 'cultivator'
  | 'inn'
  | 'inventory'
  | 'market'
  | 'retreat'
  | 'challenge'
  | 'tasks'
  | 'training'
  | 'ranking';

export interface TaskStageTemplate extends TaskStageDefinition {
  links: Array<{
    label: string;
    kind: TaskLinkKind;
  }>;
}

export interface BreakthroughTaskDefinition extends Omit<
  TaskDefinition,
  'stages' | 'category' | 'fromRealm' | 'toRealm'
> {
  category: 'breakthrough_major';
  fromRealm: NonNullable<TaskDefinition['fromRealm']>;
  toRealm: NonNullable<TaskDefinition['toRealm']>;
  taskTheme: TaskInstanceMetadata['taskTheme'];
  stages: TaskStageTemplate[];
}

export type RuntimeTaskDefinition = BreakthroughTaskDefinition;

export interface TaskChallengeProfile {
  id: string;
  title: string;
}
const challengeProfiles: TaskChallengeProfile[] = Object.entries(
  BREAKTHROUGH_CHALLENGES,
).map(([id, spec]) => ({ id, title: spec.title }));

const breakthroughDefinitions: BreakthroughTaskDefinition[] = [
  {
    id: 'major_breakthrough_炼气_筑基',
    category: 'breakthrough_major',
    title: '筑基前引',
    summary: '先获得「破境凝神」状态，再渡过丹田气海凝成的阻滞，方可筑基。',
    fromRealm: '炼气',
    toRealm: '筑基',
    taskTheme: 'foundation',
    stages: [
      {
        id: 'foundation-pill',
        title: '凝破境意',
        description:
          '筑基前先服下筑基丹，获得「破境凝神」状态。筑基丹可在炼丹房用温稳灵材配合“冲关蓄势、辅助筑基”之类丹意炼制，也可去修仙坊市寻访成丹。',
        completionText: '破境凝神已成，药力可引灵气归府。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
          { label: '看任务中心', kind: 'tasks' },
        ],
        objectives: [
          {
            id: 'breakthrough-focus',
            kind: 'status_active',
            title: '具备「破境凝神」',
            description: '服用筑基丹或（任何含有「破境凝神」效果的丹药）获得',
            statusKey: 'breakthrough_focus',
          },
        ],
      },
      {
        id: 'foundation-trial',
        title: '定气海，立道基',
        description: '丹田沉积的浊息化作伏息石蟾，压住真气归流。将它降伏，才能令真气循脉归府，凝成稳固道基。',
        completionText: '气海已定，道基可立。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'win-foundation-challenge',
            kind: 'win_task_challenge',
            title: '战胜伏息石蟾',
            description: '稳住散乱气海，获得冲击筑基的资格。',
            challengeId: 'foundation_qi',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_筑基_金丹',
    category: 'breakthrough_major',
    title: '凝丹之机',
    summary: '先借丹药稳住冲关之势，再镇伏逸散火意凝成的离火丹螭，才能凝气成丹。',
    fromRealm: '筑基',
    toRealm: '金丹',
    taskTheme: 'core',
    stages: [
      {
        id: 'core-prep',
        title: '凝破境意',
        description:
          '结丹前需借降尘丹压住丹田火候，获得「破境凝神」状态。降尘丹可在炼丹房以“结丹、凝丹、冲关蓄势”之类丹意炼制，也可去修仙坊市寻访。',
        completionText: '破境凝神已成，可以直面离火丹螭。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
          { label: '看任务中心', kind: 'tasks' },
        ],
        objectives: [
          {
            id: 'breakthrough-focus',
            kind: 'status_active',
            title: '具备「破境凝神」',
            description: '服用降尘丹或（任何含有「破境凝神」效果的丹药）获得',
            statusKey: 'breakthrough_focus',
          },
        ],
      },
      {
        id: 'core-trial',
        title: '镇丹火，凝金丹',
        description: '凝丹之时，逸散火意凝成离火丹螭。镇住它，才能令丹火归炉、灵气归一。',
        completionText: '离火丹螭已散，丹田已能承住凝丹之势。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'win-core-challenge',
            kind: 'win_task_challenge',
            title: '镇伏离火丹螭',
            description: '收束丹火与灵力，获得冲击金丹的资格。',
            challengeId: 'core_condensation',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_金丹_元婴',
    category: 'breakthrough_major',
    title: '婴劫问心',
    summary: '元婴之前，最难过的不是碎丹，而是先稳住道心、渡过心魔。',
    fromRealm: '金丹',
    toRealm: '元婴',
    taskTheme: 'heart_demon',
    stages: [
      {
        id: 'nascent-mind',
        title: '先清心',
        description:
          '元婴问心之前，先用清心丹洗去识海杂念。清心丹可在炼丹房以“清心、定神、心魔”之类丹意炼制，也可去修仙坊市碰碰机缘。',
        completionText: '识海已稳，杂念稍歇。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
          { label: '看任务中心', kind: 'tasks' },
        ],
        objectives: [
          {
            id: 'clear-mind',
            kind: 'status_active',
            title: '具备「清心」',
            description: '可服用含有「清心」效果的丹药获得',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'nascent-heart-demon',
        title: '渡心魔劫',
        description: '碎丹之际，未解的妄念在识海映成照妄影。认出它所映照的自己，才能让新生元婴守住本心。',
        completionText: '心魔已斩，道心尚存。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'win-heart-demon',
            kind: 'win_task_challenge',
            title: '战胜照妄影',
            description: '赢下这一战，才能真正获得冲击元婴的资格。',
            challengeId: 'heart_demon_nascent',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_元婴_化神',
    category: 'breakthrough_major',
    title: '斩执念，叩化神',
    summary: '化神之前，先以护脉与清心稳住形神，再直面识海中映出的天劫。',
    fromRealm: '元婴',
    toRealm: '化神',
    taskTheme: 'tribulation',
    stages: [
      {
        id: 'deity-prep',
        title: '护脉清心',
        description:
          '化神前反噬极重，经脉与识海都要提前安顿。护脉丹、清心丹可在炼丹房按“护脉、清心、化神反噬”之类丹意炼制，也可去修仙坊市寻访。',
        completionText: '道体与识海都已做足准备。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'protect-meridians',
            kind: 'status_active',
            title: '具备「护脉」',
            description: '可服用含有「护脉」效果的丹药获得',
            statusKey: 'protect_meridians',
          },
          {
            id: 'clear-mind',
            kind: 'status_active',
            title: '具备「清心」',
            description: '可服用含有「清心」效果的丹药获得',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'deity-trial',
        title: '叩天门，承劫影',
        description: '神识将触及天地，天威凝成叩神雷鹤，以雷羽逼问元神。唯有承住它，元神才能独立。',
        completionText: '叩神雷鹤已破，元神不再为天威所摄。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'win-tribulation',
            kind: 'win_task_challenge',
            title: '战胜叩神雷鹤',
            description: '正面扛过化神前的叩神雷鹤，方可回静室正式冲关。',
            challengeId: 'tribulation_deity',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_化神_炼虚',
    category: 'breakthrough_major',
    title: '法则初窥',
    summary: '想破入炼虚，先积累感悟，再直面天地法则在虚空中留下的残影。',
    fromRealm: '化神',
    toRealm: '炼虚',
    taskTheme: 'law_insight',
    stages: [
      {
        id: 'void-insight',
        title: '补足感悟',
        description: '法则门槛极高，没有足够感悟便看不见炼虚门槛。',
        completionText: '感悟已足，可试着碰触法则边缘。',
        links: [
          { label: '返回静室', kind: 'retreat' },
          { label: '看任务中心', kind: 'tasks' },
        ],
        objectives: [
          {
            id: 'insight',
            kind: 'insight_at_least',
            title: '感悟达到 70',
            description: '先把感悟积累到足够高，再谈炼虚。',
            threshold: 70,
          },
        ],
      },
      {
        id: 'void-trial',
        title: '悟虚空，破法影',
        description: '虚空法则聚成缚虚断碑，碑上残环困住道意。击破法环，让自己的道意在虚空中站稳，才可踏入炼虚。',
        completionText: '缚虚断碑已破，道意已能穿过虚空。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'win-law-challenge',
            kind: 'win_task_challenge',
            title: '战胜缚虚断碑',
            description: '只有在正面对抗中稳住法则，才算真正摸到炼虚门槛。',
            challengeId: 'law_insight_void',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_炼虚_合体',
    category: 'breakthrough_major',
    title: '雷劫淬体',
    summary: '炼虚之后，形神相合之前，先稳住道体，再承住负岳雷鼋。',
    fromRealm: '炼虚',
    toRealm: '合体',
    taskTheme: 'tribulation',
    stages: [
      {
        id: 'body-prep',
        title: '稳道体',
        description:
          '合体前要先让道体能承住雷劫余威。护脉丹可在炼丹房按“护脉、稳固道体、承雷”之类丹意炼制，也可去修仙坊市寻访。',
        completionText: '道体准备已足，足可尝试承雷。',
        links: [
          { label: '返回静室', kind: 'retreat' },
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
        ],
        objectives: [
          {
            id: 'insight',
            kind: 'insight_at_least',
            title: '感悟达到 75',
            description: '更高层次的感悟能稳住神识与道体。',
            threshold: 75,
          },
          {
            id: 'protect-meridians',
            kind: 'status_active',
            title: '具备「护脉」',
            description: '可服用含有「护脉」效果的丹药获得',
            statusKey: 'protect_meridians',
          },
        ],
      },
      {
        id: 'body-trial',
        title: '承劫雷，合形神',
        description: '形神相合引动内外雷息，沉重雷压聚成负岳雷鼋。承住它的雷甲与重击，道体与元神才能真正相合。',
        completionText: '劫雷已伏，形神相合之路已明。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'win-body-challenge',
            kind: 'win_task_challenge',
            title: '战胜负岳雷鼋',
            description: '在雷劫压身之下仍能胜出，才配迈入合体。',
            challengeId: 'tribulation_body',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_合体_大乘',
    category: 'breakthrough_major',
    title: '大执念关',
    summary: '越往后越不是灵力之争，而是执念与道心之争。',
    fromRealm: '合体',
    toRealm: '大乘',
    taskTheme: 'heart_demon',
    stages: [
      {
        id: 'grand-prep',
        title: '先稳心神',
        description:
          '大乘门前最怕执念反噬，先以清心丹稳住心神。清心丹可在炼丹房按“清心、定神、斩执念”之类丹意炼制，也可去修仙坊市寻访。',
        completionText: '心神已定，可入更深层试炼。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'insight',
            kind: 'insight_at_least',
            title: '感悟达到 80',
            description: '更深的感悟能削弱执念纠缠。',
            threshold: 80,
          },
          {
            id: 'clear-mind',
            kind: 'status_active',
            title: '具备「清心」',
            description: '可服用含有「清心」效果的丹药获得',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'grand-trial',
        title: '照见大执，守住道心',
        description: '走到大乘门前，执念化作紧抱空匣的枯猿。它守着你不愿舍弃的一切，唯有放下，才能亲手解开最后的束缚。',
        completionText: '抱匣枯猿已斩，道心自此不受其缚。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'win-grand-challenge',
            kind: 'win_task_challenge',
            title: '战胜抱匣枯猿',
            description: '若连自身执念都压不下，大乘只会是一句空谈。',
            challengeId: 'inner_demon_grand',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_大乘_渡劫',
    category: 'breakthrough_major',
    title: '渡劫前奏',
    summary: '真正踏入渡劫前，要先承住前奏，确认自己没有被天道一击抹去。',
    fromRealm: '大乘',
    toRealm: '渡劫',
    taskTheme: 'tribulation',
    stages: [
      {
        id: 'tribulation-prep',
        title: '备渡劫身',
        description:
          '渡劫前要同时稳住道体与识海。护脉丹、清心丹可在炼丹房按“护脉、清心、渡劫”之类丹意炼制，也可去修仙坊市寻访。',
        completionText: '形神两端都已尽量稳住。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'insight',
            kind: 'insight_at_least',
            title: '感悟达到 85',
            description: '先让感悟足够深，再去摸渡劫门槛。',
            threshold: 85,
          },
          {
            id: 'protect-meridians',
            kind: 'status_active',
            title: '具备「护脉」',
            description: '可服用含有「护脉」效果的丹药获得',
            statusKey: 'protect_meridians',
          },
          {
            id: 'clear-mind',
            kind: 'status_active',
            title: '具备「清心」',
            description: '可服用含有「清心」效果的丹药获得',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'tribulation-trial',
        title: '迎天衡残钟',
        description:
          '渡劫门前，天道循你的气机凝成天衡残钟。每一声钟鸣都在丈量形神，这是正式天劫的先声，承住它，才有资格迎接真正的雷火。',
        completionText: '天衡残钟已退，形神足以面对渡劫天威。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'win-final-challenge',
            kind: 'win_task_challenge',
            title: '战胜天衡残钟',
            description: '若连天劫前奏都扛不住，便还不到正式渡劫的时候。',
            challengeId: 'heavenly_tribulation_final',
          },
        ],
      },
    ],
  },
];


const definitions: RuntimeTaskDefinition[] = [...breakthroughDefinitions];

const definitionMap = new Map(
  definitions.map((definition) => [definition.id, definition]),
);
const challengeProfileMap = new Map(
  challengeProfiles.map((profile) => [profile.id, profile]),
);

export function getTaskDefinition(definitionId: string) {
  return definitionMap.get(definitionId) ?? null;
}

export function getBreakthroughTaskDefinition(definitionId: string) {
  const definition = definitionMap.get(definitionId);
  return definition?.category === 'breakthrough_major' ? definition : null;
}

export function getBreakthroughTaskDefinitionByTransition(
  fromRealm: BreakthroughTaskDefinition['fromRealm'],
  toRealm: BreakthroughTaskDefinition['toRealm'],
) {
  return (
    breakthroughDefinitions.find(
      (definition) =>
        definition.fromRealm === fromRealm && definition.toRealm === toRealm,
    ) ?? null
  );
}

export function getTaskChallengeProfile(challengeId: string) {
  return challengeProfileMap.get(challengeId) ?? null;
}

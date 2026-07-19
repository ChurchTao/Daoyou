import { EnemyGenerator } from '@shared/engine/enemyGenerator';
import { buildPresetArtifact } from '@shared/engine/cultivator/creation/presetProducts';
import { hasActiveConditionStatus } from '@shared/lib/condition';
import type { Cultivator } from '@shared/types/cultivator';
import type {
  TaskDailyKind,
  TaskDefinition,
  TaskInstanceMetadata,
  TaskStageDefinition,
} from '@shared/types/task';
import type { DailyTaskDifficulty } from '@shared/engine/cultivation/exp-gain-strategies/types';
import { ServerEnemyCopyProvider } from '@server/lib/services/ServerEnemyCopyProvider';

const challengeEnemyGenerator = new EnemyGenerator({
  copyProvider: new ServerEnemyCopyProvider({
    enabled: process.env.NODE_ENV !== 'test',
  }),
});

const noviceGuardArtifact = buildPresetArtifact({
  name: '入门护身玉佩',
  slot: 'accessory',
  element: '木',
  description: '宗门交给新入道者的护身小器，灵光不盛，却足以挡住初次云游的几分凶险。',
  affixIds: ['artifact-panel-accessory-utility', 'artifact-panel-vitality'],
  realm: '炼气',
  realmStage: '初期',
});

const noviceWeaponArtifact = buildPresetArtifact({
  name: '入门青竹剑',
  slot: 'weapon',
  element: '木',
  description: '以青竹淬灵制成的入门法剑，锋芒不躁，适合新入道者熟悉斗法节奏。',
  affixIds: ['artifact-panel-weapon-dual-atk', 'artifact-panel-atk'],
  realm: '炼气',
  realmStage: '初期',
});

const noviceArmorArtifact = buildPresetArtifact({
  name: '入门护身布甲',
  slot: 'armor',
  element: '土',
  description: '缀有护身符线的粗布法甲，可缓冲初次探秘里的冲撞与余波。',
  affixIds: ['artifact-panel-armor-dual-def', 'artifact-panel-def'],
  realm: '炼气',
  realmStage: '初期',
});

type TaskLinkKind =
  | 'alchemy'
  | 'cultivator'
  | 'dungeon'
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

export interface BreakthroughTaskDefinition
  extends Omit<TaskDefinition, 'stages' | 'category' | 'fromRealm' | 'toRealm'> {
  category: 'breakthrough_major';
  fromRealm: NonNullable<TaskDefinition['fromRealm']>;
  toRealm: NonNullable<TaskDefinition['toRealm']>;
  taskTheme: TaskInstanceMetadata['taskTheme'];
  stages: TaskStageTemplate[];
}

export interface DailyTaskDefinition
  extends Omit<TaskDefinition, 'stages' | 'category' | 'dailyKind' | 'repeat' | 'difficulty'> {
  category: 'daily';
  repeat: 'daily';
  dailyKind: TaskDailyKind;
  difficulty: DailyTaskDifficulty;
  rewardAttachments: NonNullable<TaskDefinition['rewardAttachments']>;
  stages: TaskStageTemplate[];
}

export interface TutorialTaskDefinition
  extends Omit<TaskDefinition, 'stages' | 'category'> {
  category: 'tutorial';
  rewardCultivationExp: number;
  rewardAttachments: NonNullable<TaskDefinition['rewardAttachments']>;
  stages: TaskStageTemplate[];
}

export type RuntimeTaskDefinition =
  | BreakthroughTaskDefinition
  | DailyTaskDefinition
  | TutorialTaskDefinition;

export interface TaskChallengeProfile {
  id: string;
  title: string;
  enemyDifficulty?: number;
  buildOpponent: (cultivator: Cultivator) => Cultivator | Promise<Cultivator>;
}

function cloneMirrorOpponent(
  cultivator: Cultivator,
  options: {
    name: string;
    attributeMultiplier: number;
    bonusWillpower?: number;
    bonusSpeed?: number;
  },
): Cultivator {
  const multiplier = options.attributeMultiplier;

  return {
    ...structuredClone(cultivator),
    id:
      globalThis.crypto?.randomUUID?.() ??
      `mirror-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: options.name,
    title: '劫影',
    attributes: {
      vitality: Math.max(1, Math.floor(cultivator.attributes.vitality * multiplier)),
      spirit: Math.max(1, Math.floor(cultivator.attributes.spirit * multiplier)),
      wisdom: Math.max(1, Math.floor(cultivator.attributes.wisdom * multiplier)),
      speed: Math.max(
        1,
        Math.floor(cultivator.attributes.speed * multiplier) + (options.bonusSpeed ?? 0),
      ),
      willpower: Math.max(
        1,
        Math.floor(cultivator.attributes.willpower * multiplier) +
          (options.bonusWillpower ?? 0),
      ),
    },
  };
}

async function buildGeneratedChallengeOpponent(
  cultivator: Cultivator,
  options: {
    name: string;
    race: '灵族' | '魔族' | '古兽';
    enemyDifficulty: number;
    narrativeHint: string;
  },
): Promise<Cultivator> {
  const draft = challengeEnemyGenerator.buildDraft({
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    race: options.race,
    difficulty: options.enemyDifficulty,
    isBoss: true,
    name: options.name,
    background: options.narrativeHint,
    description: `${options.name}杀机炽盛，专为破境试炼而来。`,
  });
  const enriched = await challengeEnemyGenerator.enrichNarrative(draft);
  return enriched.cultivator;
}

const BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY = {
  tribulationDeity: 65,
  lawInsightVoid: 75,
  tribulationBody: 90,
  heavenlyTribulationFinal: 100,
} as const;

const challengeProfiles: TaskChallengeProfile[] = [
  {
    id: 'heart_demon_nascent',
    title: '心魔劫',
    buildOpponent: (cultivator) =>
      cloneMirrorOpponent(
        cultivator,
        hasActiveConditionStatus(cultivator.condition, 'clear_mind')
          ? {
              name: '心魔化身',
              attributeMultiplier: 1,
            }
          : {
              name: '心魔化身',
              attributeMultiplier: 1.08,
              bonusWillpower: 6,
              bonusSpeed: 4,
            },
      ),
  },
  {
    id: 'tribulation_deity',
    title: '化神之扰',
    enemyDifficulty: BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.tribulationDeity,
    buildOpponent: (cultivator) =>
      buildGeneratedChallengeOpponent(cultivator, {
        name: '天劫投影',
        race: '灵族',
        enemyDifficulty: BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.tribulationDeity,
        narrativeHint: '天劫降临时凝聚而成的劫影，通体天罚雷光流转，奉天命阻断化神之路。',
      }),
  },
  {
    id: 'law_insight_void',
    title: '法则试锋',
    enemyDifficulty: BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.lawInsightVoid,
    buildOpponent: (cultivator) =>
      buildGeneratedChallengeOpponent(cultivator, {
        name: '法则残影',
        race: '灵族',
        enemyDifficulty: BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.lawInsightVoid,
        narrativeHint: '法则碎片凝化的残影，举手投足间隐现天地规则之力，试探悟道者能否承受法则之重。',
      }),
  },
  {
    id: 'tribulation_body',
    title: '雷劫淬体',
    enemyDifficulty: BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.tribulationBody,
    buildOpponent: (cultivator) =>
      buildGeneratedChallengeOpponent(cultivator, {
        name: '劫雷化身',
        race: '古兽',
        enemyDifficulty: BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.tribulationBody,
        narrativeHint: '劫雷凝形的太古兽体，浑身雷弧缠绕，以雷霆之势淬炼渡劫者的道体根基。',
      }),
  },
  {
    id: 'inner_demon_grand',
    title: '大执念劫',
    buildOpponent: (cultivator) =>
      cloneMirrorOpponent(cultivator, {
        name: '执念化身',
        attributeMultiplier: 1.12,
        bonusWillpower: 12,
        bonusSpeed: 6,
      }),
  },
  {
    id: 'heavenly_tribulation_final',
    title: '天劫前奏',
    enemyDifficulty:
      BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.heavenlyTribulationFinal,
    buildOpponent: (cultivator) =>
      buildGeneratedChallengeOpponent(cultivator, {
        name: '天道劫影',
        race: '古兽',
        enemyDifficulty:
          BREAKTHROUGH_CHALLENGE_ENEMY_DIFFICULTY.heavenlyTribulationFinal,
        narrativeHint: '天道意志所化的终极劫影，承载末法时代最后一缕天威，誓要将不配渡劫者碾为齑粉。',
      }),
  },
];

const breakthroughDefinitions: BreakthroughTaskDefinition[] = [
  {
    id: 'major_breakthrough_炼气_筑基',
    category: 'breakthrough_major',
    title: '筑基前引',
    summary: '先凝住一口破境心气，再经药园试炼稳住根基，方可回静室冲击筑基。',
    fromRealm: '炼气',
    toRealm: '筑基',
    taskTheme: 'foundation',
    stages: [
      {
        id: 'foundation-pill',
        title: '凝破境意',
        description: '筑基前先把心神收住，借筑基丹引动一口破境心气。筑基丹可在炼丹房用温稳灵材配合“冲关蓄势、辅助筑基”之类丹意炼制，也可去修仙坊市寻访成丹。',
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
            title: '凝成破境心气',
            description: '服用筑基丹，让药力在丹田中化开，稳住冲击筑基前的第一口气。',
            statusKey: 'breakthrough_focus',
          },
        ],
      },
      {
        id: 'foundation-trial',
        title: '闯废弃药园',
        description: '去血色禁地边缘的废弃药园走一遭，借险地灵机打磨根基。',
        completionText: '药园灵机已历，根基略稳。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'clear-garden',
            kind: 'complete_dungeon',
            title: '通过落日森林·废弃药园',
            description: '完成一次药园历练，稳住破境前的根基与心神。',
            mapNodeId: 'SAT_TN_03',
            mapNodeName: '落日森林·废弃药园',
          },
        ],
      },
    ],
  },
  {
    id: 'major_breakthrough_筑基_金丹',
    category: 'breakthrough_major',
    title: '凝丹之机',
    summary: '丹药只是外力，先让功法与丹意都够得上，再去试炼阵中凝气成丹。',
    fromRealm: '筑基',
    toRealm: '金丹',
    taskTheme: 'core',
    stages: [
      {
        id: 'core-prep',
        title: '丹法并备',
        description: '结丹前需借降尘丹压住丹田火候，再以玄品功法稳住成丹根基。降尘丹可在炼丹房以“结丹、凝丹、冲关蓄势”之类丹意炼制，也可去修仙坊市寻访。',
        completionText: '破境凝神与功法已备，凝丹条件已成。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '去修仙坊市', kind: 'market' },
          { label: '看所修功法', kind: 'tasks' },
        ],
        objectives: [
          {
            id: 'breakthrough-focus',
            kind: 'status_active',
            title: '稳住凝丹火候',
            description: '服用降尘丹，让丹意沉入气海，先把结丹前的火候压稳。',
            statusKey: 'breakthrough_focus',
          },
          {
            id: 'quality-threshold',
            kind: 'technique_quality_at_least',
            title: '功法至少达玄品',
            description: '结丹更看道基深浅，所修最高功法需达到玄品。',
            threshold: '玄品',
          },
        ],
      },
      {
        id: 'core-trial',
        title: '过后山试炼阵',
        description: '前往黄枫谷后山禁地，以试炼阵压缩灵力，提前适应凝丹之势。',
        completionText: '试炼阵已过，丹田已能承压。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'clear-trial',
            kind: 'complete_dungeon',
            title: '通过黄枫谷后山禁地',
            description: '完成一次结丹前试炼，验证功法与丹意能否并行。',
            mapNodeId: 'SAT_TN_04',
            mapNodeName: '越国·黄枫谷后山禁地',
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
        description: '元婴问心之前，先用清心丹洗去识海杂念。清心丹可在炼丹房以“清心、定神、心魔”之类丹意炼制，也可去修仙坊市碰碰机缘。',
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
            title: '安定识海',
            description: '服用清心丹，让识海归于澄明，再去应对心魔幻境。',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'nascent-heart-demon',
        title: '渡心魔劫',
        description: '进入识海深处，与心魔化身正面一战，胜则元婴可期。',
        completionText: '心魔已斩，道心尚存。',
        links: [
          { label: '进入试炼', kind: 'challenge' },
          { label: '返回静室', kind: 'retreat' },
        ],
        objectives: [
          {
            id: 'win-heart-demon',
            kind: 'win_task_challenge',
            title: '战胜心魔化身',
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
    summary: '化神之前，要先备护脉与清心，再去旧址断执，最后直面天劫投影。',
    fromRealm: '元婴',
    toRealm: '化神',
    taskTheme: 'tribulation',
    stages: [
      {
        id: 'deity-prep',
        title: '护脉清心',
        description: '化神前反噬极重，经脉与识海都要提前安顿。护脉丹、清心丹可在炼丹房按“护脉、清心、化神反噬”之类丹意炼制，也可去修仙坊市寻访。',
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
            title: '护住经脉',
            description: '服用护脉丹，让药力先行护住经络，免得化神反噬伤及根本。',
            statusKey: 'protect_meridians',
          },
          {
            id: 'clear-mind',
            kind: 'status_active',
            title: '安定识海',
            description: '服用清心丹，压下杂念与惊悸，免得化神时神识动摇。',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'deity-trial',
        title: '断旧执',
        description: '去天机阁旧址看破旧念，以残卷与星象印证自己的道途。',
        completionText: '旧执已断，道念更明。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'clear-archive',
            kind: 'complete_dungeon',
            title: '通过天机阁旧址',
            description: '完成一次旧址历练，以断执念、稳道心。',
            mapNodeId: 'SAT_DJ_07',
            mapNodeName: '大晋·天机阁旧址',
          },
          {
            id: 'win-tribulation',
            kind: 'win_task_challenge',
            title: '战胜天劫投影',
            description: '正面扛过化神前的天劫投影，方可回静室正式冲关。',
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
    summary: '想破入炼虚，先把感悟推高，再去险地印证法则，最后战胜法则残影。',
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
        title: '入古魔祭坛群',
        description: '在古魔祭坛群中正视混乱法则，再与法则残影交手。',
        completionText: '祭坛群与法则残影都已渡过。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'clear-altar',
            kind: 'complete_dungeon',
            title: '通过古魔祭坛群',
            description: '完成一次高危法则历练。',
            mapNodeId: 'SAT_TN_06',
            mapNodeName: '坠魔谷·古魔祭坛群',
          },
          {
            id: 'win-law-challenge',
            kind: 'win_task_challenge',
            title: '战胜法则残影',
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
    summary: '炼虚之后，道体先承雷，再谈合体。准备、试炼与雷劫都不可省。',
    fromRealm: '炼虚',
    toRealm: '合体',
    taskTheme: 'tribulation',
    stages: [
      {
        id: 'body-prep',
        title: '稳道体',
        description: '合体前要先让道体能承住雷劫余威。护脉丹可在炼丹房按“护脉、稳固道体、承雷”之类丹意炼制，也可去修仙坊市寻访。',
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
            title: '护住道体经脉',
            description: '服用护脉丹，让经脉先稳下来，才好承受合体前的雷劫反噬。',
            statusKey: 'protect_meridians',
          },
        ],
      },
      {
        id: 'body-trial',
        title: '入镇魔古塔',
        description: '先过镇魔古塔，再与劫雷化身交锋，验证道体是否真能承压。',
        completionText: '古塔与劫雷都已承住。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'clear-tower',
            kind: 'complete_dungeon',
            title: '通过镇魔古塔',
            description: '借塔灵与封印反噬打磨道体。',
            mapNodeId: 'SAT_DJ_06',
            mapNodeName: '昆吾山·镇魔古塔',
          },
          {
            id: 'win-body-challenge',
            kind: 'win_task_challenge',
            title: '战胜劫雷化身',
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
        description: '大乘门前最怕执念反噬，先以清心丹稳住心神。清心丹可在炼丹房按“清心、定神、斩执念”之类丹意炼制，也可去修仙坊市寻访。',
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
            title: '稳住心神',
            description: '服用清心丹，把识海中的杂念压下去，不被执念拉回旧路。',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'grand-trial',
        title: '闯逆鳞祭坛',
        description: '先过逆鳞祭坛，再斩执念化身，方能真正逼近大乘门槛。',
        completionText: '逆鳞与执念都已越过。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'clear-altar',
            kind: 'complete_dungeon',
            title: '通过逆鳞祭坛',
            description: '以古龙逆鳞磨炼道心与意志。',
            mapNodeId: 'SAT_DJ_02',
            mapNodeName: '玄黄裂渊·逆鳞祭坛',
          },
          {
            id: 'win-grand-challenge',
            kind: 'win_task_challenge',
            title: '战胜执念化身',
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
        description: '渡劫前要同时稳住道体与识海。护脉丹、清心丹可在炼丹房按“护脉、清心、渡劫”之类丹意炼制，也可去修仙坊市寻访。',
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
            title: '护住道体经脉',
            description: '服用护脉丹，让经络先承一层药力，降低劫雷前的道体崩裂风险。',
            statusKey: 'protect_meridians',
          },
          {
            id: 'clear-mind',
            kind: 'status_active',
            title: '安定识海',
            description: '服用清心丹，让神识沉静下来，免得天威未至便先乱了心神。',
            statusKey: 'clear_mind',
          },
        ],
      },
      {
        id: 'tribulation-trial',
        title: '入沉日神殿',
        description: '先穿沉日神殿，再直面天道劫影，证明自己不会在第一道劫火下碎灭。',
        completionText: '神殿与天道劫影都已压过去。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '进入试炼', kind: 'challenge' },
        ],
        objectives: [
          {
            id: 'clear-temple',
            kind: 'complete_dungeon',
            title: '通过沉日神殿',
            description: '在深海神殿中验证自己是否真能承住天威。',
            mapNodeId: 'SAT_DJ_03',
            mapNodeName: '九幽冥海·沉日神殿',
          },
          {
            id: 'win-final-challenge',
            kind: 'win_task_challenge',
            title: '战胜天道劫影',
            description: '若连天劫前奏都扛不住，便还不到正式渡劫的时候。',
            challengeId: 'heavenly_tribulation_final',
          },
        ],
      },
    ],
  },
];

const tutorialDefinitions: TutorialTaskDefinition[] = [
  {
    id: 'tutorial_starter_supply',
    category: 'tutorial',
    title: '入门供给',
    summary: '先领一份洞府供给，备好第一炉丹、第一次探秘和一整套入门装备。',
    rewardCultivationExp: 40,
    rewardAttachments: [
      {
        type: 'spirit_stones',
        name: '灵石',
        quantity: 5000,
      },
      {
        type: 'material',
        name: '青露草',
        quantity: 3,
        data: {
          name: '青露草',
          type: 'herb',
          rank: '凡品',
          element: '木',
          description: '叶尖含露，药性温和，适合作为第一炉疗伤丹的主材。',
          quantity: 3,
        },
      },
      {
        type: 'material',
        name: '凝水花',
        quantity: 2,
        data: {
          name: '凝水花',
          type: 'herb',
          rank: '凡品',
          element: '水',
          description: '花瓣凝水成珠，能缓和炉火躁性，常用于回元与疗伤。',
          quantity: 2,
        },
      },
      {
        type: 'artifact',
        name: noviceWeaponArtifact.name,
        quantity: 1,
        data: noviceWeaponArtifact,
      },
      {
        type: 'artifact',
        name: noviceArmorArtifact.name,
        quantity: 1,
        data: noviceArmorArtifact,
      },
      {
        type: 'artifact',
        name: noviceGuardArtifact.name,
        quantity: 1,
        data: noviceGuardArtifact,
      },
    ],
    stages: [
      {
        id: 'starter-supply',
        title: '领取供给',
        description: '先把入门供给收入囊中。入门武器、护甲与玉佩建议尽早穿戴；第一炉丹与低危探秘可按卷宗继续推进。',
        completionText: '供给已备，可以开始熟悉洞府里的修行循环。',
        links: [
          { label: '看道身状态', kind: 'cultivator' },
          { label: '去储物袋', kind: 'inventory' },
        ],
        objectives: [
          {
            id: 'starter-supply-ready',
            kind: 'auto_complete',
            title: '供给已备',
            description: '入门供给已经备好，领取后会获得修为、灵石、灵材与一整套入门装备。',
          },
        ],
      },
    ],
  },
  {
    id: 'tutorial_first_alchemy',
    category: 'tutorial',
    title: '第一炉疗伤丹',
    summary: '用温和灵草开一次炉，学会材料、丹意、消耗和成丹结果之间的关系。',
    rewardCultivationExp: 40,
    rewardAttachments: [
      {
        type: 'spirit_stones',
        name: '灵石',
        quantity: 3000,
      },
      {
        type: 'material',
        name: '赤芽果',
        quantity: 2,
        data: {
          name: '赤芽果',
          type: 'herb',
          rank: '凡品',
          element: '火',
          description: '药力较活，少量投入可提振丹势，过量则容易使炉火躁烈。',
          quantity: 2,
        },
      },
    ],
    stages: [
      {
        id: 'first-alchemy',
        title: '开炉一次',
        description: '去炼丹房选择青露草、凝水花一类温和灵材，丹意可写“疗伤回元，药性温和”。',
        completionText: '第一炉已成，你已经知道炼丹要先看材料药性与丹意方向。',
        links: [
          { label: '去炼丹房', kind: 'alchemy' },
          { label: '查看储物袋', kind: 'inventory' },
        ],
        objectives: [
          {
            id: 'first-alchemy-crafted',
            kind: 'event_count',
            title: '完成 1 次炼丹',
            description: '成功开炉一次即可完成，不要求丹药品阶。',
            event: 'alchemy_crafted',
            threshold: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'tutorial_first_dungeon',
    category: 'tutorial',
    title: '第一次低危探秘',
    summary: '满状态再进低危秘境，学会查探、撤退、结算和战后恢复。',
    rewardCultivationExp: 50,
    rewardAttachments: [
      {
        type: 'spirit_stones',
        name: '灵石',
        quantity: 5000,
      },
      {
        type: 'material',
        name: '铁木枝',
        quantity: 2,
        data: {
          name: '铁木枝',
          type: 'aux',
          rank: '凡品',
          element: '木',
          description: '木质坚韧，可作炼器辅材，也能在炼丹时稳住药路。',
          quantity: 2,
        },
      },
      {
        type: 'material',
        name: '青纹回元草',
        quantity: 1,
        data: {
          name: '青纹回元草',
          type: 'herb',
          rank: '凡品',
          element: '木',
          description: '木气温润的灵草，可调和炉势并稳住药力。',
          quantity: 1,
        },
      },
    ],
    stages: [
      {
        id: 'first-dungeon',
        title: '完成一次探秘结算',
        description: '进入云游探秘前先确认气血与法力，遇敌时先查探，危险就撤退。',
        completionText: '第一次探秘已结算，你已经走完修炼、准备、探索、恢复的基础循环，也带回了一份入门材料。',
        links: [
          { label: '去云游探秘', kind: 'dungeon' },
          { label: '去灵眼之泉', kind: 'inn' },
          { label: '去练功房', kind: 'training' },
        ],
        objectives: [
          {
            id: 'first-dungeon-completed',
            kind: 'event_count',
            title: '完成 1 次探秘',
            description: '完成一次云游探秘结算即可，成功撤退也能学到风险判断。',
            event: 'dungeon_completed',
            threshold: 1,
          },
        ],
      },
    ],
  },
];

const definitions: RuntimeTaskDefinition[] = [
  ...tutorialDefinitions,
  ...breakthroughDefinitions,
];

const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
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

export function getTutorialTaskDefinitions() {
  return tutorialDefinitions;
}

export function getTaskChallengeProfile(challengeId: string) {
  return challengeProfileMap.get(challengeId) ?? null;
}

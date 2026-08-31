import { getRealmStageAttributeBudget } from '@shared/config/realmProgression';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import {
  buildPresetArtifact,
  buildPresetSkill,
} from '@shared/engine/cultivator/creation/presetProducts';
import type { Attributes } from '@shared/types/cultivator';
import type {
  ElementType,
  EquipmentSlot,
  RealmType,
} from '@shared/types/constants';
import {
  SECT_RANK_METHOD_CAP,
  type CultivatorSectState,
  type SectDiscipleRank,
  type SectRankRequirement,
} from '../domain';
import { StandardSectCapabilityPolicy } from './StandardSectCapabilityPolicy';
import {
  SECT_CRAFT_CONTEXTS,
  type SectBattleScenarioCatalog,
  type SectBenefitPolicy,
  type SectConstructionPolicy,
  type SectCraftContextKey,
  type SectEconomyPolicy,
  type SectOpponentFactory,
  type SectOrganizationModule,
  type SectOrganizationTaskId,
  type SectRankPolicy,
  type SectTaskCatalog,
  type SectTaskDefinition,
  type SectTaskDialogueDefinition,
} from './contracts';
import { getSectFacilityUpgradeTarget } from './construction';
import { calculateStandardSectStipendBase } from './stipend';

const capabilities = new StandardSectCapabilityPolicy(
  {
    'sect.hall.view': 'registered',
    'sect.tasks.use': 'registered',
    'sect.archive.use': 'registered',
    'sect.enlightenment.use': 'registered',
    'sect.arena.use': 'registered',
    'sect.shop.use': 'outer',
    'sect.construction.view': 'registered',
    'sect.construction.donate': 'registered',
    'sect.facility.cultivation.use': 'outer',
    'sect.facility.alchemy.use': 'inner',
    'sect.facility.refinery.use': 'inner',
    'sect.spirit_vein.view': 'registered',
    'sect.herb_garden.view': 'registered',
    'sect.cave.view': 'inner',
    'sect.gate.view': 'registered',
    'sect.formation.view': 'true',
    'sect.task.pill_delivery.accept': 'outer',
    'sect.task.artifact_delivery.accept': 'inner',
    'sect.task.elder_trial.challenge': 'inner',
  },
  new Set(['sect.formation.view']),
);

export const STANDARD_SECT_ARCHIVE_METHOD_CAP = [
  0, 40, 75, 110, 145, 180,
] as const;

export const STANDARD_SECT_TASK_BASE_CONTRIBUTION = {
  gate_sweep: 4,
  mine_patrol: 4,
  spirit_mining: 4,
  pill_delivery: 4,
  artifact_delivery: 5,
  weekly_diligence: 30,
  weekly_tournament: 15,
  weekly_bounty_battle: 20,
  weekly_bounty_material: 20,
} as const;

function taskPresentation(
  title: string,
  description: string,
  actionLabel: string,
  dialogue: SectTaskDialogueDefinition,
) {
  return {
    title,
    description,
    actionLabel,
    dialogue,
  };
}

function taskFulfillment(kind: SectTaskDefinition['kind']) {
  return [
    ...(kind === 'daily'
      ? [
          {
            strategy: 'sect.fulfillment.progress-signal',
            input: { source: 'sect.task.daily.completed', amount: 1 },
          },
        ]
      : []),
  ] as const;
}

const tasks: readonly SectTaskDefinition[] = [
  {
    id: 'gate_sweep',
    kind: 'daily',
    enrollment: 'manual',
    requiredCapability: 'sect.tasks.use',
    executorKey: 'sect.sweep',
    minimumDifficulty: 'easy',
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution: STANDARD_SECT_TASK_BASE_CONTRIBUTION.gate_sweep,
      },
    },
    fulfillment: taskFulfillment('daily'),
    presentation: taskPresentation(
      '清扫山门',
      '清理山门步道，完成一轮宗门勤务。',
      '开始清扫',
      {
        offeredReply: '山门洒扫便交给我吧',
        activeReply: '山门那桩洒扫，我再确认一遍',
        claimableReply: '山门已经清扫妥当，请执事查验',
        claimedReply: '请替我查查山门勤务的功簿',
        instruction: {
          text: '去山门步道清理落叶，完成一轮洒扫后回来复命。',
        },
      },
    ),
    target: 1,
  },
  {
    id: 'mine_patrol',
    kind: 'daily',
    enrollment: 'manual',
    requiredCapability: 'sect.tasks.use',
    executorKey: 'sect.battle',
    minimumDifficulty: 'normal',
    executionLocation: {
      key: 'sect.spirit-vein',
      travelReply: '弟子这就前往矿场巡视',
    },
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution: STANDARD_SECT_TASK_BASE_CONTRIBUTION.mine_patrol,
      },
    },
    fulfillment: taskFulfillment('daily'),
    presentation: taskPresentation(
      '巡视矿场',
      '前往宗门矿脉驱逐侵扰妖兽。',
      '开始巡逻',
      {
        offeredReply: '矿场巡视交给我',
        activeReply: '矿场那边的差事，请再说一遍',
        claimableReply: '矿场侵扰已经平息，请执事查验',
        claimedReply: '请替我查查矿场巡视的功簿',
        instruction: {
          text: '去宗门矿脉巡视一趟，将侵扰矿场的妖兽驱逐干净，再回来复命。',
        },
      },
    ),
    target: 1,
  },
  {
    id: 'spirit_mining',
    kind: 'daily',
    enrollment: 'manual',
    requiredCapability: 'sect.tasks.use',
    executorKey: 'sect.mining',
    minimumDifficulty: 'normal',
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution: STANDARD_SECT_TASK_BASE_CONTRIBUTION.spirit_mining,
      },
    },
    fulfillment: taskFulfillment('daily'),
    presentation: taskPresentation(
      '灵矿采掘',
      '进入宗门灵脉，以灵索采集一轮矿藏。',
      '开始采掘',
      {
        offeredReply: '今日灵矿采掘便交给我吧',
        activeReply: '灵矿采掘的封签，请再替我核对一遍',
        claimableReply: '今日采掘已经结束，请执事验收回执',
        claimedReply: '请替我查查灵矿采掘的功簿',
        instruction: {
          text: '去宗门灵脉开启采掘封签，以灵索带回足够矿藏，再回来复命。',
        },
      },
    ),
    target: 1,
  },
  {
    id: 'pill_delivery',
    kind: 'daily',
    enrollment: 'manual',
    requiredCapability: 'sect.task.pill_delivery.accept',
    executorKey: 'sect.delivery.pill',
    minimumDifficulty: 'easy',
    offer: {
      policy: 'sect.offer.delivery',
      input: { kind: 'pill' },
    },
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution: STANDARD_SECT_TASK_BASE_CONTRIBUTION.pill_delivery,
      },
    },
    fulfillment: taskFulfillment('daily'),
    presentation: taskPresentation(
      '丹药委托',
      '寻来符合要求的丹药，补充宗门日常储备。',
      '选择丹药',
      {
        offeredReply: '丹房所需之物，我来寻',
        activeReply: '丹房那桩委托，请再说一遍',
        claimableReply: '丹药已经带回，请执事查验',
        claimedReply: '请替我查查丹药委托的功簿',
        instruction: {
          text: '替丹房寻来一枚合用的丹药，取得后直接带回事务堂即可。',
          requirementPrefix: '替丹房寻来',
          requirementSuffix: '，取得后直接带回事务堂即可。',
        },
      },
    ),
    target: 1,
  },
  {
    id: 'artifact_delivery',
    kind: 'daily',
    enrollment: 'manual',
    requiredCapability: 'sect.task.artifact_delivery.accept',
    executorKey: 'sect.delivery.artifact',
    minimumDifficulty: 'easy',
    offer: {
      policy: 'sect.offer.delivery',
      input: { kind: 'artifact' },
    },
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution:
          STANDARD_SECT_TASK_BASE_CONTRIBUTION.artifact_delivery,
      },
    },
    fulfillment: taskFulfillment('daily'),
    presentation: taskPresentation(
      '法宝委托',
      '寻来符合要求且未装备的法宝，交由宗门统一调度。',
      '选择法宝',
      {
        offeredReply: '法宝调度一事，我可以接下',
        activeReply: '法宝那桩委托，请再说一遍',
        claimableReply: '法宝已经移交，请执事查验',
        claimedReply: '请替我查查法宝委托的功簿',
        instruction: {
          text: '替宗门寻来一件合用的未装备法宝，带回事务堂核验。',
          requirementPrefix: '替宗门寻来',
          requirementSuffix: '，带回事务堂核验。',
        },
      },
    ),
    target: 1,
  },
  {
    id: 'weekly_diligence',
    kind: 'weekly',
    enrollment: 'automatic',
    requiredCapability: 'sect.tasks.use',
    executorKey: 'sect.progress',
    minimumDifficulty: 'easy',
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution: STANDARD_SECT_TASK_BASE_CONTRIBUTION.weekly_diligence,
      },
    },
    fulfillment: [],
    presentation: taskPresentation(
      '勤务周录',
      '一周完成五次宗门日常。',
      '查看进度',
      {
        offeredReply: '本周勤务也记我一份',
        activeReply: '本周勤务，我已经办到哪里了',
        claimableReply: '本周勤务已经办足，请执事查验',
        claimedReply: '请替我翻翻本周勤务的功簿',
        instruction: {
          text: '本周要完成五次宗门日常，功簿会逐次记下。',
        },
      },
    ),
    completionTags: ['weekly.diligence'],
    progress: {
      strategy: 'sect.progress.completed-daily',
      source: 'sect.task.daily.completed',
    },
    target: 5,
  },
  {
    id: 'weekly_tournament',
    kind: 'weekly',
    enrollment: 'manual',
    requiredCapability: 'sect.tasks.use',
    executorKey: 'sect.battle',
    minimumDifficulty: 'hard',
    executionLocation: {
      key: 'sect.arena',
      travelReply: '弟子这就去演武场候教',
    },
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution:
          STANDARD_SECT_TASK_BASE_CONTRIBUTION.weekly_tournament,
      },
    },
    fulfillment: [],
    presentation: taskPresentation(
      '宗门小比',
      '与本周演武名册中同境或低一境的同门切磋。',
      '参加宗门小比',
      {
        offeredReply: '本周小比，我来应战',
        activeReply: '小比的安排，请再说一遍',
        claimableReply: '本周小比已经结束，请执事查验',
        claimedReply: '请替我查查本周小比的功簿',
        instruction: {
          text: '去演武场的宗门擂台核对已锁定的同门对手，取胜后再回来复命。',
        },
      },
    ),
    completionTags: ['promotion.tournament'],
    target: 1,
  },
  {
    id: 'weekly_bounty_battle',
    kind: 'weekly',
    enrollment: 'manual',
    requiredCapability: 'sect.tasks.use',
    executorKey: 'sect.battle',
    minimumDifficulty: 'hard',
    executionLocation: {
      key: 'sect.foreign-gate',
      travelReply: '弟子这就循悬赏前往目标宗门',
    },
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution:
          STANDARD_SECT_TASK_BASE_CONTRIBUTION.weekly_bounty_battle,
      },
    },
    fulfillment: [],
    presentation: taskPresentation(
      '悬赏令·讨伐',
      '追缉一名与自身同境或低一境的外宗修士。',
      '前往讨伐',
      {
        offeredReply: '这份讨伐悬赏由我来办',
        activeReply: '讨伐目标的线索，请再交代一遍',
        claimableReply: '讨伐悬赏已经办妥，请执事查验',
        claimedReply: '请替我查查讨伐悬赏的功簿',
        instruction: {
          text: '循悬赏令前往目标宗门，在山门外找到目标并取胜，再回来复命。',
        },
      },
    ),
    completionTags: ['promotion.bounty'],
    target: 1,
  },
  {
    id: 'weekly_bounty_material',
    kind: 'weekly',
    enrollment: 'manual',
    requiredCapability: 'sect.tasks.use',
    executorKey: 'sect.delivery.material',
    minimumDifficulty: 'hard',
    offer: {
      policy: 'sect.offer.delivery',
      input: { kind: 'material' },
    },
    reward: {
      policy: 'sect.reward.realm-task',
      input: {
        baseContribution:
          STANDARD_SECT_TASK_BASE_CONTRIBUTION.weekly_bounty_material,
      },
    },
    fulfillment: [],
    presentation: taskPresentation(
      '悬赏令·征集',
      '依照悬赏令征集一件稀有材料。',
      '交付悬赏材料',
      {
        offeredReply: '这份征集悬赏由我来办',
        activeReply: '征集所需的材料，请再交代一遍',
        claimableReply: '征集悬赏已经办妥，请执事查验',
        claimedReply: '请替我查查征集悬赏的功簿',
        instruction: {
          text: '依照悬赏令备齐材料后回来交付。',
          requirementPrefix: '这份悬赏要验一件证物。替我寻来',
          requirementSuffix: '，带回后我会核验其来路。',
        },
      },
    ),
    completionTags: ['promotion.bounty'],
    target: 1,
  },
  {
    id: 'elder_trial',
    kind: 'promotion',
    enrollment: 'automatic',
    requiredCapability: 'sect.task.elder_trial.challenge',
    executorKey: 'sect.battle',
    fulfillment: [],
    presentation: taskPresentation(
      '长老试炼',
      '击败传功长老化身，取得真传资格。',
      '挑战长老试炼',
      {
        offeredReply: '弟子愿受晋升试炼',
        activeReply: '晋升试炼，请长老再作指点',
        claimableReply: '试炼已经通过，请长老查验',
        claimedReply: '请长老查验弟子的试炼记录',
        instruction: {
          text: '就在事务堂迎战传功长老的试炼化身，胜过此关，才算取得真传资格。',
        },
      },
    ),
    completionTags: ['promotion.elder_trial'],
    target: 1,
  },
];

class StandardSectTaskCatalog implements SectTaskCatalog {
  private readonly byId: ReadonlyMap<string, SectTaskDefinition>;

  constructor() {
    this.byId = new Map(tasks.map((task) => [task.id, task]));
  }

  listDaily(): readonly SectTaskDefinition[] {
    return tasks.filter((task) => task.kind === 'daily');
  }

  listWeekly(): readonly SectTaskDefinition[] {
    return tasks.filter((task) => task.kind === 'weekly');
  }

  listPromotion(): readonly SectTaskDefinition[] {
    return tasks.filter((task) => task.kind === 'promotion');
  }

  get(id: SectOrganizationTaskId): SectTaskDefinition | undefined {
    return this.byId.get(id);
  }

  listByCompletionTag(tag: string) {
    return tasks.filter((task) => task.completionTags?.includes(tag));
  }
}

class StandardSectEconomyPolicy implements SectEconomyPolicy {
  stipendBase(rank: SectDiscipleRank, realm: RealmType): number {
    return calculateStandardSectStipendBase(rank, realm);
  }
}

class StandardSectConstructionPolicy implements SectConstructionPolicy {
  readonly facilities = [
    { key: 'archive', initialLevel: 1, maxLevel: 5, upgradeable: true },
    {
      key: 'cultivation_room',
      initialLevel: 1,
      maxLevel: 5,
      upgradeable: true,
    },
    { key: 'workshop', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'spirit_vein', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'herb_garden', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'formation', initialLevel: 0, maxLevel: 0, upgradeable: false },
  ] as const;

  upgradeTarget(currentLevel: number): number | null {
    return getSectFacilityUpgradeTarget(currentLevel);
  }
}

const ATTRIBUTE_KEYS = [
  'vitality',
  'strength',
  'spirit',
  'endurance',
  'speed',
  'willpower',
] as const;

function scaledRealmAttributes(
  player: Pick<CultivatorCombatInput, 'realm' | 'realm_stage'>,
  multiplier: number,
): Attributes {
  const budget = getRealmStageAttributeBudget(player.realm, player.realm_stage);
  const base = Math.floor(budget / ATTRIBUTE_KEYS.length);
  const remainder = budget % ATTRIBUTE_KEYS.length;
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((key, index) => [
      key,
      Math.max(
        1,
        Math.floor((base + (index < remainder ? 1 : 0)) * multiplier),
      ),
    ]),
  ) as unknown as Attributes;
}

function createRealmNpcOpponent(
  player: Pick<CultivatorCombatInput, 'realm' | 'realm_stage'>,
  opponentId: string,
  name: string,
  multiplier: number,
  skills: CultivatorCombatInput['skills'] = [],
): CultivatorCombatInput {
  return {
    id: opponentId,
    name,
    realm: player.realm,
    realm_stage: player.realm_stage,
    attributes: scaledRealmAttributes(player, multiplier),
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: structuredClone(skills),
    inventory: { artifacts: [] },
    equipped: { weapon: null, armor: null, accessory: null },
  };
}

function createLockedCultivatorOpponent(
  target: CultivatorCombatInput,
  opponentId: string,
): CultivatorCombatInput {
  const opponent = structuredClone(target);
  opponent.id = opponentId;
  return opponent;
}

const MINE_BEAST_NAME = '裂岩獠兽';
const MINE_BEAST_DESCRIPTION =
  '盘踞宗门矿脉的厚甲妖兽，惯以獠牙冲阵、震地扰敌，并以妖血强化自身。';
const MINE_BEAST_SKILLS: CultivatorCombatInput['skills'] = [
  buildPresetSkill({
    name: '碎岩扑击',
    description: '挟碎岩之力扑向敌手，撕开其护体防御。',
    element: '土',
    affixIds: ['skill-core-damage-earth', 'skill-variant-def-break'],
    quality: '玄品',
  }),
  buildPresetSkill({
    name: '撼地怒吼',
    description: '以沉闷咆哮震动地脉，使敌手一时难以行动。',
    element: '土',
    affixIds: ['skill-core-damage-earth', 'skill-variant-control-stun'],
    quality: '玄品',
  }),
  buildPresetSkill({
    name: '妖血沸腾',
    description: '催动妖血燃起凶性，强化自身战意。',
    element: '火',
    affixIds: ['skill-core-fire-channeling'],
    quality: '玄品',
  }),
];

const ELDER_ARTIFACT_RECIPES: readonly {
  slot: EquipmentSlot;
  element: ElementType;
  affixIds: string[];
}[] = [
  {
    slot: 'weapon',
    element: '土',
    affixIds: [
      'artifact-panel-weapon-dual-atk',
      'artifact-panel-spirit',
      'artifact-weapon-blood-drinker',
    ],
  },
  {
    slot: 'armor',
    element: '木',
    affixIds: [
      'artifact-panel-armor-dual-def',
      'artifact-panel-vitality',
      'artifact-defense-death-prevent',
    ],
  },
  {
    slot: 'accessory',
    element: '水',
    affixIds: [
      'artifact-panel-accessory-utility',
      'artifact-panel-willpower',
      'artifact-accessory-clear-heart-pendant',
    ],
  },
];

function elderSectState(
  sectId: string,
  preset: SectElderTrialPreset,
): CultivatorSectState {
  return {
    membershipId: `preset-elder-${sectId}`,
    sectId,
    status: 'active',
    contribution: 0,
    discipleRank: 'true',
    office: 'elder',
    configVersion: preset.configVersion,
    activePathId: preset.pathId,
    methods: Object.fromEntries(
      preset.methodIds.map((methodId) => [methodId, 135]),
    ),
    paths: [
      {
        pathId: preset.pathId,
        unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
        tacticId: preset.tacticId,
        activeMeridianSlot: 1,
        meridianLoadouts: [
          { slot: 1, nodeIds: [], version: 1 },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ],
    abilityLoadout: [...preset.abilityLoadout],
  };
}

function createElderOpponent(
  sectId: string,
  opponentId: string,
  preset: SectElderTrialPreset,
): CultivatorCombatInput {
  const artifacts = ELDER_ARTIFACT_RECIPES.map((recipe, index) =>
    buildPresetArtifact({
      id: `${opponentId}-${recipe.slot}`,
      name: preset.artifactNames[index]!,
      description: preset.artifactDescriptions[index]!,
      slot: recipe.slot,
      element: recipe.element,
      affixIds: recipe.affixIds,
      quality: '地品',
      realm: '元婴',
      realmStage: '圆满',
      creatorName: preset.name,
      creatorCultivatorId: `preset-elder-${sectId}`,
      isEquipped: true,
    }),
  );
  return {
    id: opponentId,
    name: preset.name,
    realm: '元婴',
    realm_stage: '圆满',
    attributes: scaledRealmAttributes(
      { realm: '元婴', realm_stage: '圆满' },
      1,
    ),
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    sect: elderSectState(sectId, preset),
    inventory: { artifacts },
    equipped: {
      weapon: artifacts[0]?.id ?? null,
      armor: artifacts[1]?.id ?? null,
      accessory: artifacts[2]?.id ?? null,
    },
  };
}

class StandardSectBattleScenarioCatalog implements SectBattleScenarioCatalog {
  private readonly scenarios: ReadonlyMap<string, SectOpponentFactory>;

  constructor(theme: SectOrganizationTheme) {
    this.scenarios = new Map([
      [
        'mine_patrol',
        {
          acquisition: 'preset',
          stateStrategy: 'persistent_world',
          create({ player, opponentId }) {
            return {
              opponent: createRealmNpcOpponent(
                player,
                opponentId,
                MINE_BEAST_NAME,
                0.75,
                MINE_BEAST_SKILLS,
              ),
              title: '矿场巡视',
              presetId: 'mine-beast-rockfang-v1',
              description: MINE_BEAST_DESCRIPTION,
            };
          },
        },
      ],
      [
        'weekly_tournament',
        {
          acquisition: 'same-sect',
          stateStrategy: 'standard_full',
          create({ target, opponentId }) {
            if (!target) throw new Error('宗门小比缺少已锁定对手');
            return {
              opponent: createLockedCultivatorOpponent(target, opponentId),
              title: '宗门小比',
              description: '本周演武名册中与你同境或低一境的同门。',
            };
          },
        },
      ],
      [
        'weekly_bounty_battle',
        {
          acquisition: 'other-sect',
          stateStrategy: 'persistent_world',
          create({ target, opponentId }) {
            if (!target) throw new Error('战斗悬赏缺少已锁定目标');
            return {
              opponent: createLockedCultivatorOpponent(target, opponentId),
              title: '悬赏令·讨伐',
              description: '悬赏令上与你同境或低一境的外宗目标。',
            };
          },
        },
      ],
      [
        'elder_trial',
        {
          acquisition: 'preset',
          stateStrategy: 'persistent_world',
          create({ sectId, opponentId }) {
            const preset = theme.elderTrial;
            if (!preset)
              throw new Error(`宗门 ${sectId} 未配置长老试炼预设`);
            return {
              opponent: createElderOpponent(sectId, opponentId, preset),
              title: '长老试炼',
              presetId: `elder-trial-${sectId}-v1`,
              description: preset.description,
            };
          },
        },
      ],
    ]);
  }

  get(taskId: SectOrganizationTaskId): SectOpponentFactory | undefined {
    return this.scenarios.get(taskId);
  }
}

class StandardSectRankPolicy implements SectRankPolicy {
  nextRank(rank: SectDiscipleRank): SectDiscipleRank | null {
    return (
      {
        registered: 'outer',
        outer: 'inner',
        inner: 'true',
        true: null,
      } as const
    )[rank];
  }

  methodLevelCap(rank: SectDiscipleRank): number {
    return SECT_RANK_METHOD_CAP[rank];
  }

  requirement(
    rank: Exclude<SectDiscipleRank, 'registered'>,
  ): SectRankRequirement {
    const requirements: Record<
      Exclude<SectDiscipleRank, 'registered'>,
      SectRankRequirement
    > = {
      outer: {
        rank: 'outer',
        minRealm: '炼气',
        contribution: 100,
        dailyCompletions: 3,
      },
      inner: {
        rank: 'inner',
        minRealm: '筑基',
        contribution: 500,
        requiredTaskTags: [
          { tag: 'promotion.tournament', label: '完成一次宗门小比' },
        ],
      },
      true: {
        rank: 'true',
        minRealm: '元婴',
        contribution: 3000,
        requiredTaskTags: [
          { tag: 'promotion.bounty', label: '完成一次悬赏令' },
          { tag: 'promotion.elder_trial', label: '通过长老试炼' },
        ],
      },
    };
    return requirements[rank];
  }
}

class StandardSectBenefitPolicy implements SectBenefitPolicy {
  constructor(private readonly theme: SectOrganizationTheme = {}) {}

  private facilityName(key: string, fallback: string): string {
    return this.theme.facilityNames?.[key] ?? fallback;
  }

  snapshot(levels: ReadonlyMap<string, number>, rank: SectDiscipleRank) {
    const cultivationLevel = this.level(levels, 'cultivation_room');
    const workshopLevel = this.level(levels, 'workshop');
    const spiritVeinLevel = this.level(levels, 'spirit_vein');
    const herbGardenLevel = this.level(levels, 'herb_garden');
    const alchemy = this.craftDiscount(
      SECT_CRAFT_CONTEXTS.alchemy,
      levels,
      rank,
    ).discount;
    const refinery = this.craftDiscount(
      SECT_CRAFT_CONTEXTS.refinery,
      levels,
      rank,
    ).discount;
    const retreatMultiplier = this.retreatMultiplier(levels);
    return {
      retreatMultiplier,
      craftDiscounts: {
        [SECT_CRAFT_CONTEXTS.alchemy]: alchemy,
        [SECT_CRAFT_CONTEXTS.refinery]: refinery,
      },
      facilityEffects: {
        cultivation_room: {
          renderer: 'sect.benefit.retreat',
          summary: `闭关修为提高 ${Math.round((retreatMultiplier - 1) * 100)}%`,
          metrics: [
            {
              key: 'level',
              label: `${this.facilityName('cultivation_room', '修炼室')}等级`,
              value: cultivationLevel,
              format: 'number' as const,
            },
            {
              key: 'retreat_bonus',
              label: '闭关修为加成',
              value: cultivationLevel * 0.02,
              format: 'percent' as const,
            },
          ],
        },
        alchemy: {
          renderer: 'sect.benefit.craft',
          summary: `炼丹灵石消耗减免 ${Math.round(alchemy * 100)}%`,
          metrics: [
            {
              key: 'level',
              label: `${this.facilityName('workshop', '丹器坊')}等级`,
              value: workshopLevel,
              format: 'number' as const,
            },
          ],
        },
        refinery: {
          renderer: 'sect.benefit.craft',
          summary: `炼器灵石消耗减免 ${Math.round(refinery * 100)}%`,
          metrics: [
            {
              key: 'level',
              label: `${this.facilityName('workshop', '丹器坊')}等级`,
              value: workshopLevel,
              format: 'number' as const,
            },
          ],
        },
        spirit_vein: {
          renderer: 'sect.benefit.stipend',
          summary: `周俸灵石提高 ${spiritVeinLevel * 5}%`,
          metrics: [
            {
              key: 'level',
              label: `${this.facilityName('spirit_vein', '灵脉')}等级`,
              value: spiritVeinLevel,
              format: 'number' as const,
            },
          ],
        },
        herb_garden: {
          renderer: 'sect.benefit.herbs',
          summary: `每周产出 ${herbGardenLevel} 份基础灵草`,
          metrics: [
            {
              key: 'level',
              label: `${this.facilityName('herb_garden', '药田')}等级`,
              value: herbGardenLevel,
              format: 'number' as const,
            },
            {
              key: 'weekly_herbs',
              label: '每周基础灵草',
              value: herbGardenLevel,
              format: 'number' as const,
            },
          ],
        },
      },
    };
  }

  private level(levels: ReadonlyMap<string, number>, key: string): number {
    return Math.max(1, Math.min(5, Math.floor(levels.get(key) ?? 1)));
  }

  archiveLevel(levels: ReadonlyMap<string, number>): number {
    return levels.get('archive') ?? 1;
  }

  methodLevelCap(levels: ReadonlyMap<string, number>): number {
    const level = Math.max(
      1,
      Math.min(5, Math.floor(this.archiveLevel(levels))),
    );
    return (
      STANDARD_SECT_ARCHIVE_METHOD_CAP[level] ??
      STANDARD_SECT_ARCHIVE_METHOD_CAP[1]
    );
  }

  retreatMultiplier(levels: ReadonlyMap<string, number>): number {
    return 1 + this.level(levels, 'cultivation_room') * 0.02;
  }

  craftDiscount(
    craftContext: SectCraftContextKey,
    levels: ReadonlyMap<string, number>,
    rank: SectDiscipleRank,
  ) {
    const level = this.level(levels, 'workshop');
    return {
      capability:
        craftContext === SECT_CRAFT_CONTEXTS.refinery
          ? 'sect.facility.refinery.use'
          : 'sect.facility.alchemy.use',
      discount: Math.min(0.2, level * 0.02 + (rank === 'true' ? 0.1 : 0)),
    };
  }

  stipendMultiplier(levels: ReadonlyMap<string, number>): number {
    return 1 + this.level(levels, 'spirit_vein') * 0.05;
  }
}

export interface SectOrganizationTheme {
  facilityNames?: Partial<Record<string, string>>;
  elderTrial?: SectElderTrialPreset;
}

export interface SectElderTrialPreset {
  name: string;
  description: string;
  configVersion: number;
  methodIds: readonly string[];
  pathId: string;
  tacticId: string;
  abilityLoadout: CultivatorSectState['abilityLoadout'];
  artifactNames: readonly [string, string, string];
  artifactDescriptions: readonly [string, string, string];
}

export class StandardSectOrganizationModule implements SectOrganizationModule {
  readonly capabilities = capabilities;
  readonly ranks = new StandardSectRankPolicy();
  readonly tasks: SectTaskCatalog;
  readonly economy: SectEconomyPolicy;
  readonly construction = new StandardSectConstructionPolicy();
  readonly battles: SectBattleScenarioCatalog;
  readonly benefits: SectBenefitPolicy;

  constructor(readonly theme: SectOrganizationTheme = {}) {
    this.tasks = new StandardSectTaskCatalog();
    this.economy = new StandardSectEconomyPolicy();
    this.battles = new StandardSectBattleScenarioCatalog(theme);
    this.benefits = new StandardSectBenefitPolicy(theme);
  }
}

export const standardSectOrganization = new StandardSectOrganizationModule();

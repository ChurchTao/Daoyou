import type { PillSpec } from '@shared/types/consumable';
import {
  StandardSectCapabilityPolicy,
  SECT_CRAFT_CONTEXTS,
  type SectBattleScenarioCatalog,
  type SectBenefitPolicy,
  type SectConstructionPolicy,
  type SectCraftContextKey,
  type SectDonationDemandDefinition,
  type SectEconomyPolicy,
  type SectOpponentFactory,
  type SectOrganizationModule,
  type SectOrganizationTaskId,
  type SectRankPolicy,
  type SectRewardGrantDefinition,
  type SectShopDefinition,
  type SectTaskCatalog,
  type SectTaskDefinition,
} from '../../../core';
import type { SectDiscipleRank, SectRankRequirement } from '../../../core';

const capabilities = new StandardSectCapabilityPolicy({
  'sect.hall.view': 'registered',
  'sect.tasks.use': 'registered',
  'sect.archive.use': 'registered',
  'sect.enlightenment.use': 'registered',
  'sect.arena.use': 'registered',
  'sect.shop.use': 'outer',
  'sect.construction.view': 'outer',
  'sect.construction.donate': 'outer',
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
}, new Set(['sect.formation.view']));

function taskPresentation(
  title: string,
  description: string,
  contribution: number,
  renderer: string,
  actionLabel: string,
) {
  return {
    title,
    description,
    rewardSummary: contribution > 0 ? `${contribution} 宗门贡献` : '晋升资格',
    renderer,
    actionLabel,
  };
}

const bountyAvailability = {
  executorKeys: ['sect.battle', 'sect.delivery.material'] as const,
  resolve({ weekKey }: { weekKey: string }) {
    const seed = [...weekKey].reduce(
      (sum, char) => sum * 31 + char.charCodeAt(0),
      0,
    );
    const battle = Math.abs(seed) % 2 === 0;
    return {
      executorKey: battle ? 'sect.battle' : 'sect.delivery.material',
      parameters: battle
        ? { mode: 'battle' }
        : { mode: 'material', minQuality: '玄品', quantity: 2 },
    };
  },
};

function taskCompletion(
  contribution: number,
  kind: SectTaskDefinition['kind'],
) {
  return [
    ...(contribution > 0
      ? [{
          strategy: 'sect.settlement.contribution',
          input: {
            amount: contribution,
            reason: kind === 'daily' ? 'daily_task' : 'weekly_task',
          },
        }]
      : []),
    ...(kind === 'daily'
      ? [
          {
            strategy: 'sect.settlement.realm-daily-reward',
            input: { difficulty: 'easy' },
          },
          {
            strategy: 'sect.settlement.progress-signal',
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
    requiredCapability: 'sect.tasks.use',
    contributionReward: 25,
    executorKey: 'sect.sweep',
    completion: taskCompletion(25, 'daily'),
    presentation: taskPresentation('清扫山门', '循落叶纹路清理云阶，完成一轮山门勤务。', 25, 'sect.action.sweep', '进入云阶清扫'),
    target: 1,
  },
  {
    id: 'mine_patrol',
    kind: 'daily',
    requiredCapability: 'sect.tasks.use',
    contributionReward: 30,
    executorKey: 'sect.battle',
    completion: taskCompletion(30, 'daily'),
    presentation: taskPresentation('巡视矿场', '前往宗门矿脉驱逐侵扰妖兽。', 30, 'sect.action.battle', '前往迎战'),
    target: 1,
  },
  {
    id: 'pill_delivery',
    kind: 'daily',
    requiredCapability: 'sect.task.pill_delivery.accept',
    contributionReward: 35,
    executorKey: 'sect.delivery.pill',
    completion: taskCompletion(35, 'daily'),
    presentation: taskPresentation('丹药委托', '提交一枚有效丹药，补充宗门日常储备。', 35, 'sect.action.item-delivery', '确认交付'),
    target: 1,
  },
  {
    id: 'artifact_delivery',
    kind: 'daily',
    requiredCapability: 'sect.task.artifact_delivery.accept',
    contributionReward: 45,
    executorKey: 'sect.delivery.artifact',
    completion: taskCompletion(45, 'daily'),
    presentation: taskPresentation('法宝委托', '提交一件未装备的凡品以上法宝，交由宗门统一调度。', 45, 'sect.action.item-delivery', '确认交付'),
    target: 1,
  },
  {
    id: 'weekly_diligence',
    kind: 'weekly',
    requiredCapability: 'sect.tasks.use',
    contributionReward: 20,
    executorKey: 'sect.progress',
    completion: taskCompletion(20, 'weekly'),
    presentation: taskPresentation('勤务周录', '一周完成五次宗门日常。', 20, 'sect.action.progress', '查看进度'),
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
    requiredCapability: 'sect.tasks.use',
    contributionReward: 40,
    executorKey: 'sect.battle',
    completion: taskCompletion(40, 'weekly'),
    presentation: taskPresentation('宗门小比', '在试剑傀儡前验证本周修行。', 40, 'sect.action.battle', '参加小比'),
    completionTags: ['promotion.tournament'],
    target: 1,
  },
  {
    id: 'weekly_bounty',
    kind: 'weekly',
    requiredCapability: 'sect.tasks.use',
    contributionReward: 60,
    executorKey: 'sect.battle',
    completion: taskCompletion(60, 'weekly'),
    presentation: taskPresentation('悬赏令', '追缉叛徒残影或交付稀有材料。', 60, 'sect.action.battle', '执行悬赏'),
    availability: bountyAvailability,
    completionTags: ['promotion.bounty'],
    target: 1,
  },
  {
    id: 'elder_trial',
    kind: 'promotion',
    requiredCapability: 'sect.task.elder_trial.challenge',
    contributionReward: 0,
    executorKey: 'sect.battle',
    completion: taskCompletion(0, 'promotion'),
    presentation: taskPresentation('长老试炼', '击败传功长老剑影，取得真传资格。', 0, 'sect.action.battle', '挑战长老试炼'),
    completionTags: ['promotion.elder_trial'],
    target: 1,
  },
];

class LingxiaoTaskCatalog implements SectTaskCatalog {
  private readonly byId = new Map(tasks.map((task) => [task.id, task]));

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

  findByCompletionTag(tag: string) {
    return tasks.find((task) => task.completionTags?.includes(tag));
  }
}

function recoveryPillSpec(resource: 'hp' | 'mp', value: number): PillSpec {
  return {
    kind: 'pill',
    family: resource === 'hp' ? 'healing' : 'mana',
    operations: [
      { type: 'restore_resource', resource, mode: 'flat', value },
      { type: 'change_gauge', gauge: 'pillToxicity', delta: 3 },
    ],
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
    alchemyMeta: {
      source: 'improvised',
      sourceMaterials: ['宗门宝库制式丹材'],
      analysisVersion: 2,
      propertyVector: [
        { key: resource === 'hp' ? 'restore_hp' : 'restore_mp', weight: 1 },
      ],
      sourceMaterialVectors: [],
      stability: 80,
      toxicityRating: 3,
      appearance: 'middle',
      tags: ['宗门制式'],
    },
  };
}

const shopItems: readonly SectShopDefinition[] = [
  {
    id: 'outer_qinglu',
    requiredRank: 'outer',
    price: 10,
    stock: 8,
    rotating: false,
    grant: {
      kind: 'material',
      name: '青露草',
      type: 'herb',
      quality: '凡品',
      element: '木',
      description: '叶尖含露，药性温和的入门灵草。',
    },
  },
  {
    id: 'outer_recovery_pill',
    requiredRank: 'outer',
    price: 40,
    stock: 3,
    rotating: false,
    grant: {
      kind: 'pill',
      name: '宗门回气丹',
      quality: '凡品',
      description: '宗门制式回气丹，可恢复少量法力。',
      spec: recoveryPillSpec('mp', 40),
    },
  },
  {
    id: 'inner_ironwood',
    requiredRank: 'inner',
    price: 80,
    stock: 5,
    rotating: false,
    grant: {
      kind: 'material',
      name: '百炼铁木',
      type: 'aux',
      quality: '玄品',
      element: '木',
      description: '经百次灵火淬炼的铁木，可稳定丹器结构。',
    },
  },
  {
    id: 'inner_healing_pill',
    requiredRank: 'inner',
    price: 120,
    stock: 2,
    rotating: true,
    grant: {
      kind: 'pill',
      name: '玉髓回春丹',
      quality: '玄品',
      description: '内门储备的疗伤丹药。',
      spec: recoveryPillSpec('hp', 180),
    },
  },
  {
    id: 'true_cloud_ore',
    requiredRank: 'true',
    price: 220,
    stock: 2,
    rotating: true,
    grant: {
      kind: 'material',
      name: '凌霄云铁',
      type: 'ore',
      quality: '真品',
      element: '金',
      description: '凌霄峰云海灵压凝成的稀有灵铁。',
    },
  },
  {
    id: 'true_spirit_pill',
    requiredRank: 'true',
    price: 300,
    stock: 1,
    rotating: true,
    grant: {
      kind: 'pill',
      name: '凌霄蕴神丹',
      quality: '真品',
      description: '真传弟子方可兑换的高阶回气丹。',
      spec: recoveryPillSpec('mp', 260),
    },
  },
];

class LingxiaoEconomyPolicy implements SectEconomyPolicy {
  readonly donationDailyCap = 60;

  shopItems(weekKey: string): readonly SectShopDefinition[] {
    const rotating = shopItems.filter((item) => item.rotating);
    const parity = [...weekKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const selected = rotating.filter((_, index) => index % 2 === parity % 2);
    return [...shopItems.filter((item) => !item.rotating), ...selected];
  }

  donationDemands(
    sectId: string,
    dateKey: string,
  ): readonly SectDonationDemandDefinition[] {
    const seed = [...`${sectId}:${dateKey}`].reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const artifactDay = seed % 2 === 0;
    return [
      {
        id: 'spirit_stones',
        name: '修缮灵石',
        description: '提交 1000 灵石用于阵纹与工料周转。',
        kind: 'spirit_stones',
        quantity: 1000,
        contribution: 10,
        constructionPoints: 10,
      },
      {
        id: 'herb_bundle',
        name: '灵草束',
        description: '提交两份凡品以上灵草。',
        kind: 'material',
        quantity: 2,
        contribution: 15,
        constructionPoints: 15,
        minQuality: '凡品',
      },
      artifactDay
        ? {
            id: 'artifact_supply',
            name: '备用法宝',
            description: '提交一件未装备的凡品以上法宝。',
            kind: 'artifact',
            quantity: 1,
            contribution: 40,
            constructionPoints: 40,
            minQuality: '凡品',
          }
        : {
            id: 'pill_supply',
            name: '丹药补给',
            description: `提交一枚凡品以上${seed % 4 === 1 ? '疗伤类' : '回气类'}有效丹药。`,
            kind: 'pill',
            quantity: 1,
            contribution: 25,
            constructionPoints: 25,
            minQuality: '凡品',
            pillFamily: seed % 4 === 1 ? 'healing' : 'mana',
          },
    ];
  }

  stipendBase(rank: SectDiscipleRank): number {
    return { registered: 500, outer: 1500, inner: 4000, true: 10000 }[rank];
  }

  stipendRewards(
    rank: SectDiscipleRank,
    gardenLevel: number,
  ): readonly SectRewardGrantDefinition[] {
    const outerPill = shopItems.find(
      (item) => item.id === 'outer_recovery_pill',
    )?.grant;
    return [
      {
        quantity: gardenLevel,
        grant: {
          kind: 'material',
          name: rank === 'true' ? '凌霄灵蕴草' : '宗门灵草',
          type: 'herb',
          quality: rank === 'true' ? '真品' : '凡品',
          element: '木',
          description: '宗门药田按周分发的修行灵草。',
        },
      },
      ...(rank === 'outer' && outerPill?.kind === 'pill'
        ? [{ quantity: 1, grant: outerPill }]
        : []),
      ...(rank === 'inner'
        ? [{
            quantity: 3,
            grant: {
              kind: 'material',
              name: '百炼铁木',
              type: 'aux' as const,
              quality: '玄品' as const,
              element: '木',
              description: '内门周俸配发的基础丹器材料。',
            },
          }]
        : []),
    ];
  }
}

class LingxiaoConstructionPolicy implements SectConstructionPolicy {
  readonly facilities = [
    { key: 'archive', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'cultivation_room', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'workshop', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'spirit_vein', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'herb_garden', initialLevel: 1, maxLevel: 5, upgradeable: true },
    { key: 'formation', initialLevel: 0, maxLevel: 0, upgradeable: false },
  ] as const;

  readonly facilityPriority = [
    'archive',
    'cultivation_room',
    'workshop',
    'spirit_vein',
    'herb_garden',
  ] as const;

  projectBaseTarget(targetLevel: number): number {
    return { 2: 250, 3: 500, 4: 900, 5: 1500 }[targetLevel] ?? 1500;
  }

  nextProject(levels: ReadonlyMap<string, number>) {
    const candidate = [...this.facilityPriority]
      .filter((key) => {
        const facility = this.facilities.find((item) => item.key === key)!;
        return (levels.get(key) ?? facility.initialLevel) < facility.maxLevel;
      })
      .sort((left, right) => {
        const levelDiff = (levels.get(left) ?? 1) - (levels.get(right) ?? 1);
        return levelDiff || this.facilityPriority.indexOf(left) - this.facilityPriority.indexOf(right);
      })[0];
    return candidate
      ? { facilityKey: candidate, targetLevel: (levels.get(candidate) ?? 1) + 1 }
      : null;
  }
}

function opponentFactory(options: {
  title: string;
  name: string;
  multiplier: number;
  prefersMemberMirror?: boolean;
}): SectOpponentFactory {
  return {
    prefersMemberMirror: options.prefersMemberMirror ?? false,
    create({ player, mirror, opponentId }) {
      const source = options.prefersMemberMirror && mirror ? mirror : player;
      const opponent = structuredClone(source);
      opponent.id = opponentId;
      opponent.name = options.prefersMemberMirror && !mirror ? `无名${options.name}` : options.name;
      opponent.title = '宗门试炼残影';
      opponent.attributes = {
        vitality: Math.max(1, Math.floor(source.attributes.vitality * options.multiplier)),
        spirit: Math.max(1, Math.floor(source.attributes.spirit * options.multiplier)),
        wisdom: Math.max(1, Math.floor(source.attributes.wisdom * options.multiplier)),
        speed: Math.max(1, Math.floor(source.attributes.speed * options.multiplier)),
        willpower: Math.max(1, Math.floor(source.attributes.willpower * options.multiplier)),
      };
      if (!mirror) {
        opponent.sect = undefined;
        opponent.skills = [];
        opponent.cultivations = [];
        opponent.inventory = { ...opponent.inventory, artifacts: [] };
      }
      return { opponent, title: options.title };
    },
  };
}

const battleScenarios = new Map<string, SectOpponentFactory>([
  ['mine_patrol', opponentFactory({ title: '矿场巡视', name: '矿脉侵扰妖兽', multiplier: 0.75 })],
  ['weekly_tournament', opponentFactory({ title: '宗门小比', name: '同门试剑傀儡', multiplier: 0.95 })],
  ['weekly_bounty', opponentFactory({ title: '悬赏残影战', name: '叛徒残影', multiplier: 1, prefersMemberMirror: true })],
  ['elder_trial', opponentFactory({ title: '长老试炼', name: '传功长老剑影', multiplier: 1.05 })],
]);

class LingxiaoBattleScenarioCatalog implements SectBattleScenarioCatalog {
  get(taskId: SectOrganizationTaskId): SectOpponentFactory | undefined {
    return battleScenarios.get(taskId);
  }
}

const economy = new LingxiaoEconomyPolicy();

class LingxiaoRankPolicy implements SectRankPolicy {
  nextRank(rank: SectDiscipleRank): SectDiscipleRank | null {
    return ({ registered: 'outer', outer: 'inner', inner: 'true', true: null } as const)[rank];
  }

  methodLevelCap(rank: SectDiscipleRank): number {
    return { registered: 5, outer: 20, inner: 40, true: Number.MAX_SAFE_INTEGER }[
      rank
    ];
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
        minRealm: '金丹',
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

class LingxiaoBenefitPolicy implements SectBenefitPolicy {
  archiveLevel(levels: ReadonlyMap<string, number>): number {
    return levels.get('archive') ?? 1;
  }

  methodLevelCap(levels: ReadonlyMap<string, number>): number {
    const level = Math.max(1, Math.min(5, Math.floor(this.archiveLevel(levels))));
    return [0, 20, 40, 60, 80, 100][level] ?? 20;
  }

  gardenLevel(levels: ReadonlyMap<string, number>): number {
    return levels.get('herb_garden') ?? 1;
  }

  retreatMultiplier(levels: ReadonlyMap<string, number>): number {
    const level = levels.get('cultivation_room') ?? 1;
    return 1 + Math.max(0, Math.min(5, Math.floor(level))) * 0.02;
  }

  craftDiscount(
    craftContext: SectCraftContextKey,
    levels: ReadonlyMap<string, number>,
    rank: SectDiscipleRank,
  ) {
    const level = levels.get('workshop') ?? 1;
    return {
      capability:
        craftContext === SECT_CRAFT_CONTEXTS.refinery
          ? 'sect.facility.refinery.use'
          : 'sect.facility.alchemy.use',
      discount: Math.min(
        0.2,
        Math.max(0, Math.min(5, Math.floor(level))) * 0.02 +
          (rank === 'true' ? 0.1 : 0),
      ),
    };
  }

  stipendMultiplier(levels: ReadonlyMap<string, number>): number {
    const level = levels.get('spirit_vein') ?? 1;
    return 1 + Math.max(0, Math.min(5, Math.floor(level))) * 0.05;
  }
}

export class LingxiaoOrganizationModule implements SectOrganizationModule {
  readonly capabilities = capabilities;
  readonly ranks = new LingxiaoRankPolicy();
  readonly tasks = new LingxiaoTaskCatalog();
  readonly economy = economy;
  readonly construction = new LingxiaoConstructionPolicy();
  readonly battles = new LingxiaoBattleScenarioCatalog();
  readonly benefits = new LingxiaoBenefitPolicy();
}

export const LINGXIAO_ORGANIZATION = new LingxiaoOrganizationModule();

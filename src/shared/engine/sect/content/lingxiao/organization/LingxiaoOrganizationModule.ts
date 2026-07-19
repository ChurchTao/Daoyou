import type { PillSpec } from '@shared/types/consumable';
import {
  StandardSectPermissionPolicy,
  type SectBattleScenarioCatalog,
  type SectBattleScenarioDefinition,
  type SectConstructionPolicy,
  type SectDonationDemandDefinition,
  type SectEconomyPolicy,
  type SectOrganizationModule,
  type SectOrganizationTaskId,
  type SectRankPolicy,
  type SectShopDefinition,
  type SectTaskCatalog,
  type SectTaskDefinition,
} from '../../../core';
import type { SectDiscipleRank, SectRankRequirement } from '../../../core';

const permissions = new StandardSectPermissionPolicy({
  'scene.hall': 'registered',
  'scene.affairs': 'registered',
  'scene.archive': 'registered',
  'scene.enlightenment_cliff': 'registered',
  'scene.arena': 'registered',
  'scene.treasury': 'outer',
  'scene.industries': 'outer',
  'scene.cultivation_room': 'outer',
  'scene.alchemy': 'inner',
  'scene.refinery': 'inner',
  'scene.spirit_vein': 'registered',
  'scene.herb_garden': 'registered',
  'scene.cave': 'inner',
  'scene.gate': 'registered',
  'scene.formation': 'true',
  'task.pill_delivery': 'outer',
  'task.artifact_delivery': 'inner',
  'task.elder_trial': 'inner',
  'benefit.cultivation_room': 'outer',
  'benefit.workshop': 'inner',
}, new Set(['scene.formation']));

const tasks: readonly SectTaskDefinition[] = [
  {
    id: 'gate_sweep',
    name: '清扫山门',
    description: '循落叶纹路清理云阶，完成一轮山门勤务。',
    kind: 'daily',
    requiredRank: 'registered',
    contributionReward: 25,
    executor: 'sweep',
    target: 1,
  },
  {
    id: 'mine_patrol',
    name: '巡视矿场',
    description: '前往宗门矿脉驱逐侵扰妖兽。',
    kind: 'daily',
    requiredRank: 'registered',
    contributionReward: 30,
    executor: 'battle',
    target: 1,
  },
  {
    id: 'pill_delivery',
    name: '丹药委托',
    description: '提交一枚有效丹药，补充宗门日常储备。',
    kind: 'daily',
    requiredRank: 'outer',
    contributionReward: 35,
    executor: 'submit_pill',
    target: 1,
  },
  {
    id: 'artifact_delivery',
    name: '法宝委托',
    description: '提交一件未装备的凡品以上法宝，交由宗门统一调度。',
    kind: 'daily',
    requiredRank: 'inner',
    contributionReward: 45,
    executor: 'submit_artifact',
    target: 1,
  },
  {
    id: 'weekly_diligence',
    name: '勤务周录',
    description: '一周完成五次宗门日常。',
    kind: 'weekly',
    requiredRank: 'registered',
    contributionReward: 20,
    executor: 'progress',
    completionRole: 'weekly_diligence',
    target: 5,
  },
  {
    id: 'weekly_tournament',
    name: '宗门小比',
    description: '在试剑傀儡前验证本周修行。',
    kind: 'weekly',
    requiredRank: 'registered',
    contributionReward: 40,
    executor: 'battle',
    completionRole: 'promotion_tournament',
    target: 1,
  },
  {
    id: 'weekly_bounty',
    name: '悬赏令',
    description: '追缉叛徒残影或交付稀有材料。',
    kind: 'weekly',
    requiredRank: 'registered',
    contributionReward: 60,
    executor: 'battle',
    alternateExecutor: 'submit_material',
    rotation: 'battle_material',
    completionRole: 'promotion_bounty',
    target: 1,
  },
  {
    id: 'elder_trial',
    name: '长老试炼',
    description: '击败传功长老剑影，取得真传资格。',
    kind: 'promotion',
    requiredRank: 'inner',
    contributionReward: 0,
    executor: 'battle',
    completionRole: 'promotion_elder_trial',
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

  get(id: SectOrganizationTaskId): SectTaskDefinition | undefined {
    return this.byId.get(id);
  }

  findByRole(role: NonNullable<SectTaskDefinition['completionRole']>) {
    return tasks.find((task) => task.completionRole === role);
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

  stipendBase(rank: Parameters<SectRankPolicy['stipendBase']>[0]): number {
    return { registered: 500, outer: 1500, inner: 4000, true: 10000 }[rank];
  }

  stipendRewards(
    rank: Parameters<SectRankPolicy['stipendBase']>[0],
    gardenLevel: number,
  ) {
    const outerPill = shopItems.find(
      (item) => item.id === 'outer_recovery_pill',
    )?.grant;
    return {
      herbName: rank === 'true' ? '凌霄灵蕴草' : '宗门灵草',
      herbQuality: rank === 'true' ? ('真品' as const) : ('凡品' as const),
      herbQuantity: gardenLevel + (rank === 'inner' ? 3 : 0),
      bonusRewards: [
        ...(rank === 'outer' ? ['基础回气丹 ×1'] : []),
        ...(rank === 'inner' ? ['内门基础材料 ×3'] : []),
        ...(rank === 'true' ? ['真品凌霄灵蕴草'] : []),
      ],
      ...(rank === 'outer' && outerPill?.kind === 'pill'
        ? { bonusPill: outerPill }
        : {}),
    };
  }
}

class LingxiaoConstructionPolicy implements SectConstructionPolicy {
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
}

const battleScenarios: readonly SectBattleScenarioDefinition[] = [
  {
    taskId: 'mine_patrol',
    kind: 'scaled_npc',
    opponentName: '矿脉侵扰妖兽',
    title: '矿场巡视',
    attributeMultiplier: 0.75,
  },
  {
    taskId: 'weekly_tournament',
    kind: 'scaled_npc',
    opponentName: '同门试剑傀儡',
    title: '宗门小比',
    attributeMultiplier: 0.95,
  },
  {
    taskId: 'weekly_bounty',
    kind: 'member_mirror',
    opponentName: '叛徒残影',
    title: '悬赏残影战',
    attributeMultiplier: 1,
    fallback: {
      kind: 'scaled_npc',
      opponentName: '无名叛徒残影',
      title: '悬赏残影战',
      attributeMultiplier: 1,
    },
  },
  {
    taskId: 'elder_trial',
    kind: 'elder_projection',
    opponentName: '传功长老剑影',
    title: '长老试炼',
    attributeMultiplier: 1.05,
  },
];

class LingxiaoBattleScenarioCatalog implements SectBattleScenarioCatalog {
  get(taskId: SectOrganizationTaskId): SectBattleScenarioDefinition | undefined {
    return battleScenarios.find((scenario) => scenario.taskId === taskId);
  }
}

const economy = new LingxiaoEconomyPolicy();

class LingxiaoRankPolicy implements SectRankPolicy {
  stipendBase(rank: Parameters<SectRankPolicy['stipendBase']>[0]): number {
    return economy.stipendBase(rank);
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
        requiresTournament: true,
      },
      true: {
        rank: 'true',
        minRealm: '金丹',
        contribution: 3000,
        requiresBounty: true,
        requiresElderTrial: true,
      },
    };
    return requirements[rank];
  }
}

export class LingxiaoOrganizationModule implements SectOrganizationModule {
  readonly permissions = permissions;
  readonly ranks = new LingxiaoRankPolicy();
  readonly tasks = new LingxiaoTaskCatalog();
  readonly economy = economy;
  readonly construction = new LingxiaoConstructionPolicy();
  readonly battles = new LingxiaoBattleScenarioCatalog();
}

export const LINGXIAO_ORGANIZATION = new LingxiaoOrganizationModule();

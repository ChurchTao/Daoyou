import type {
  SectDiscipleRank,
  SectFacilityKey,
  UpgradeableSectFacilityKey,
} from '@shared/engine/sect';
import type { SectDonationDemandData, SectTaskOffer } from '@shared/contracts/sect';
import type { PillSpec } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';

export const SECT_TIMEZONE = 'Asia/Shanghai';
export const SECT_DONATION_DAILY_CAP = 60;
export const SECT_FACILITY_PRIORITY: UpgradeableSectFacilityKey[] = [
  'archive',
  'cultivation_room',
  'workshop',
  'spirit_vein',
  'herb_garden',
];
export const SECT_PROJECT_BASE_TARGET: Record<number, number> = {
  2: 250,
  3: 500,
  4: 900,
  5: 1500,
};

export const SECT_DAILY_TASKS: SectTaskOffer[] = [
  {
    id: 'gate_sweep',
    name: '清扫山门',
    description: '循落叶纹路清理云阶，完成一轮山门勤务。',
    kind: 'daily',
    requiredRank: 'registered',
    contributionReward: 25,
    action: 'sweep',
    available: true,
  },
  {
    id: 'mine_patrol',
    name: '巡视矿场',
    description: '前往宗门矿脉驱逐侵扰妖兽。',
    kind: 'daily',
    requiredRank: 'registered',
    contributionReward: 30,
    action: 'battle',
    available: true,
  },
  {
    id: 'pill_delivery',
    name: '丹药委托',
    description: '提交一枚有效丹药，补充宗门日常储备。',
    kind: 'daily',
    requiredRank: 'outer',
    contributionReward: 35,
    action: 'submit_pill',
    available: true,
  },
  {
    id: 'artifact_delivery',
    name: '法宝委托',
    description: '提交一件未装备的凡品以上法宝，交由宗门统一调度。',
    kind: 'daily',
    requiredRank: 'inner',
    contributionReward: 45,
    action: 'submit_artifact',
    available: true,
  },
];

export const SECT_WEEKLY_TASKS = [
  { id: 'weekly_diligence', target: 5, reward: 20 },
  { id: 'weekly_tournament', target: 1, reward: 40 },
  { id: 'weekly_bounty', target: 1, reward: 60 },
] as const;

export type SectShopGrant =
  | {
      kind: 'material';
      name: string;
      type: 'herb' | 'ore' | 'aux';
      quality: Quality;
      element?: string;
      description: string;
    }
  | {
      kind: 'pill';
      name: string;
      quality: Quality;
      description: string;
      spec: PillSpec;
    };

export interface SectShopDefinition {
  id: string;
  requiredRank: SectDiscipleRank;
  price: number;
  stock: number;
  rotating: boolean;
  grant: SectShopGrant;
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

export const SECT_SHOP_ITEMS: SectShopDefinition[] = [
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

function formatDateInTimezone(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SECT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getSectDateKey(now = new Date()): string {
  return formatDateInTimezone(now);
}

export function getSectWeekKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SECT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const local = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    values.weekday,
  );
  const daysSinceMonday = (weekday + 6) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  return local.toISOString().slice(0, 10);
}

export function getSectBountyMode(
  weekKey = getSectWeekKey(),
): 'battle' | 'material' {
  const seed = [...weekKey].reduce(
    (sum, char) => sum * 31 + char.charCodeAt(0),
    0,
  );
  return Math.abs(seed) % 2 === 0 ? 'battle' : 'material';
}

export function getSectDonationDemands(
  sectId: string,
  dateKey = getSectDateKey(),
): SectDonationDemandData[] {
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

export function getSectStipendBase(rank: SectDiscipleRank): number {
  return {
    registered: 500,
    outer: 1500,
    inner: 4000,
    true: 10000,
  }[rank];
}

export function isUpgradeableFacility(
  key: SectFacilityKey,
): key is UpgradeableSectFacilityKey {
  return key !== 'formation';
}

import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getResourceLabel, getResourceText } from '@shared/lib/resourceText';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import type { ConditionStatusKey } from '@shared/types/condition';
import {
  getEquipmentSlotLabel,
  getMaterialTypeLabel,
} from '@shared/types/dictionaries';
import type {
  ArtifactDraftItem,
  ConsumableDraftItem,
  ConsumablePillDraft,
  ConsumableTalismanDraft,
  DraftOperationType,
  MaterialDraftItem,
  RewardCatalogDraftItem,
} from './catalogDraft';

const SPEC_KIND_LABELS = {
  pill: '丹药',
  talisman: '符箓',
} as const;

const PILL_FAMILY_LABELS: Record<ConsumablePillDraft['family'], string> = {
  healing: '疗伤',
  mana: '回元',
  detox: '解毒',
  cultivation: '修为',
  insight: '感悟',
  breakthrough: '破境',
  tempering: '炼体',
  marrow_wash: '洗髓',
  hybrid: '复合',
};

const PILL_QUOTA_CATEGORY_LABELS: Record<
  ConsumablePillDraft['quotaCategory'],
  string
> = {
  none: '不限额',
  long_term: '境界总上限',
  cultivation: '修为丹上限',
};

const ALCHEMY_SOURCE_LABELS: Record<
  ConsumablePillDraft['alchemySource'],
  string
> = {
  improvised: '自由炼制',
  formula: '丹方炼制',
};

const OPERATION_TYPE_LABELS: Record<DraftOperationType, string> = {
  restore_resource: '恢复资源',
  change_gauge: '调整丹毒',
  remove_status: '移除状态',
  add_status: '添加状态',
  advance_track: '推进炼体',
  gain_progress: '增加进度',
};

const DURATION_KIND_LABELS = {
  '': '无',
  until_removed: '直到移除',
  time: '指定时间',
} as const;

const RESTORE_MODE_LABELS = {
  flat: '固定数值',
  percent: '按百分比',
} as const;

const TALISMAN_SESSION_MODE_LABELS: Record<
  ConsumableTalismanDraft['sessionMode'],
  string
> = {
  consume_on_action: '点击玩法时立即消耗',
  lock_on_enter_settle_on_exit: '进场锁定，结束结算时消耗',
};

const TALISMAN_SCENARIO_LABELS = {
  fate_reshape: '命格重塑',
  draw_gongfa: '问法寻卷·功法抽取',
  draw_skill: '问法寻卷·神通抽取',
} as const;

export type TalismanQuickPresetId =
  | 'talisman_reshape_fate'
  | 'talisman_draw_gongfa'
  | 'talisman_draw_skill';

interface TalismanQuickPreset {
  id: TalismanQuickPresetId;
  name: string;
  description: string;
  scenario: keyof typeof TALISMAN_SCENARIO_LABELS;
  sessionMode: ConsumableTalismanDraft['sessionMode'];
  notes: string;
}

export const TALISMAN_QUICK_PRESETS: TalismanQuickPreset[] = [
  {
    id: 'talisman_reshape_fate',
    name: '天机逆命符',
    description:
      '以此符遮蔽天机，逆转先天之数。前往命格重塑页后，点击开启会直接消耗 1 张，并抽出新的命格候选。',
    scenario: 'fate_reshape',
    sessionMode: 'consume_on_action',
    notes: '前往命格重塑页，点击开启后直接消耗。',
  },
  {
    id: 'talisman_draw_gongfa',
    name: '悟道演法符',
    description:
      '燃此符可神游太虚，感悟天地至理。前往问法寻卷页后，可直接消耗符箓抽取灵品及以上的功法秘籍；若行 5 连，至少可得一部真品，并自动放入材料背包。',
    scenario: 'draw_gongfa',
    sessionMode: 'consume_on_action',
    notes: '前往问法寻卷页，点击抽取后直接消耗。',
  },
  {
    id: 'talisman_draw_skill',
    name: '神通衍化符',
    description:
      '此符蕴含天地法则碎片。前往问法寻卷页后，可直接消耗符箓抽取灵品及以上的神通秘籍；若行 5 连，至少可得一部真品，并自动放入材料背包。',
    scenario: 'draw_skill',
    sessionMode: 'consume_on_action',
    notes: '前往问法寻卷页，点击抽取后直接消耗。',
  },
];

const TALISMAN_QUICK_PRESET_MAP = new Map(
  TALISMAN_QUICK_PRESETS.map((preset) => [preset.id, preset]),
);

export function getSpecKindLabel(
  kind: ConsumableDraftItem['spec']['kind'],
): string {
  return SPEC_KIND_LABELS[kind];
}

export function getMaterialTypeAlias(value: MaterialDraftItem['materialType']) {
  return getMaterialTypeLabel(value);
}

export function getEquipmentSlotAlias(value: ArtifactDraftItem['slot']) {
  return getEquipmentSlotLabel(value);
}

export function getPillFamilyAlias(value: ConsumablePillDraft['family']) {
  return PILL_FAMILY_LABELS[value];
}

export function getPillQuotaCategoryAlias(
  value: ConsumablePillDraft['quotaCategory'],
) {
  return PILL_QUOTA_CATEGORY_LABELS[value];
}

export function getAlchemySourceAlias(
  value: ConsumablePillDraft['alchemySource'],
) {
  return ALCHEMY_SOURCE_LABELS[value];
}

export function getOperationTypeAlias(type: DraftOperationType) {
  return OPERATION_TYPE_LABELS[type];
}

export function getStatusAlias(status: string) {
  return getConditionStatusTemplate(status as ConditionStatusKey)?.name ?? status;
}

export function getDurationKindAlias(
  value: ConsumablePillDraft['operations'][number]['durationKind'],
) {
  return DURATION_KIND_LABELS[value];
}

export function getRestoreModeAlias(mode: 'flat' | 'percent') {
  return RESTORE_MODE_LABELS[mode];
}

export function getTrackAlias(
  track: ConsumablePillDraft['operations'][number]['track'],
) {
  return getTrackConfig(track).name;
}

export function getProgressTargetAlias(
  target: ConsumablePillDraft['operations'][number]['target'],
) {
  return target === 'cultivation_exp'
    ? getResourceText('cultivation_exp')
    : '感悟';
}

export function getTalismanSessionModeAlias(
  mode: ConsumableTalismanDraft['sessionMode'],
) {
  return TALISMAN_SESSION_MODE_LABELS[mode];
}

export function getTalismanScenarioAlias(scenario: string) {
  return TALISMAN_SCENARIO_LABELS[
    scenario as keyof typeof TALISMAN_SCENARIO_LABELS
  ] ?? scenario;
}

export function getResourceAlias(resource: 'hp' | 'mp') {
  return getResourceLabel(resource);
}

export function applyTalismanQuickPreset(
  item: ConsumableDraftItem,
  presetId: TalismanQuickPresetId,
): ConsumableDraftItem {
  const preset = TALISMAN_QUICK_PRESET_MAP.get(presetId);
  if (!preset) {
    throw new Error(`未知符箓快捷模板：${presetId}`);
  }

  return {
    ...item,
    id: item.id.trim() || preset.id,
    name: preset.name,
    description: preset.description,
    consumableType: '符箓',
    quality: '仙品',
    prompt: '',
    score: '',
    spec: {
      kind: 'talisman',
      scenario: preset.scenario,
      sessionMode: preset.sessionMode,
      notes: preset.notes,
    },
  };
}

export function getDraftMeta(item: RewardCatalogDraftItem) {
  switch (item.type) {
    case 'material':
      return [
        getMaterialTypeAlias(item.materialType),
        item.rank,
        item.element || '无属性',
      ]
        .filter(Boolean)
        .join(' / ');
    case 'artifact':
      return [
        getEquipmentSlotAlias(item.slot),
        item.element,
        item.quality || '未设品质',
      ]
        .filter(Boolean)
        .join(' / ');
    case 'consumable':
      if (item.spec.kind === 'pill') {
        return [
          item.consumableType,
          item.quality || '未设品质',
          getPillFamilyAlias(item.spec.family),
        ]
          .filter(Boolean)
          .join(' / ');
      }

      return [
        item.consumableType,
        item.quality || '未设品质',
        item.spec.scenario
          ? getTalismanScenarioAlias(item.spec.scenario)
          : '未设玩法',
      ]
        .filter(Boolean)
        .join(' / ');
  }
}

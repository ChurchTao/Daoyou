import {
  parseRewardCatalog,
  type RewardCatalogItem,
} from '@shared/lib/rewardCatalog';
import {
  CONSUMABLE_TYPE_VALUES,
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
} from '@shared/types/constants';
import {
  PILL_FAMILY_VALUES,
  PILL_QUOTA_CATEGORY_VALUES,
  TALISMAN_SESSION_MODE_VALUES,
} from '@shared/types/consumable';

export const CONDITION_STATUS_KEY_OPTIONS = [
  'weakness',
  'minor_wound',
  'major_wound',
  'near_death',
  'breakthrough_focus',
  'protect_meridians',
  'clear_mind',
] as const;

export const CONDITION_TRACK_PATH_OPTIONS = [
  'tempering.vitality',
  'tempering.spirit',
  'tempering.wisdom',
  'tempering.speed',
  'tempering.willpower',
  'marrow_wash',
] as const;

export type CatalogDraftType = RewardCatalogItem['type'];
export type DraftOperationType =
  | 'restore_resource'
  | 'change_gauge'
  | 'remove_status'
  | 'add_status'
  | 'advance_track'
  | 'gain_progress';

export interface BaseDraftItem {
  id: string;
  name: string;
  description: string;
}

export interface MaterialDraftItem extends BaseDraftItem {
  type: 'material';
  materialType: (typeof MATERIAL_TYPE_VALUES)[number];
  rank: (typeof QUALITY_VALUES)[number];
  element: '' | (typeof ELEMENT_VALUES)[number];
}

export interface ArtifactDraftItem extends BaseDraftItem {
  type: 'artifact';
  slot: (typeof EQUIPMENT_SLOT_VALUES)[number];
  element: (typeof ELEMENT_VALUES)[number];
  quality: '' | (typeof QUALITY_VALUES)[number];
  effectsText: string;
}

export interface PillOperationDraft {
  type: DraftOperationType;
  resource: 'hp' | 'mp';
  mode: 'flat' | 'percent';
  value: string;
  delta: string;
  status: string;
  removeAll: 'false' | 'true';
  stacks: string;
  durationKind: '' | 'until_removed' | 'time';
  expiresAt: string;
  usesRemaining: string;
  payloadText: string;
  track: (typeof CONDITION_TRACK_PATH_OPTIONS)[number];
  target: 'cultivation_exp' | 'comprehension_insight';
}

export interface ConsumablePillDraft {
  kind: 'pill';
  family: (typeof PILL_FAMILY_VALUES)[number];
  quotaCategory: (typeof PILL_QUOTA_CATEGORY_VALUES)[number];
  alchemySource: 'improvised' | 'formula';
  formulaId: string;
  sourceMaterialsText: string;
  dominantElement: '' | (typeof ELEMENT_VALUES)[number];
  stability: string;
  toxicityRating: string;
  tagsText: string;
  operations: PillOperationDraft[];
}

export interface ConsumableTalismanDraft {
  kind: 'talisman';
  scenario: string;
  sessionMode: (typeof TALISMAN_SESSION_MODE_VALUES)[number];
  notes: string;
}

export interface ConsumableDraftItem extends BaseDraftItem {
  type: 'consumable';
  consumableType: (typeof CONSUMABLE_TYPE_VALUES)[number];
  quality: '' | (typeof QUALITY_VALUES)[number];
  prompt: string;
  score: string;
  spec: ConsumablePillDraft | ConsumableTalismanDraft;
}

export type RewardCatalogDraftItem =
  | MaterialDraftItem
  | ArtifactDraftItem
  | ConsumableDraftItem;

type RewardCatalogConsumableSpec = Extract<
  RewardCatalogItem,
  { type: 'consumable' }
>['data']['spec'];
type RewardCatalogPillSpec = Extract<RewardCatalogConsumableSpec, { kind: 'pill' }>;
type RewardCatalogPillOperation = RewardCatalogPillSpec['operations'][number];

function splitMultilineText(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createEmptyOperationDraft(
  type: DraftOperationType = 'restore_resource',
): PillOperationDraft {
  return {
    type,
    resource: 'hp',
    mode: 'flat',
    value: '',
    delta: '',
    status: CONDITION_STATUS_KEY_OPTIONS[0],
    removeAll: 'false',
    stacks: '',
    durationKind: '',
    expiresAt: '',
    usesRemaining: '',
    payloadText: '',
    track: CONDITION_TRACK_PATH_OPTIONS[0],
    target: 'cultivation_exp',
  };
}

export function createDefaultPillDraft(): ConsumablePillDraft {
  return {
    kind: 'pill',
    family: PILL_FAMILY_VALUES[0],
    quotaCategory: PILL_QUOTA_CATEGORY_VALUES[0],
    alchemySource: 'improvised',
    formulaId: '',
    sourceMaterialsText: '',
    dominantElement: '',
    stability: '',
    toxicityRating: '',
    tagsText: '',
    operations: [createEmptyOperationDraft()],
  };
}

export function createDefaultTalismanDraft(): ConsumableTalismanDraft {
  return {
    kind: 'talisman',
    scenario: '',
    sessionMode: TALISMAN_SESSION_MODE_VALUES[0],
    notes: '',
  };
}

export function createEmptyDraftItem(
  type: CatalogDraftType,
): RewardCatalogDraftItem {
  switch (type) {
    case 'material':
      return {
        type,
        id: '',
        name: '',
        description: '',
        materialType: MATERIAL_TYPE_VALUES[0],
        rank: QUALITY_VALUES[0],
        element: '',
      };
    case 'artifact':
      return {
        type,
        id: '',
        name: '',
        description: '',
        slot: EQUIPMENT_SLOT_VALUES[0],
        element: ELEMENT_VALUES[0],
        quality: '',
        effectsText: '[]',
      };
    case 'consumable':
      return {
        type,
        id: '',
        name: '',
        description: '',
        consumableType: CONSUMABLE_TYPE_VALUES[0],
        quality: '',
        prompt: '',
        score: '',
        spec: createDefaultPillDraft(),
      };
  }
}

function operationToDraft(operation: RewardCatalogPillOperation): PillOperationDraft {
  const draft = createEmptyOperationDraft(operation.type);

  switch (operation.type) {
    case 'restore_resource':
      draft.resource = operation.resource as 'hp' | 'mp';
      draft.mode = operation.mode as 'flat' | 'percent';
      draft.value = String(operation.value ?? '');
      break;
    case 'change_gauge':
      draft.delta = String(operation.delta ?? '');
      break;
    case 'remove_status':
      draft.status = String(operation.status ?? CONDITION_STATUS_KEY_OPTIONS[0]);
      draft.removeAll = operation.removeAll ? 'true' : 'false';
      break;
    case 'add_status':
      draft.status = String(operation.status ?? CONDITION_STATUS_KEY_OPTIONS[0]);
      draft.stacks = operation.stacks !== undefined ? String(operation.stacks) : '';
      draft.usesRemaining =
        operation.usesRemaining !== undefined
          ? String(operation.usesRemaining)
          : '';
      draft.payloadText = operation.payload
        ? JSON.stringify(operation.payload, null, 2)
        : '';
      if (operation.duration?.kind === 'until_removed') {
          draft.durationKind = 'until_removed';
      }
      if (operation.duration?.kind === 'time') {
        draft.durationKind = 'time';
        draft.expiresAt = String(operation.duration.expiresAt ?? '');
      }
      break;
    case 'advance_track':
      draft.track = operation.track as (typeof CONDITION_TRACK_PATH_OPTIONS)[number];
      draft.value = String(operation.value ?? '');
      break;
    case 'gain_progress':
      draft.target = operation.target as 'cultivation_exp' | 'comprehension_insight';
      draft.value = String(operation.value ?? '');
      break;
  }

  return draft;
}

export function rewardCatalogItemToDraft(
  item: RewardCatalogItem,
): RewardCatalogDraftItem {
  switch (item.type) {
    case 'material':
      return {
        type: 'material',
        id: item.id,
        name: item.data.name,
        description: item.data.description ?? '',
        materialType: item.data.type,
        rank: item.data.rank,
        element: item.data.element ?? '',
      };
    case 'artifact':
      return {
        type: 'artifact',
        id: item.id,
        name: item.data.name,
        description: item.data.description ?? '',
        slot: item.data.slot,
        element: item.data.element,
        quality: item.data.quality ?? '',
        effectsText: JSON.stringify(item.data.effects ?? [], null, 2),
      };
    case 'consumable':
      if (item.data.spec.kind === 'pill') {
        const alchemyMeta = item.data.spec.alchemyMeta;

        return {
          type: 'consumable',
          id: item.id,
          name: item.data.name,
          description: item.data.description ?? '',
          consumableType: item.data.type,
          quality: item.data.quality ?? '',
          prompt: item.data.prompt ?? '',
          score: item.data.score !== undefined ? String(item.data.score) : '',
          spec: {
            kind: 'pill',
            family: item.data.spec.family,
            quotaCategory: item.data.spec.consumeRules.quotaCategory,
            alchemySource: alchemyMeta.source,
            formulaId:
              alchemyMeta.source === 'formula' ? alchemyMeta.formulaId ?? '' : '',
            sourceMaterialsText: alchemyMeta.sourceMaterials.join('\n'),
            dominantElement: alchemyMeta.dominantElement ?? '',
            stability: String(alchemyMeta.stability),
            toxicityRating: String(alchemyMeta.toxicityRating),
            tagsText: alchemyMeta.tags.join('\n'),
            operations: item.data.spec.operations.map((operation) =>
              operationToDraft(operation),
            ),
          },
        };
      }

      return {
        type: 'consumable',
        id: item.id,
        name: item.data.name,
        description: item.data.description ?? '',
        consumableType: item.data.type,
        quality: item.data.quality ?? '',
        prompt: item.data.prompt ?? '',
        score: item.data.score !== undefined ? String(item.data.score) : '',
        spec: {
          kind: 'talisman',
          scenario: item.data.spec.scenario,
          sessionMode: item.data.spec.sessionMode,
          notes: item.data.spec.notes ?? '',
        },
      };
  }
}

function parseInteger(value: string, label: string) {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${label}必须是整数`);
  }
  return parsed;
}

function parseOptionalInteger(value: string, label: string) {
  if (!value.trim()) return undefined;
  return parseInteger(value, label);
}

function draftOperationToValue(operation: PillOperationDraft) {
  switch (operation.type) {
    case 'restore_resource':
      return {
        type: 'restore_resource' as const,
        resource: operation.resource,
        mode: operation.mode,
        value: parseInteger(operation.value, '恢复数值'),
      };
    case 'change_gauge':
      return {
        type: 'change_gauge' as const,
        gauge: 'pillToxicity' as const,
        delta: parseInteger(operation.delta, '毒性变化值'),
      };
    case 'remove_status':
      return {
        type: 'remove_status' as const,
        status: operation.status,
        ...(operation.removeAll === 'true' ? { removeAll: true } : {}),
      };
    case 'add_status': {
      const stacks = parseOptionalInteger(operation.stacks, '状态层数');
      const usesRemaining = parseOptionalInteger(
        operation.usesRemaining,
        '剩余次数',
      );
      let payload: Record<string, string | number | boolean> | undefined;
      if (operation.payloadText.trim()) {
        try {
          payload = JSON.parse(operation.payloadText) as Record<
            string,
            string | number | boolean
          >;
        } catch {
          throw new Error('状态载荷 JSON 格式错误');
        }
      }

      return {
        type: 'add_status' as const,
        status: operation.status,
        ...(stacks !== undefined ? { stacks } : {}),
        ...(usesRemaining !== undefined ? { usesRemaining } : {}),
        ...(operation.durationKind === 'until_removed'
          ? { duration: { kind: 'until_removed' as const } }
          : {}),
        ...(operation.durationKind === 'time'
          ? {
              duration: {
                kind: 'time' as const,
                expiresAt: operation.expiresAt.trim(),
              },
            }
          : {}),
        ...(payload ? { payload } : {}),
      };
    }
    case 'advance_track':
      return {
        type: 'advance_track' as const,
        track: operation.track,
        value: parseInteger(operation.value, '进度数值'),
      };
    case 'gain_progress':
      return {
        type: 'gain_progress' as const,
        target: operation.target,
        value: parseInteger(operation.value, '进度数值'),
      };
  }
}

export function rewardCatalogDraftToItem(
  draft: RewardCatalogDraftItem,
): RewardCatalogItem {
  let candidate: RewardCatalogItem;

  switch (draft.type) {
    case 'material':
      candidate = {
        id: draft.id.trim(),
        type: 'material',
        data: {
          name: draft.name.trim(),
          type: draft.materialType,
          rank: draft.rank,
          ...(draft.element ? { element: draft.element } : {}),
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
        },
      };
      break;
    case 'artifact': {
      let effects: Array<Record<string, unknown>> = [];
      if (draft.effectsText.trim()) {
        try {
          effects = JSON.parse(draft.effectsText) as Array<Record<string, unknown>>;
        } catch {
          throw new Error('法宝效果 JSON 格式错误');
        }
      }

      candidate = {
        id: draft.id.trim(),
        type: 'artifact',
        data: {
          name: draft.name.trim(),
          slot: draft.slot,
          element: draft.element,
          ...(draft.quality ? { quality: draft.quality } : {}),
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
          effects,
        },
      };
      break;
    }
    case 'consumable':
      candidate = {
        id: draft.id.trim(),
        type: 'consumable',
        data: {
          name: draft.name.trim(),
          type: draft.consumableType,
          ...(draft.quality ? { quality: draft.quality } : {}),
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
          ...(draft.prompt.trim() ? { prompt: draft.prompt.trim() } : {}),
          ...(draft.score.trim()
            ? { score: parseInteger(draft.score, '消耗品评分') }
            : {}),
          spec:
            draft.spec.kind === 'pill'
              ? {
                  kind: 'pill' as const,
                  family: draft.spec.family,
                  operations: draft.spec.operations.map((operation) =>
                    draftOperationToValue(operation),
                  ),
                  consumeRules: {
                    scene: 'out_of_battle_only' as const,
                    quotaCategory: draft.spec.quotaCategory,
                  },
                  alchemyMeta: {
                    source: draft.spec.alchemySource,
                    ...(draft.spec.alchemySource === 'formula'
                      ? { formulaId: draft.spec.formulaId.trim() }
                      : {}),
                    sourceMaterials: splitMultilineText(
                      draft.spec.sourceMaterialsText,
                    ),
                    ...(draft.spec.dominantElement
                      ? { dominantElement: draft.spec.dominantElement }
                      : {}),
                    stability: parseInteger(draft.spec.stability, '稳定度'),
                    toxicityRating: parseInteger(
                      draft.spec.toxicityRating,
                      '毒性评级',
                    ),
                    tags: splitMultilineText(draft.spec.tagsText),
                  },
                }
              : {
                  kind: 'talisman' as const,
                  scenario: draft.spec.scenario.trim(),
                  sessionMode: draft.spec.sessionMode,
                  ...(draft.spec.notes.trim()
                    ? { notes: draft.spec.notes.trim() }
                    : {}),
                },
        },
      };
      break;
  }

  return parseRewardCatalog([candidate])[0] as RewardCatalogItem;
}

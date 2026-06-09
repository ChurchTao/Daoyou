import {
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type EquipmentSlot,
  type MaterialType,
  type Quality,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import {
  TALISMAN_SESSION_MODE_VALUES,
  type ConditionOperation,
  type PillFamily,
  type PillQuotaCategory,
  type TalismanSessionMode,
} from '@shared/types/consumable';
import type {
  CreateItemLibraryEntry,
  ItemLibraryEntry,
  UpdateItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import type {
  ConditionStatusKey,
  ConditionTrackPath,
} from '@shared/types/condition';

export const ITEM_LIBRARY_STATUS_LABELS = {
  published: '已发布',
  archived: '已归档',
} satisfies Record<ItemLibraryEntry['status'], string>;

export const ITEM_LIBRARY_TYPE_LABELS = {
  material: '材料',
  consumable: '消耗品',
  artifact: '法宝',
} satisfies Record<ItemLibraryEntry['type'], string>;

export const PILL_FAMILY_LABELS = {
  healing: '疗伤丹',
  mana: '回元丹',
  detox: '解毒/调理丹',
  cultivation: '修为丹',
  insight: '悟性丹',
  breakthrough: '破境辅助丹',
  tempering: '淬体丹',
  marrow_wash: '洗髓丹',
  longevity: '延寿丹',
  hybrid: '复合丹',
} satisfies Record<PillFamily, string>;

export const PILL_QUOTA_LABELS = {
  none: '不占服用额度',
  long_term: '长期丹药额度',
  cultivation: '修为丹额度',
  longevity: '寿元丹额度',
} satisfies Record<PillQuotaCategory, string>;

export const TALISMAN_SESSION_MODE_LABELS = {
  lock_on_enter_settle_on_exit: '进入场景时锁定，离开时结算消耗',
  consume_on_action: '每次执行动作时消耗',
} satisfies Record<TalismanSessionMode, string>;

export const TRACK_OPTIONS = [
  { value: 'tempering.vitality', label: '淬体·体魄' },
  { value: 'tempering.spirit', label: '淬体·灵力' },
  { value: 'tempering.wisdom', label: '淬体·悟性' },
  { value: 'tempering.speed', label: '淬体·身法' },
  { value: 'tempering.willpower', label: '淬体·神识' },
  { value: 'marrow_wash', label: '洗髓' },
] satisfies Array<{ value: ConditionTrackPath; label: string }>;

export const PILL_OPERATION_LABELS = {
  restore_resource: '恢复气血/法力',
  gain_progress: '增加修为/悟性',
  increase_lifespan: '增加寿元',
  change_gauge: '增加/降低丹毒',
  add_status: '添加状态',
  remove_status: '移除状态',
  advance_track: '推进淬体/洗髓',
} satisfies Record<ConditionOperation['type'], string>;

export type VisualPillOperation =
  | {
      type: 'restore_resource';
      resource: 'hp' | 'mp';
      mode: 'flat' | 'percent';
      value: string;
    }
  | {
      type: 'change_gauge';
      delta: string;
    }
  | {
      type: 'remove_status';
      status: string;
      removeAll: boolean;
    }
  | {
      type: 'add_status';
      status: string;
      stacks: string;
      usesRemaining: string;
      durationKind: '' | 'until_removed' | 'time';
      expiresAt: string;
    }
  | {
      type: 'advance_track';
      track: ConditionTrackPath;
      value: string;
    }
  | {
      type: 'gain_progress';
      target: 'cultivation_exp' | 'comprehension_insight';
      value: string;
    }
  | {
      type: 'increase_lifespan';
      value: string;
    };

type StoredPillOperation = Extract<
  Extract<ItemLibraryEntry, { type: 'consumable' }>['payload']['spec'],
  { kind: 'pill' }
>['operations'][number];

export interface ItemLibraryDraft {
  rowId: string;
  itemId: string;
  type: ItemLibraryEntry['type'];
  status: ItemLibraryEntry['status'];
  name: string;
  description: string;
  materialType: MaterialType;
  materialRank: Quality;
  materialElement: '' | ElementType;
  consumableKind: 'pill' | 'talisman';
  consumableQuality: Quality;
  consumableElement: '' | ElementType;
  consumableScore: string;
  pillFamily: PillFamily;
  pillQuotaCategory: PillQuotaCategory;
  pillStability: string;
  pillToxicity: string;
  pillSourceMaterials: string;
  pillOperations: VisualPillOperation[];
  talismanScenario: string;
  talismanSessionMode: TalismanSessionMode;
  talismanNotes: string;
  artifactSlot: EquipmentSlot;
  artifactElement: ElementType;
  artifactQuality: Quality;
  artifactRealm: '' | RealmType;
  artifactRealmStage: '' | RealmStage;
  artifactAffixIds: string[];
  artifactPayload:
    | Extract<ItemLibraryEntry, { type: 'artifact' }>['payload']
    | null;
}

function toNumberText(value: unknown, fallback = ''): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : fallback;
}

function parseFiniteNumber(value: string, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label}必须是有效数字`);
  }
  return parsed;
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = parseFiniteNumber(value, label);
  if (parsed <= 0) {
    throw new Error(`${label}必须大于 0`);
  }
  return parsed;
}

function parseOptionalPositiveInt(value: string, label: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = parsePositiveNumber(value, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label}必须是整数`);
  }
  return parsed;
}

function splitSourceMaterials(value: string): string[] {
  return value
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDefaultPillOperation(family: PillFamily): VisualPillOperation {
  switch (family) {
    case 'mana':
      return {
        type: 'restore_resource',
        resource: 'mp',
        mode: 'flat',
        value: '100',
      };
    case 'detox':
      return {
        type: 'change_gauge',
        delta: '-20',
      };
    case 'cultivation':
      return {
        type: 'gain_progress',
        target: 'cultivation_exp',
        value: '50',
      };
    case 'insight':
      return {
        type: 'gain_progress',
        target: 'comprehension_insight',
        value: '10',
      };
    case 'breakthrough':
      return {
        type: 'add_status',
        status: 'clear_mind',
        stacks: '',
        usesRemaining: '1',
        durationKind: '',
        expiresAt: '',
      };
    case 'tempering':
      return {
        type: 'advance_track',
        track: 'tempering.vitality',
        value: '10',
      };
    case 'marrow_wash':
      return {
        type: 'advance_track',
        track: 'marrow_wash',
        value: '10',
      };
    case 'longevity':
      return {
        type: 'increase_lifespan',
        value: '10',
      };
    case 'healing':
    case 'hybrid':
      return {
        type: 'restore_resource',
        resource: 'hp',
        mode: 'flat',
        value: '100',
      };
  }
}

export function createDefaultPillOperation(
  type: ConditionOperation['type'],
): VisualPillOperation {
  switch (type) {
    case 'restore_resource':
      return {
        type,
        resource: 'hp',
        mode: 'flat',
        value: '100',
      };
    case 'change_gauge':
      return { type, delta: '5' };
    case 'remove_status':
      return { type, status: 'weakness', removeAll: true };
    case 'add_status':
      return {
        type,
        status: 'clear_mind',
        stacks: '',
        usesRemaining: '1',
        durationKind: '',
        expiresAt: '',
      };
    case 'advance_track':
      return { type, track: 'tempering.vitality', value: '10' };
    case 'gain_progress':
      return { type, target: 'cultivation_exp', value: '50' };
    case 'increase_lifespan':
      return { type, value: '10' };
  }
}

export function createEmptyDraft(): ItemLibraryDraft {
  return {
    rowId: '',
    itemId: '',
    type: 'material',
    status: 'published',
    name: '',
    description: '',
    materialType: MATERIAL_TYPE_VALUES[0],
    materialRank: QUALITY_VALUES[0],
    materialElement: '',
    consumableKind: 'pill',
    consumableQuality: QUALITY_VALUES[0],
    consumableElement: '',
    consumableScore: '80',
    pillFamily: 'healing',
    pillQuotaCategory: 'none',
    pillStability: '80',
    pillToxicity: '5',
    pillSourceMaterials: '',
    pillOperations: [buildDefaultPillOperation('healing')],
    talismanScenario: 'fate_reshape',
    talismanSessionMode: TALISMAN_SESSION_MODE_VALUES[0],
    talismanNotes: '',
    artifactSlot: EQUIPMENT_SLOT_VALUES[0],
    artifactElement: ELEMENT_VALUES[0],
    artifactQuality: QUALITY_VALUES[0],
    artifactRealm: '',
    artifactRealmStage: '',
    artifactAffixIds: [],
    artifactPayload: null,
  };
}

function visualOperationFromConditionOperation(
  operation: StoredPillOperation,
): VisualPillOperation {
  switch (operation.type) {
    case 'restore_resource':
      return {
        type: 'restore_resource',
        resource: operation.resource,
        mode: operation.mode,
        value:
          operation.mode === 'percent'
            ? String(operation.value * 100)
            : String(operation.value),
      };
    case 'change_gauge':
      return { type: 'change_gauge', delta: String(operation.delta) };
    case 'remove_status':
      return {
        type: 'remove_status',
        status: operation.status,
        removeAll: Boolean(operation.removeAll),
      };
    case 'add_status':
      return {
        type: 'add_status',
        status: operation.status,
        stacks: toNumberText(operation.stacks),
        usesRemaining: toNumberText(operation.usesRemaining),
        durationKind:
          operation.duration?.kind === 'until_removed' ||
          operation.duration?.kind === 'time'
            ? operation.duration.kind
            : '',
        expiresAt:
          operation.duration?.kind === 'time' ? operation.duration.expiresAt : '',
      };
    case 'advance_track':
      return {
        type: 'advance_track',
        track: operation.track as ConditionTrackPath,
        value: String(operation.value),
      };
    case 'gain_progress':
      return {
        type: 'gain_progress',
        target: operation.target,
        value: String(operation.value),
      };
    case 'increase_lifespan':
      return { type: 'increase_lifespan', value: String(operation.value) };
  }
}

export function entryToDraft(entry: ItemLibraryEntry): ItemLibraryDraft {
  const draft = createEmptyDraft();
  draft.rowId = entry.id;
  draft.itemId = entry.itemId;
  draft.type = entry.type;
  draft.status = entry.status;
  draft.name = entry.name;
  draft.description = entry.description ?? '';

  if (entry.type === 'material') {
    draft.materialType = entry.payload.type;
    draft.materialRank = entry.payload.rank;
    draft.materialElement = entry.payload.element ?? '';
  }

  if (entry.type === 'consumable') {
    draft.consumableKind = entry.payload.spec.kind;
    draft.consumableQuality = entry.payload.quality ?? QUALITY_VALUES[0];
    draft.consumableScore = toNumberText(entry.payload.score, '80');

    if (entry.payload.spec.kind === 'pill') {
      draft.pillFamily = entry.payload.spec.family;
      draft.pillQuotaCategory = entry.payload.spec.consumeRules.quotaCategory;
      draft.pillStability = String(entry.payload.spec.alchemyMeta.stability);
      draft.pillToxicity = String(entry.payload.spec.alchemyMeta.toxicityRating);
      draft.consumableElement =
        entry.payload.spec.alchemyMeta.dominantElement ?? '';
      draft.pillSourceMaterials =
        entry.payload.spec.alchemyMeta.sourceMaterials.join('、');
      draft.pillOperations =
        entry.payload.spec.operations.length > 0
          ? entry.payload.spec.operations.map(visualOperationFromConditionOperation)
          : [buildDefaultPillOperation(entry.payload.spec.family)];
    } else {
      draft.talismanScenario = entry.payload.spec.scenario;
      draft.talismanSessionMode = entry.payload.spec.sessionMode;
      draft.talismanNotes = entry.payload.spec.notes ?? '';
    }
  }

  if (entry.type === 'artifact') {
    draft.artifactSlot = entry.editorConfig.slot;
    draft.artifactElement = entry.editorConfig.element;
    draft.artifactQuality =
      entry.editorConfig.quality ?? entry.payload.quality ?? QUALITY_VALUES[0];
    draft.artifactRealm = entry.editorConfig.realm ?? '';
    draft.artifactRealmStage = entry.editorConfig.realmStage ?? '';
    draft.artifactAffixIds = entry.editorConfig.affixIds;
    draft.artifactPayload = entry.payload;
  }

  return draft;
}

function conditionOperationFromVisualOperation(
  operation: VisualPillOperation,
  index: number,
): ConditionOperation {
  const label = `第 ${index + 1} 个丹药效果`;

  switch (operation.type) {
    case 'restore_resource': {
      const value = parsePositiveNumber(operation.value, `${label}的恢复数值`);
      return {
        type: 'restore_resource',
        resource: operation.resource,
        mode: operation.mode,
        value: operation.mode === 'percent' ? value / 100 : value,
      };
    }
    case 'change_gauge':
      return {
        type: 'change_gauge',
        gauge: 'pillToxicity',
        delta: parseFiniteNumber(operation.delta, `${label}的丹毒变化`),
      };
    case 'remove_status':
      if (!operation.status.trim()) {
        throw new Error(`${label}必须选择要移除的状态`);
      }
      return {
        type: 'remove_status',
        status: operation.status.trim() as ConditionStatusKey,
        removeAll: operation.removeAll,
      };
    case 'add_status': {
      if (!operation.status.trim()) {
        throw new Error(`${label}必须选择要添加的状态`);
      }
      if (operation.durationKind === 'time' && !operation.expiresAt.trim()) {
        throw new Error(`${label}使用指定时间时必须填写结束时间`);
      }
      const stacks = parseOptionalPositiveInt(
        operation.stacks,
        `${label}的状态层数`,
      );
      const usesRemaining = parseOptionalPositiveInt(
        operation.usesRemaining,
        `${label}的可用次数`,
      );

      return {
        type: 'add_status',
        status: operation.status.trim() as ConditionStatusKey,
        ...(stacks ? { stacks } : {}),
        ...(usesRemaining ? { usesRemaining } : {}),
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
      };
    }
    case 'advance_track':
      return {
        type: 'advance_track',
        track: operation.track,
        value: parsePositiveNumber(operation.value, `${label}的推进数值`),
      };
    case 'gain_progress':
      return {
        type: 'gain_progress',
        target: operation.target,
        value: parsePositiveNumber(operation.value, `${label}的增加数值`),
      };
    case 'increase_lifespan':
      return {
        type: 'increase_lifespan',
        value: parsePositiveNumber(operation.value, `${label}的寿元年数`),
      };
  }
}

export function buildItemLibrarySubmitBody(
  draft: ItemLibraryDraft,
): CreateItemLibraryEntry | UpdateItemLibraryEntry {
  const name = draft.name.trim();
  if (!name) throw new Error('请填写名称');

  if (draft.type === 'material') {
    return {
      itemId: draft.itemId.trim(),
      type: 'material',
      status: draft.status,
      payload: {
        name,
        type: draft.materialType,
        rank: draft.materialRank,
        ...(draft.materialElement ? { element: draft.materialElement } : {}),
        ...(draft.description.trim()
          ? { description: draft.description.trim() }
          : {}),
      },
      editorConfig: {},
    };
  }

  if (draft.type === 'consumable') {
    const score = draft.consumableScore.trim()
      ? Math.floor(parsePositiveNumber(draft.consumableScore, '评分'))
      : undefined;

    if (draft.consumableKind === 'talisman') {
      if (!draft.talismanScenario.trim()) {
        throw new Error('请填写符箓使用场景');
      }

      return {
        itemId: draft.itemId.trim(),
        type: 'consumable',
        status: draft.status,
        payload: {
          name,
          type: '符箓',
          quality: draft.consumableQuality,
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
          ...(score ? { score } : {}),
          spec: {
            kind: 'talisman',
            scenario: draft.talismanScenario.trim(),
            sessionMode: draft.talismanSessionMode,
            ...(draft.talismanNotes.trim()
              ? { notes: draft.talismanNotes.trim() }
              : {}),
          },
        },
        editorConfig: {
          kind: 'talisman',
          scenario: draft.talismanScenario.trim(),
          sessionMode: draft.talismanSessionMode,
        },
      };
    }

    if (draft.pillOperations.length === 0) {
      throw new Error('请至少添加一个丹药效果');
    }

    const operations = draft.pillOperations.map(
      conditionOperationFromVisualOperation,
    );
    const stability = parseFiniteNumber(draft.pillStability, '药性稳定度');
    const toxicityRating = parseFiniteNumber(draft.pillToxicity, '丹毒');

    return {
      itemId: draft.itemId.trim(),
      type: 'consumable',
      status: draft.status,
      payload: {
        name,
        type: '丹药',
        quality: draft.consumableQuality,
        ...(draft.description.trim()
          ? { description: draft.description.trim() }
          : {}),
        ...(score ? { score } : {}),
        spec: {
          kind: 'pill',
          family: draft.pillFamily,
          operations,
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: draft.pillQuotaCategory,
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: splitSourceMaterials(draft.pillSourceMaterials),
            ...(draft.consumableElement
              ? { dominantElement: draft.consumableElement }
              : {}),
            stability,
            toxicityRating,
            tags: [
              draft.pillFamily,
              ...(draft.consumableElement ? [draft.consumableElement] : []),
            ],
          },
        },
      },
      editorConfig: {
        kind: 'pill',
        family: draft.pillFamily,
        quotaCategory: draft.pillQuotaCategory,
        operationTypes: operations.map((operation) => operation.type),
      },
    };
  }

  if (!draft.artifactPayload) {
    throw new Error('请先生成法宝预览');
  }

  return {
    itemId: draft.itemId.trim(),
    type: 'artifact',
    status: draft.status,
    payload: draft.artifactPayload,
    editorConfig: {
      slot: draft.artifactSlot,
      element: draft.artifactElement,
      quality: draft.artifactQuality,
      ...(draft.artifactRealm ? { realm: draft.artifactRealm } : {}),
      ...(draft.artifactRealmStage
        ? { realmStage: draft.artifactRealmStage }
        : {}),
      affixIds: draft.artifactAffixIds,
    },
  };
}

export function resetDraftForType(
  current: ItemLibraryDraft,
  type: ItemLibraryEntry['type'],
): ItemLibraryDraft {
  return {
    ...createEmptyDraft(),
    rowId: current.rowId,
    itemId: current.itemId,
    name: current.name,
    description: current.description,
    status: current.status,
    type,
  };
}

export function resetPillOperationsForFamily(
  draft: ItemLibraryDraft,
  family: PillFamily,
): ItemLibraryDraft {
  return {
    ...draft,
    pillFamily: family,
    pillOperations: [buildDefaultPillOperation(family)],
  };
}

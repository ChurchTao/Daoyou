import {
  AttributeType,
  ModifierType,
} from '@/engine/battle-v5/core/types';
import type {
  BattleInitConfigV5,
  PersistentCombatStatusV5,
  ResourcePointState,
  TrainingRoomModifierDraft,
} from '@/engine/battle-v5/setup/types';

export const TRAINING_ROOM_STORAGE_KEY = 'training-room-config-v1';
export const TRAINING_ROOM_STORAGE_VERSION = 1;

export interface TrainingRoomResourceDraft {
  mode: ResourcePointState['mode'];
  value: number;
}

export interface TrainingRoomPlayerDraft {
  hp: TrainingRoomResourceDraft;
  mp: TrainingRoomResourceDraft;
  shield: number;
  statusRefs: PersistentCombatStatusV5[];
}

export interface TrainingRoomDummyDraft {
  maxHp: number;
  maxMp: number;
  baseAttributes: {
    spirit: number;
    vitality: number;
    speed: number;
    willpower: number;
    wisdom: number;
  };
  modifiers: TrainingRoomModifierDraft[];
}

export interface TrainingRoomDraft {
  player: TrainingRoomPlayerDraft;
  dummy: TrainingRoomDummyDraft;
}

export interface TrainingRoomPreset {
  id: string;
  name: string;
  draft: TrainingRoomDraft;
  updatedAt: number;
}

export interface TrainingRoomStorage {
  version: number;
  currentDraft: TrainingRoomDraft;
  presets: TrainingRoomPreset[];
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeResourceState(
  value: TrainingRoomResourceDraft | undefined,
  fallback: TrainingRoomResourceDraft,
): TrainingRoomResourceDraft {
  const mode = value?.mode === 'absolute' ? 'absolute' : 'percent';
  const numericValue = toFiniteNumber(value?.value, fallback.value);

  return {
    mode,
    value: mode === 'percent' ? clampPercent(numericValue) : Math.max(0, numericValue),
  };
}

function sanitizeStatusRefs(value: unknown): PersistentCombatStatusV5[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((status): status is Partial<PersistentCombatStatusV5> =>
      !!status && typeof status === 'object',
    )
    .filter((status): status is PersistentCombatStatusV5 =>
      status.version === 1 &&
      typeof status.templateId === 'string' &&
      typeof status.stacks === 'number',
    )
    .map((status) => ({
      version: 1,
      templateId: status.templateId,
      stacks: Math.max(1, Math.floor(status.stacks)),
      usesRemaining:
        typeof status.usesRemaining === 'number'
          ? Math.max(0, Math.floor(status.usesRemaining))
          : undefined,
      expiresAt:
        typeof status.expiresAt === 'number' ? status.expiresAt : undefined,
      payload:
        status.payload && typeof status.payload === 'object'
          ? status.payload
          : undefined,
    }));
}

function sanitizeModifierDrafts(value: unknown): TrainingRoomModifierDraft[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((modifier) => {
      if (!modifier || typeof modifier !== 'object') return [];

      const candidate = modifier as Partial<TrainingRoomModifierDraft>;
      if (typeof candidate.id !== 'string') return [];
      const attrType = candidate.attrType as AttributeType | undefined;
      const modifierType = candidate.type as ModifierType | undefined;

      if (!Object.values(AttributeType).includes(attrType as AttributeType)) {
        return [];
      }
      if (!Object.values(ModifierType).includes(modifierType as ModifierType)) {
        return [];
      }
      if (modifierType === ModifierType.BASE) return [];
      if (typeof candidate.value !== 'number' || !Number.isFinite(candidate.value)) {
        return [];
      }

      return [
        {
          id: candidate.id,
          attrType: attrType as AttributeType,
          type: modifierType as TrainingRoomModifierDraft['type'],
          value: candidate.value,
        },
      ];
    });
}

function sanitizeDraft(value: unknown): TrainingRoomDraft {
  const fallback = createDefaultTrainingRoomDraft();
  if (!value || typeof value !== 'object') return fallback;

  const candidate = value as Partial<TrainingRoomDraft>;
  const dummy = (candidate.dummy ?? {}) as Partial<TrainingRoomDummyDraft>;

  return {
    player: fallback.player,
    dummy: {
      maxHp: Math.max(0, toFiniteNumber(dummy.maxHp, fallback.dummy.maxHp)),
      maxMp: Math.max(0, toFiniteNumber(dummy.maxMp, fallback.dummy.maxMp)),
      baseAttributes: {
        spirit: Math.max(
          0,
          toFiniteNumber(dummy.baseAttributes?.spirit, fallback.dummy.baseAttributes.spirit),
        ),
        vitality: Math.max(
          0,
          toFiniteNumber(dummy.baseAttributes?.vitality, fallback.dummy.baseAttributes.vitality),
        ),
        speed: Math.max(
          0,
          toFiniteNumber(dummy.baseAttributes?.speed, fallback.dummy.baseAttributes.speed),
        ),
        willpower: Math.max(
          0,
          toFiniteNumber(
            dummy.baseAttributes?.willpower,
            fallback.dummy.baseAttributes.willpower,
          ),
        ),
        wisdom: Math.max(
          0,
          toFiniteNumber(dummy.baseAttributes?.wisdom, fallback.dummy.baseAttributes.wisdom),
        ),
      },
      modifiers: sanitizeModifierDrafts(dummy.modifiers),
    },
  };
}

function sanitizePresets(value: unknown): TrainingRoomPreset[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((preset): preset is Partial<TrainingRoomPreset> =>
      !!preset && typeof preset === 'object',
    )
    .filter(
      (preset): preset is TrainingRoomPreset =>
        typeof preset.id === 'string' &&
        typeof preset.name === 'string' &&
        typeof preset.updatedAt === 'number',
    )
    .map((preset) => ({
      id: preset.id,
      name: preset.name,
      updatedAt: preset.updatedAt,
      draft: sanitizeDraft(preset.draft),
    }));
}

export function createDefaultTrainingRoomDraft(): TrainingRoomDraft {
  return {
    player: {
      hp: { mode: 'percent', value: 1 },
      mp: { mode: 'percent', value: 1 },
      shield: 0,
      statusRefs: [],
    },
    dummy: {
      maxHp: 100_000,
      maxMp: 0,
      baseAttributes: {
        spirit: 10,
        vitality: 10,
        speed: 10,
        willpower: 10,
        wisdom: 10,
      },
      modifiers: [],
    },
  };
}

export function createDefaultTrainingRoomStorage(): TrainingRoomStorage {
  return {
    version: TRAINING_ROOM_STORAGE_VERSION,
    currentDraft: createDefaultTrainingRoomDraft(),
    presets: [],
  };
}

export function parseTrainingRoomStorage(raw: string | null | undefined): TrainingRoomStorage {
  if (!raw) return createDefaultTrainingRoomStorage();

  try {
    const parsed = JSON.parse(raw) as Partial<TrainingRoomStorage>;
    if (parsed.version !== TRAINING_ROOM_STORAGE_VERSION) {
      return createDefaultTrainingRoomStorage();
    }

    return {
      version: TRAINING_ROOM_STORAGE_VERSION,
      currentDraft: sanitizeDraft(parsed.currentDraft),
      presets: sanitizePresets(parsed.presets),
    };
  } catch {
    return createDefaultTrainingRoomStorage();
  }
}

function toResourcePointState(
  draft: TrainingRoomResourceDraft,
): ResourcePointState {
  return {
    mode: draft.mode,
    value: draft.mode === 'percent' ? clampPercent(draft.value) : Math.max(0, draft.value),
  };
}

export function buildTrainingBattleInitConfig(
  draft: TrainingRoomDraft,
): BattleInitConfigV5 {
  const sanitized = sanitizeDraft(draft);

  const opponentModifiers = sanitized.dummy.modifiers.map((modifier) => ({
    attrType: modifier.attrType,
    type: modifier.type,
    value: modifier.value,
  }));

  if (sanitized.dummy.maxHp > 0) {
    opponentModifiers.unshift({
      attrType: AttributeType.MAX_HP,
      type: ModifierType.OVERRIDE,
      value: sanitized.dummy.maxHp,
    });
  }

  if (sanitized.dummy.maxMp > 0) {
    opponentModifiers.unshift({
      attrType: AttributeType.MAX_MP,
      type: ModifierType.OVERRIDE,
      value: sanitized.dummy.maxMp,
    });
  }

  return {
    player: {
      resourceState: {
        hp: toResourcePointState({ mode: 'percent', value: 1 }),
        mp: toResourcePointState({ mode: 'percent', value: 1 }),
        shield: 0,
      },
    },
    opponent: {
      baseAttributeOverrides: {
        [AttributeType.SPIRIT]: sanitized.dummy.baseAttributes.spirit,
        [AttributeType.VITALITY]: sanitized.dummy.baseAttributes.vitality,
        [AttributeType.SPEED]: sanitized.dummy.baseAttributes.speed,
        [AttributeType.WILLPOWER]: sanitized.dummy.baseAttributes.willpower,
        [AttributeType.WISDOM]: sanitized.dummy.baseAttributes.wisdom,
      },
      modifiers: opponentModifiers,
      resourceState: {
        hp:
          sanitized.dummy.maxHp > 0
            ? { mode: 'absolute', value: sanitized.dummy.maxHp }
            : { mode: 'percent', value: 1 },
        mp:
          sanitized.dummy.maxMp > 0
            ? { mode: 'absolute', value: sanitized.dummy.maxMp }
            : { mode: 'percent', value: 1 },
      },
    },
  };
}

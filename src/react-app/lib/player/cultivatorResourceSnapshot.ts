import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import type { Attributes, Cultivator } from '@shared/types/cultivator';

type PrimaryAttributeKey = keyof Attributes;
type SupportedAttributeKey = PrimaryAttributeKey | 'maxHp' | 'maxMp';
type ModifierTypeValue =
  | 'add'
  | 'base'
  | 'final'
  | 'fixed'
  | 'multiply'
  | 'override';

type ModifierLike = {
  attrType?: string;
  type?: string;
  value: number;
};

type ModifierCarrier = {
  id?: string;
  name: string;
  attributeModifiers?: ModifierLike[];
};

export interface CultivatorResourceSnapshot {
  final: Attributes;
  maxHp: number;
  maxMp: number;
}

const PRIMARY_ATTRIBUTE_KEYS: PrimaryAttributeKey[] = [
  'vitality',
  'spirit',
  'wisdom',
  'speed',
  'willpower',
];

const MAIN_PANEL_ATTRS = new Set<SupportedAttributeKey>([
  'maxHp',
  'maxMp',
  ...PRIMARY_ATTRIBUTE_KEYS,
]);

const SUPPORTED_ATTRS = new Set<SupportedAttributeKey>([
  ...PRIMARY_ATTRIBUTE_KEYS,
  'maxHp',
  'maxMp',
]);

const SUPPORTED_MODIFIER_TYPES = new Set<ModifierTypeValue>([
  'add',
  'base',
  'final',
  'fixed',
  'multiply',
  'override',
]);

function createModifierBuckets(): Record<SupportedAttributeKey, ModifierLike[]> {
  return {
    vitality: [],
    spirit: [],
    wisdom: [],
    speed: [],
    willpower: [],
    maxHp: [],
    maxMp: [],
  };
}

function isSupportedAttrKey(value: string | undefined): value is SupportedAttributeKey {
  return typeof value === 'string' && SUPPORTED_ATTRS.has(value as SupportedAttributeKey);
}

function isSupportedModifierType(
  value: string | undefined,
): value is ModifierTypeValue {
  return (
    typeof value === 'string' &&
    SUPPORTED_MODIFIER_TYPES.has(value as ModifierTypeValue)
  );
}

function normalizeInteger(value: number) {
  return Math.max(0, Math.floor(value));
}

function resolveValue(base: number, modifiers: ModifierLike[]) {
  const override = modifiers.find((modifier) => modifier.type === 'override');
  if (override) {
    return normalizeInteger(override.value);
  }

  let final = base;

  final += modifiers
    .filter((modifier) => modifier.type === 'fixed')
    .reduce((sum, modifier) => sum + modifier.value, 0);

  const addBonus = modifiers
    .filter((modifier) => modifier.type === 'add')
    .reduce((sum, modifier) => sum + modifier.value, 0);
  final *= 1 + addBonus;

  const multiplyBonus = modifiers
    .filter((modifier) => modifier.type === 'multiply')
    .reduce((product, modifier) => product * modifier.value, 1);
  final *= multiplyBonus;

  const finalModifier = modifiers.find((modifier) => modifier.type === 'final');
  if (finalModifier) {
    final += finalModifier.value;
  }

  return normalizeInteger(final);
}

function getCrossRealmModifierFactor(
  anchorRealm: RealmType | undefined,
  wearerRealm: RealmType,
) {
  if (!anchorRealm) return 1;

  const diff = REALM_ORDER[anchorRealm] - REALM_ORDER[wearerRealm];
  if (diff <= 0) return 1;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.55;
  if (diff === 3) return 0.45;
  return 0.35;
}

function scaleArtifactModifiers(
  modifiers: ModifierLike[] | undefined,
  factor: number,
) {
  if (!modifiers?.length || factor >= 0.999) {
    return modifiers ?? [];
  }

  return modifiers.map((modifier) => {
    const shouldScale =
      modifier.type === 'fixed' &&
      isSupportedAttrKey(modifier.attrType) &&
      MAIN_PANEL_ATTRS.has(modifier.attrType);

    if (!shouldScale) {
      return modifier;
    }

    return {
      ...modifier,
      value: modifier.value * factor,
    };
  });
}

function mountModifiers(
  buckets: Record<SupportedAttributeKey, ModifierLike[]>,
  carrier: ModifierCarrier,
  overrides?: { modifiers?: ModifierLike[] },
) {
  const modifiers = overrides?.modifiers ?? carrier.attributeModifiers ?? [];

  for (const modifier of modifiers) {
    if (
      !isSupportedAttrKey(modifier.attrType) ||
      !isSupportedModifierType(modifier.type)
    ) {
      continue;
    }

    buckets[modifier.attrType].push(modifier);
  }
}

function collectModifierBuckets(
  cultivator: Cultivator,
): Record<SupportedAttributeKey, ModifierLike[]> {
  const buckets = createModifierBuckets();

  for (const cultivation of cultivator.cultivations ?? []) {
    mountModifiers(buckets, cultivation);
  }

  const equippedIds = new Set(
    [
      cultivator.equipped?.weapon,
      cultivator.equipped?.armor,
      cultivator.equipped?.accessory,
    ].filter(Boolean),
  );

  for (const artifact of cultivator.inventory.artifacts ?? []) {
    if (!artifact.id || !equippedIds.has(artifact.id)) {
      continue;
    }

    const productModel = (artifact.productModel ?? {}) as {
      metadata?: { anchorRealm?: RealmType };
    };
    const factor = getCrossRealmModifierFactor(
      productModel.metadata?.anchorRealm,
      cultivator.realm,
    );

    mountModifiers(buckets, artifact, {
      modifiers: scaleArtifactModifiers(artifact.attributeModifiers, factor),
    });
  }

  return buckets;
}

export function getCultivatorResourceSnapshot(
  cultivator: Cultivator,
): CultivatorResourceSnapshot {
  const buckets = collectModifierBuckets(cultivator);

  const final = {
    vitality: resolveValue(cultivator.attributes.vitality ?? 0, buckets.vitality),
    spirit: resolveValue(cultivator.attributes.spirit ?? 0, buckets.spirit),
    wisdom: resolveValue(cultivator.attributes.wisdom ?? 0, buckets.wisdom),
    speed: resolveValue(cultivator.attributes.speed ?? 0, buckets.speed),
    willpower: resolveValue(
      cultivator.attributes.willpower ?? 0,
      buckets.willpower,
    ),
  };

  const maxHp = resolveValue(200 + final.vitality * 16, buckets.maxHp);
  const maxMp = resolveValue(
    100 + final.spirit * 5 + final.willpower * 3,
    buckets.maxMp,
  );

  return {
    final,
    maxHp,
    maxMp,
  };
}

import { CONSUMABLE_TOXICITY_DEFAULTS, getConsumableQualityScalar } from '@/config/consumableSystem';
import type { ConsumableCategory, ConsumableQuotaKind, Quality } from '@/types/constants';
import type { Attributes, Consumable, ConsumableUseSpec } from '@/types/cultivator';

type ConsumableDefinition = Pick<
  Consumable,
  'category' | 'mechanicKey' | 'quotaKind'
> & {
  useSpec: ConsumableUseSpec;
};

function buildAttributeDelta(
  quality: Quality | undefined,
  attribute: keyof Attributes,
): Partial<Attributes> {
  const scalar = getConsumableQualityScalar(quality);
  return {
    [attribute]: Math.max(1, Math.floor(1 * scalar)),
  };
}

function inferAttributeFromName(name: string): keyof Attributes {
  if (/神识|魂|念/u.test(name)) return 'willpower';
  if (/身法|遁|风/u.test(name)) return 'speed';
  if (/悟|慧|经/u.test(name)) return 'wisdom';
  if (/灵|元|海/u.test(name)) return 'spirit';
  return 'vitality';
}

function buildLegacyDefinition(consumable: Consumable): ConsumableDefinition | null {
  const quality = consumable.quality;
  const scalar = getConsumableQualityScalar(quality);
  const name = consumable.name;

  if (/疗伤|回春|生肌|续命/u.test(name)) {
    return {
      category: 'healing',
      mechanicKey: 'legacy_healing_pill',
      useSpec: {
        hpRecoverFlat: Math.floor(120 * scalar),
        woundRelief: quality && /续命/u.test(name) ? 2 : 1,
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.healing,
      },
    };
  }

  if (/回元|回气|回灵|复元/u.test(name)) {
    return {
      category: 'mana',
      mechanicKey: 'legacy_mana_pill',
      useSpec: {
        mpRecoverFlat: Math.floor(100 * scalar),
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.mana,
      },
    };
  }

  if (/聚气|养气|增元|凝气|益气/u.test(name)) {
    return {
      category: 'cultivation',
      mechanicKey: 'legacy_cultivation_pill',
      quotaKind: 'long_term_pill',
      useSpec: {
        cultivationExpGain: Math.floor(180 * scalar),
        comprehensionInsightGain: Math.max(1, Math.floor(3 * scalar)),
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.cultivation,
      },
    };
  }

  if (/破境|化婴|凝丹|筑基|结丹/u.test(name)) {
    return {
      category: 'breakthrough',
      mechanicKey: 'legacy_breakthrough_pill',
      quotaKind: 'long_term_pill',
      useSpec: {
        breakthroughChanceBonus: Number((0.03 * scalar).toFixed(3)),
        comprehensionInsightGain: Math.max(2, Math.floor(5 * scalar)),
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.breakthrough,
      },
    };
  }

  if (/洗髓|易筋|伐脉/u.test(name)) {
    return {
      category: 'marrow_wash',
      mechanicKey: 'legacy_marrow_wash_pill',
      quotaKind: 'long_term_pill',
      useSpec: {
        spiritualRootDelta: {
          mode: 'all',
          amount: Math.max(2, Math.floor(4 * scalar)),
          cap: 100,
        },
        aptitudeDelta: Math.max(1, Math.floor(2 * scalar)),
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.marrow_wash,
      },
    };
  }

  if (/解毒|祛毒|清毒/u.test(name)) {
    return {
      category: 'detox',
      mechanicKey: 'legacy_detox_pill',
      useSpec: {
        detoxifyAmount: Math.floor(20 * scalar),
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.detox,
      },
    };
  }

  if (/控毒|驭毒|镇毒/u.test(name)) {
    return {
      category: 'poison_control',
      mechanicKey: 'legacy_poison_control_pill',
      useSpec: {
        detoxifyAmount: Math.floor(12 * scalar),
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.poison_control,
      },
    };
  }

  if (/淬体|锻骨|强筋|补天/u.test(name)) {
    return {
      category: 'permanent_attribute',
      mechanicKey: 'legacy_permanent_attribute_pill',
      quotaKind: 'long_term_pill',
      useSpec: {
        attributeDelta: buildAttributeDelta(quality, inferAttributeFromName(name)),
        toxicityDelta: CONSUMABLE_TOXICITY_DEFAULTS.permanent_attribute,
      },
    };
  }

  if (name === '天机逆命符') {
    return {
      category: 'talisman_key',
      mechanicKey: 'fate_reshape_access',
      useSpec: {
        talisman: {
          scenario: 'fate_reshape',
          sessionMode: 'lock_on_enter_settle_on_exit',
        },
      },
    };
  }

  if (name === '悟道演法符') {
    return {
      category: 'talisman_key',
      mechanicKey: 'gongfa_draw_access',
      useSpec: {
        talisman: {
          scenario: 'draw_gongfa',
          sessionMode: 'lock_on_enter_settle_on_exit',
        },
      },
    };
  }

  if (name === '神通衍化符') {
    return {
      category: 'talisman_key',
      mechanicKey: 'skill_draw_access',
      useSpec: {
        talisman: {
          scenario: 'draw_skill',
          sessionMode: 'lock_on_enter_settle_on_exit',
        },
      },
    };
  }

  return null;
}

export const ConsumableRegistry = {
  normalizeConsumable(consumable: Consumable): Consumable {
    const derived = buildLegacyDefinition(consumable);
    return {
      ...consumable,
      category: consumable.category ?? derived?.category,
      mechanicKey: consumable.mechanicKey ?? derived?.mechanicKey,
      quotaKind:
        consumable.quotaKind ?? (derived?.quotaKind as ConsumableQuotaKind | undefined),
      useSpec: consumable.useSpec ?? derived?.useSpec,
      details: consumable.details,
    };
  },

  isDirectlyUsable(consumable: Consumable): boolean {
    const normalized = this.normalizeConsumable(consumable);
    return Boolean(
      normalized.useSpec &&
        normalized.category &&
        normalized.category !== 'talisman_key',
    );
  },
};

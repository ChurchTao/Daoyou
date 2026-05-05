import type { Cultivator } from '@/types/cultivator';
import { REALM_ORDER, type RealmType } from '@/types/constants';
import { AbilityFactory } from '../factories/AbilityFactory';
import {
  AttributeType,
  ModifierType,
  type UnitId,
} from '../core/types';
import type { AbilityConfig } from '../core/configs';
import { Unit } from '../units/Unit';

const ATTRIBUTE_MAP = {
  spirit: AttributeType.SPIRIT,
  vitality: AttributeType.VITALITY,
  speed: AttributeType.SPEED,
  wisdom: AttributeType.WISDOM,
  willpower: AttributeType.WILLPOWER,
} as const;

const ARTIFACT_MAIN_PANEL_ATTRS = new Set<AttributeType>([
  AttributeType.ATK,
  AttributeType.MAGIC_ATK,
  AttributeType.DEF,
  AttributeType.MAGIC_DEF,
  AttributeType.MAX_HP,
  AttributeType.MAX_MP,
  AttributeType.SPIRIT,
  AttributeType.VITALITY,
  AttributeType.SPEED,
  AttributeType.WISDOM,
  AttributeType.WILLPOWER,
]);

function getCrossRealmModifierFactor(
  anchorRealm: RealmType | undefined,
  wearerRealm: RealmType,
): number {
  if (!anchorRealm) return 1;
  const diff = REALM_ORDER[anchorRealm] - REALM_ORDER[wearerRealm];
  if (diff <= 0) return 1;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.55;
  if (diff === 3) return 0.45;
  return 0.35;
}

function scaleArtifactAbilityConfig(
  abilityConfig: AbilityConfig,
  factor: number,
): AbilityConfig {
  if (!abilityConfig.modifiers?.length || factor >= 0.999) {
    return abilityConfig;
  }

  return {
    ...abilityConfig,
    modifiers: abilityConfig.modifiers.map((modifier) => {
      const shouldScale =
        modifier.type === ModifierType.FIXED &&
        ARTIFACT_MAIN_PANEL_ATTRS.has(modifier.attrType);
      if (!shouldScale) return modifier;
      return {
        ...modifier,
        value: modifier.value * factor,
      };
    }),
  };
}

export function createCombatUnitFromCultivator(
  cultivator: Cultivator,
  isMirror: boolean = false,
): Unit {
  const baseAttrs: Partial<Record<AttributeType, number>> = {};

  for (const [cultivatorKey, attrType] of Object.entries(ATTRIBUTE_MAP)) {
    baseAttrs[attrType] =
      cultivator.attributes[cultivatorKey as keyof typeof cultivator.attributes] ?? 0;
  }

  const unitId = ((cultivator.id ?? cultivator.name) + (isMirror ? '_mirror' : '')) as UnitId;
  const unitName = isMirror ? `${cultivator.name}的镜像` : cultivator.name;
  const unit = new Unit(unitId, unitName, baseAttrs);

  for (const skill of cultivator.skills ?? []) {
    if (!skill.abilityConfig) continue;
    unit.abilities.addAbility(AbilityFactory.create(skill.abilityConfig));
  }

  for (const cultivation of cultivator.cultivations ?? []) {
    if (!cultivation.abilityConfig) continue;
    unit.abilities.addAbility(AbilityFactory.create(cultivation.abilityConfig));
  }

  const equippedIds = new Set(
    [cultivator.equipped.weapon, cultivator.equipped.armor, cultivator.equipped.accessory].filter(
      Boolean,
    ),
  );
  for (const artifact of cultivator.inventory.artifacts ?? []) {
    if (!artifact.id || !equippedIds.has(artifact.id) || !artifact.abilityConfig) {
      continue;
    }
    const productModel = (artifact.productModel ?? {}) as {
      metadata?: { anchorRealm?: RealmType };
    };
    const factor = getCrossRealmModifierFactor(
      productModel.metadata?.anchorRealm,
      cultivator.realm,
    );
    const effectiveAbilityConfig = scaleArtifactAbilityConfig(
      artifact.abilityConfig,
      factor,
    );
    unit.abilities.addAbility(AbilityFactory.create(effectiveAbilityConfig));
  }

  unit.updateDerivedStats();
  return unit;
}

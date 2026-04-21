import type { Cultivator } from '@/types/cultivator';
import { AbilityFactory } from '../factories/AbilityFactory';
import { AttributeType, type UnitId } from '../core/types';
import { Unit } from '../units/Unit';

const ATTRIBUTE_MAP = {
  spirit: AttributeType.SPIRIT,
  vitality: AttributeType.VITALITY,
  speed: AttributeType.SPEED,
  wisdom: AttributeType.WISDOM,
  willpower: AttributeType.WILLPOWER,
} as const;

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
    unit.abilities.addAbility(AbilityFactory.create(artifact.abilityConfig));
  }

  unit.updateDerivedStats();
  return unit;
}

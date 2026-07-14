import type { Cultivator } from '@shared/types/cultivator';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { getRealmStageRank } from '@shared/config/realmProgression';
import {
  getArtifactWearerRealmFactor,
  scaleArtifactMainPanelFixedModifiers,
} from '@shared/engine/shared/artifactRealmScaling';
import { buildBodyCultivationAttributeModifiers } from '@shared/lib/bodyCultivation/effects';
import { AbilityFactory } from '../factories/AbilityFactory';
import {
  AttributeType,
  type AttributeModifier,
  type UnitId,
} from '../core/types';
import type { AbilityConfig } from '../core/configs';
import { Unit } from '../units/Unit';
import { createSectAbilitySelectionStrategy } from '@shared/engine/sect';
import { projectSectCombat } from '@shared/engine/sect/content';

const ATTRIBUTE_MAP = {
  spirit: AttributeType.SPIRIT,
  vitality: AttributeType.VITALITY,
  speed: AttributeType.SPEED,
  wisdom: AttributeType.WISDOM,
  willpower: AttributeType.WILLPOWER,
} as const;

function mountBodyCultivationModifiers(unit: Unit, cultivator: Cultivator): void {
  for (const [index, modifier] of buildBodyCultivationAttributeModifiers(
    cultivator.condition,
  ).entries()) {
    const mountedModifier: AttributeModifier = {
      id: `bodyCultivation:body-cultivation:${modifier.attrType}:${index}`,
      attrType: modifier.attrType,
      type: modifier.type,
      value: modifier.value,
      source: {
        sourceType: 'bodyCultivation',
        carrierId: 'body-cultivation',
      },
    };
    unit.attributes.addModifier(mountedModifier);
  }
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
  unit.setSpiritualRoots(cultivator.spiritual_roots ?? []);
  unit.setRealmMeta({
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    realmRank: getRealmStageRank(cultivator.realm, cultivator.realm_stage),
  });

  const sectProjection = cultivator.sect
    ? projectSectCombat({ sect: cultivator.sect, realm: cultivator.realm })
    : null;

  for (const skill of sectProjection ? [] : (cultivator.skills ?? [])) {
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
      metadata?: { anchorRealm?: RealmType; anchorRealmStage?: RealmStage };
    };
    const factor = getArtifactWearerRealmFactor(
      artifact.battleRuntimeMeta?.anchorRealm ??
        productModel.metadata?.anchorRealm,
      artifact.battleRuntimeMeta?.anchorRealmStage ??
        productModel.metadata?.anchorRealmStage,
      cultivator.realm,
      cultivator.realm_stage,
    );
    const effectiveAbilityConfig: AbilityConfig =
      artifact.abilityConfig.modifiers?.length && factor < 0.999
        ? {
            ...artifact.abilityConfig,
            modifiers: scaleArtifactMainPanelFixedModifiers(
              artifact.abilityConfig.modifiers,
              factor,
            ),
          }
        : artifact.abilityConfig;
    unit.abilities.addAbility(AbilityFactory.create(effectiveAbilityConfig));
  }

  mountBodyCultivationModifiers(unit, cultivator);

  if (sectProjection) {
    for (const resource of sectProjection.resources) {
      unit.combatResources.define(resource);
    }
    if (sectProjection.defaultAttack) {
      unit.abilities.setDefaultAttack(AbilityFactory.create(sectProjection.defaultAttack));
    }
    for (const ability of sectProjection.abilities) {
      unit.abilities.addAbility(AbilityFactory.create(ability));
    }
    const selectionStrategy = createSectAbilitySelectionStrategy(sectProjection);
    if (selectionStrategy) {
      unit.abilities.setSelectionStrategy(selectionStrategy);
    }
    for (const method of sectProjection.methodModifiers) {
      for (const [index, modifier] of method.modifiers.entries()) {
        unit.attributes.addModifier({
          id: `sect-method:${method.methodId}:${modifier.attrType}:${index}`,
          ...modifier,
          source: { sourceType: 'sectMethod', carrierId: method.methodId },
        });
      }
    }
  }

  unit.updateDerivedStats();
  return unit;
}

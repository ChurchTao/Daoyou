import { getRealmStageRank } from '@shared/config/realmProgression';
import {
  getArtifactWearerRealmFactor,
  scaleArtifactMainPanelFixedModifiers,
} from '@shared/engine/shared/artifactRealmScaling';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import type { AbilityConfig } from '../core/configs';
import {
  AttributeType,
  type TeamId,
  type TeamSlot,
  type UnitId,
} from '../core/types';
import { AbilityFactory } from '../factories/AbilityFactory';
import type { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';

export type CultivatorCombatInput = Pick<
  Cultivator,
  | 'id'
  | 'name'
  | 'realm'
  | 'realm_stage'
  | 'attributes'
  | 'spiritual_roots'
  | 'pre_heaven_fates'
  | 'sect'
  | 'skills'
  | 'cultivations'
  | 'equipped'
  | 'condition'
> & {
  inventory: Pick<Cultivator['inventory'], 'artifacts'>;
};

const ATTRIBUTE_MAP = {
  vitality: AttributeType.VITALITY,
  strength: AttributeType.STRENGTH,
  spirit: AttributeType.SPIRIT,
  endurance: AttributeType.ENDURANCE,
  speed: AttributeType.SPEED,
  willpower: AttributeType.WILLPOWER,
} as const;

export function createCombatUnitFromCultivator(
  cultivator: CultivatorCombatInput,
  isMirror: boolean = false,
  runtime?: BattleRuntime,
  team?: { teamId: TeamId; slot: TeamSlot },
): Unit {
  const baseAttrs: Partial<Record<AttributeType, number>> = {};

  for (const [cultivatorKey, attrType] of Object.entries(ATTRIBUTE_MAP)) {
    baseAttrs[attrType] =
      cultivator.attributes[
        cultivatorKey as keyof typeof cultivator.attributes
      ] ?? 0;
  }

  const unitId = ((cultivator.id ?? cultivator.name) +
    (isMirror ? '_mirror' : '')) as UnitId;
  const unitName = isMirror ? `${cultivator.name}的镜像` : cultivator.name;
  const unit = new Unit(unitId, unitName, baseAttrs, { runtime, ...team });
  unit.setSpiritualRoots(cultivator.spiritual_roots ?? []);
  unit.setRealmMeta({
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    realmRank: getRealmStageRank(cultivator.realm, cultivator.realm_stage),
  });

  for (const skill of cultivator.skills ?? []) {
    if (!skill.abilityConfig) continue;
    unit.abilities.addAbility(AbilityFactory.create(skill.abilityConfig));
  }

  for (const cultivation of cultivator.cultivations ?? []) {
    if (!cultivation.abilityConfig) continue;
    unit.abilities.addAbility(AbilityFactory.create(cultivation.abilityConfig));
  }

  const equippedIds = new Set(
    [
      cultivator.equipped.weapon,
      cultivator.equipped.armor,
      cultivator.equipped.accessory,
    ].filter(Boolean),
  );
  for (const artifact of cultivator.inventory.artifacts ?? []) {
    if (
      !artifact.id ||
      !equippedIds.has(artifact.id) ||
      !artifact.abilityConfig
    ) {
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

  unit.updateDerivedStats();
  unit.initializeCurrentResourcesToMax();
  return unit;
}

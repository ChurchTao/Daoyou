import type { Cultivator } from '@shared/types/cultivator';
import { createCombatUnitFromCultivator } from '../adapters/CultivatorCombatAdapter';
import type { AttributeModifierConfig } from '../core/configs';
import { AttributeType } from '../core/types';
import { BuffFactory } from '../factories/BuffFactory';
import { Unit } from '../units/Unit';
import {
  getCombatStatusTemplate,
} from './CombatStatusTemplateRegistry';
import type {
  BattleInitConfigV5,
  BattleUnitInitSpec,
  PersistentCombatStatusV5,
  ResourcePointState,
} from './types';

const PRIMARY_ATTRIBUTE_TYPES = [
  AttributeType.SPIRIT,
  AttributeType.VITALITY,
  AttributeType.SPEED,
  AttributeType.WILLPOWER,
  AttributeType.WISDOM,
] as const;

function applyBaseAttributeOverrides(unit: Unit, spec?: BattleUnitInitSpec) {
  if (!spec?.baseAttributeOverrides) return;

  for (const attrType of PRIMARY_ATTRIBUTE_TYPES) {
    const value = spec.baseAttributeOverrides[attrType];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      unit.attributes.setBaseValue(attrType, Math.floor(value));
    }
  }
}

function mountModifierConfigs(
  unit: Unit,
  modifiers: AttributeModifierConfig[] | undefined,
  sourceKey: string,
) {
  if (!modifiers?.length) return;

  modifiers.forEach((modifier, index) => {
    unit.attributes.addModifier({
      id: `${sourceKey}:${modifier.attrType}:${modifier.type}:${index}`,
      attrType: modifier.attrType,
      type: modifier.type,
      value: modifier.value,
      source: {
        sourceType: 'battle_init',
        sourceKey,
      },
    });
  });
}

function resolveCurrentResource(
  resource: ResourcePointState | undefined,
  maxValue: number,
): number | undefined {
  if (!resource) return undefined;
  if (resource.mode === 'absolute') {
    return Math.max(0, Math.floor(resource.value));
  }
  return Math.max(0, Math.floor(maxValue * resource.value));
}

function applyStartingBuffs(
  unit: Unit,
  counterpart: Unit,
  spec?: BattleUnitInitSpec,
) {
  if (!spec?.startingBuffs?.length) return;

  for (const entry of spec.startingBuffs) {
    const buff = BuffFactory.create(entry.buff);
    const source = entry.source === 'opponent' ? counterpart : unit;
    unit.buffs.addBuff(buff, source);

    const targetLayers = Math.max(1, Math.floor(entry.stacks ?? 1));
    if (targetLayers > 1) {
      buff.setLayer(targetLayers);
    }

    if (!buff.isPermanent()) {
      buff.refreshToDuration(entry.buff.duration);
    }
  }
}

function applyStatusRefs(
  unit: Unit,
  counterpart: Unit,
  statusRefs: PersistentCombatStatusV5[] | undefined,
): { hp?: ResourcePointState; mp?: ResourcePointState; shield?: number } | undefined {
  if (!statusRefs?.length) return undefined;

  let deferredResourceState:
    | { hp?: ResourcePointState; mp?: ResourcePointState; shield?: number }
    | undefined;

  for (const status of statusRefs) {
    const template = getCombatStatusTemplate(status.templateId);
    if (!template) continue;

    const fragment = template.toBattleInit(status);
    applyBaseAttributeOverrides(unit, fragment);
    mountModifierConfigs(unit, fragment.modifiers, `status:${status.templateId}`);
    applyStartingBuffs(unit, counterpart, fragment);

    if (fragment.resourceState) {
      deferredResourceState = {
        ...deferredResourceState,
        ...fragment.resourceState,
      };
    }
  }

  return deferredResourceState;
}

function applyResourceState(
  unit: Unit,
  spec?: BattleUnitInitSpec,
  deferredResourceState?: BattleUnitInitSpec['resourceState'],
) {
  const resourceState = {
    ...deferredResourceState,
    ...spec?.resourceState,
  };

  const resolvedHp = resolveCurrentResource(resourceState.hp, unit.getMaxHp());
  const resolvedMp = resolveCurrentResource(resourceState.mp, unit.getMaxMp());

  if (typeof resolvedHp === 'number') {
    unit.setHp(resolvedHp);
  }

  if (typeof resolvedMp === 'number') {
    unit.setMp(resolvedMp);
  }

  if (typeof resourceState.shield === 'number' && Number.isFinite(resourceState.shield)) {
    unit.setShield(resourceState.shield);
  }
}

function applyUnitInit(
  unit: Unit,
  counterpart: Unit,
  spec?: BattleUnitInitSpec,
) {
  if (!spec) {
    unit.updateDerivedStats();
    return;
  }

  applyBaseAttributeOverrides(unit, spec);
  mountModifierConfigs(unit, spec.modifiers, `direct:${unit.id}`);
  const deferredResourceState = applyStatusRefs(unit, counterpart, spec.statusRefs);
  applyStartingBuffs(unit, counterpart, spec);
  unit.updateDerivedStats();
  applyResourceState(unit, spec, deferredResourceState);
}

export function createBattleUnitsWithInit(
  player: Cultivator,
  opponent: Cultivator,
  config?: BattleInitConfigV5,
): { playerUnit: Unit; opponentUnit: Unit } {
  const playerUnit = createCombatUnitFromCultivator(player);
  const opponentUnit = createCombatUnitFromCultivator(opponent);

  applyUnitInit(playerUnit, opponentUnit, config?.player);
  applyUnitInit(opponentUnit, playerUnit, config?.opponent);

  return {
    playerUnit,
    opponentUnit,
  };
}

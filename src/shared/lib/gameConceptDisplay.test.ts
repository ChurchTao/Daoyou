import { describe, expect, it } from 'vitest';
import {
  getCreationProductTypeLabel,
  getAttributeInfo,
  getElementInfo,
  getEquipmentSlotConceptLabel,
  getEquipmentSlotInfo,
  getGameConceptIcon,
  getGameConceptInfo,
  getGameConceptLabel,
  getGameConceptVariantLabel,
  getResourceDisplayName,
  getResourceIcon,
  getResourceLabel,
  getResourceText,
  getResourceTypeInfo,
  getSkillTypeInfo,
  getStatusEffectInfo,
} from './gameConceptDisplay';
import { getAlchemyPropertyLabel } from './alchemyProperties';

describe('game concept display registry', () => {
  it('locks the core resource labels and icons', () => {
    expect(getGameConceptInfo('hp')).toMatchObject({
      label: '气血',
      icon: '❤️',
    });
    expect(getGameConceptInfo('mp')).toMatchObject({
      label: '法力',
      icon: '💧',
    });
    expect(getGameConceptInfo('spirit_stones')).toMatchObject({
      label: '灵石',
      icon: '💎',
    });
    expect(getGameConceptInfo('cultivation_exp')).toMatchObject({
      label: '修为',
      icon: '🧘',
    });
    expect(getGameConceptInfo('comprehension_insight')).toMatchObject({
      label: '感悟',
      icon: '💡',
    });
    expect(getGameConceptInfo('world_qi')).toMatchObject({
      label: '天地灵气',
      icon: '🍃',
    });
  });

  it('keeps resource helper aliases aligned with the registry', () => {
    expect(getResourceText('hp_loss')).toBe(getGameConceptLabel('hp_loss'));
    expect(getResourceText('mp_loss')).toBe(getGameConceptLabel('mp_loss'));
    expect(getResourceLabel('mp')).toBe(getGameConceptLabel('mp'));
    expect(getResourceIcon('spirit_stones')).toBe(
      getGameConceptIcon('spirit_stones'),
    );
    expect(getResourceDisplayName('comprehension_insight')).toBe(
      getGameConceptLabel('comprehension_insight'),
    );
    expect(getResourceTypeInfo('artifact_damage')).toEqual({
      label: getGameConceptLabel('artifact_damage'),
      icon: getGameConceptIcon('artifact_damage'),
    });
  });

  it('does not conflate battle resources with base attributes', () => {
    expect(getResourceText('mp')).toBe('法力');
    expect(getAttributeInfo('spirit')).toMatchObject({
      label: '灵力',
      icon: '⚡',
    });
    expect(getResourceText('cultivation_exp')).toBe('修为');
    expect(getAttributeInfo('wisdom')).toMatchObject({
      label: '悟性',
      icon: '🧠',
    });
  });

  it('keeps derived dictionary helpers aligned with the registry', () => {
    expect(getElementInfo('雷')).toEqual({
      label: getGameConceptLabel('element_thunder'),
      icon: getGameConceptIcon('element_thunder'),
    });
    expect(getEquipmentSlotInfo('weapon')).toEqual({
      label: getGameConceptLabel('equipment_weapon'),
      icon: getGameConceptIcon('equipment_weapon'),
    });
    expect(getSkillTypeInfo('heal')).toMatchObject({
      label: getGameConceptLabel('skill_type_heal'),
      icon: getGameConceptIcon('skill_type_heal'),
    });
    expect(getStatusEffectInfo('mana_depleted')).toMatchObject({
      label: getGameConceptLabel('status_mana_depleted'),
      icon: getGameConceptIcon('status_mana_depleted'),
    });
  });

  it('derives product and slot wording variants from the registry', () => {
    expect(getCreationProductTypeLabel('artifact')).toBe(
      getGameConceptLabel('artifact'),
    );
    expect(getCreationProductTypeLabel('artifact', 'naming')).toBe(
      getGameConceptVariantLabel('artifact', 'naming'),
    );
    expect(getEquipmentSlotConceptLabel('weapon', 'intent')).toBe(
      getGameConceptVariantLabel('equipment_weapon', 'intent'),
    );
    expect(getEquipmentSlotConceptLabel('weapon', 'productNaming')).toBe(
      getGameConceptVariantLabel('equipment_weapon', 'productNaming'),
    );
  });

  it('derives composed alchemy labels from core concepts', () => {
    expect(getAlchemyPropertyLabel('restore_hp')).toBe(
      `补充${getGameConceptLabel('hp')}`,
    );
    expect(getAlchemyPropertyLabel('restore_mp')).toBe(
      `回补${getGameConceptLabel('mp')}`,
    );
    expect(getAlchemyPropertyLabel('tempering_spirit')).toBe(
      `炼体·${getGameConceptLabel('spirit')}`,
    );
  });
});

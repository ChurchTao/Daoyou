import {
  EffectType,
  HookAim,
  HookName,
  SkillTag,
  StatusCategory,
  TargetMode,
  TargetSide,
  type SkillDef,
  type StatusDef,
} from '../core';
import { DAO_RAGE_PASSIVE_ID, DAO_RAGE_RESOURCE_ID } from './special-ids';
import type { EquipmentSpecialPack } from './special-pack';
import type { DaoEquipmentArtDefV1, DaoEquipmentEssenceDefV1 } from './types';

export function compileEquipmentEssence(
  entry: EquipmentSpecialPack['essences'][number],
): DaoEquipmentEssenceDefV1 {
  const { effect, ...identity } = entry;
  switch (effect.type) {
    case 'panelAdd':
      return {
        ...identity,
        panel: [{ attr: effect.attribute, mode: 'add', value: effect.value }],
      };
    case 'requiredLevelOffset':
      return { ...identity, requiredLevelOffset: effect.value };
    case 'rageGain':
      return {
        ...identity,
        resourceGainFactors: { [DAO_RAGE_RESOURCE_ID]: effect.factor },
      };
    case 'rageCost':
      return {
        ...identity,
        resourceCostFactors: { [DAO_RAGE_RESOURCE_ID]: effect.factor },
      };
  }
}

export function compileEquipmentArt(
  entry: EquipmentSpecialPack['arts'][number],
): DaoEquipmentArtDefV1 {
  const { effect } = entry;
  const skill: SkillDef = {
    id: entry.skillId,
    name: entry.name,
    resourceCosts: [
      { resourceId: DAO_RAGE_RESOURCE_ID, amount: entry.rageCost },
    ],
    tags: [SkillTag.Support],
    targeting: { side: TargetSide.Ally, count: 1 },
    effects: [],
  };
  let statusDefs: StatusDef[] | undefined;
  switch (effect.type) {
    case 'heal':
      skill.effects = [
        { type: EffectType.Heal, power: `target.maxHp * ${effect.ratio}` },
      ];
      break;
    case 'restoreMp':
      skill.effects = [
        { type: EffectType.RestoreMp, power: `target.maxMp * ${effect.ratio}` },
      ];
      break;
    case 'revive':
      skill.targeting = {
        side: TargetSide.Ally,
        count: 1,
        includeDowned: true,
      };
      skill.effects = [{ type: EffectType.Revive, hpRatio: effect.hpRatio }];
      break;
    case 'dispel':
      skill.targeting = {
        side: effect.side === 'ally' ? TargetSide.Ally : TargetSide.Enemy,
        count: 1,
      };
      skill.effects = [
        {
          type: EffectType.Dispel,
          categories: effect.categories.map((category) =>
            category === 'buff' ? StatusCategory.Buff : StatusCategory.Control,
          ),
        },
      ];
      break;
    case 'defenseBuff':
      statusDefs = [
        {
          id: effect.statusId,
          name: entry.name,
          kind:
            effect.attribute === 'physicalDef'
              ? 'dao_equipment.guard.physical'
              : 'dao_equipment.guard.spell',
          category: StatusCategory.Buff,
          attrMods: {
            [effect.attribute]: `floor(target.${effect.attribute} * ${effect.ratio})`,
          },
        },
      ];
      skill.targeting = { side: TargetSide.Ally, mode: TargetMode.All };
      skill.effects = [
        {
          type: EffectType.ApplyStatus,
          statusId: effect.statusId,
          duration: effect.duration,
        },
      ];
      break;
    case 'physicalHit':
      skill.tags = [SkillTag.Physical];
      skill.targeting = { side: TargetSide.Enemy, count: 1 };
      skill.effects = [
        {
          type: EffectType.PhysicalHit,
          coeff: effect.coefficient,
          defenseIgnore: effect.defenseIgnore,
        },
      ];
      break;
    case 'spellHit':
      skill.tags = [SkillTag.Spell];
      skill.targeting = {
        side: TargetSide.Enemy,
        mode: TargetMode.Fill,
        count: effect.targetCount,
      };
      skill.effects = [
        { type: EffectType.SpellHit, coeff: effect.coefficient },
      ];
      break;
  }
  return {
    id: entry.id,
    name: entry.name,
    ...(entry.allowedSlots ? { allowedSlots: entry.allowedSlots } : {}),
    rageCost: entry.rageCost,
    skill,
    ...(statusDefs ? { statusDefs } : {}),
  };
}

export function compileRageGainPassive(
  factor: number,
  rule: EquipmentSpecialPack['rageGain'],
): SkillDef {
  const excited = factor > 1;
  return {
    id: excited ? DAO_RAGE_PASSIVE_ID.Excited : DAO_RAGE_PASSIVE_ID.Base,
    name: excited ? '激昂战意' : '战意积蓄',
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
    hooks: [
      {
        on: HookName.OnBeHit,
        sourceIsSelf: true,
        aim: HookAim.Self,
        effects: [
          {
            type: EffectType.ModifyResource,
            resourceId: DAO_RAGE_RESOURCE_ID,
            amount: `min(${rule.maxPerHit}, max(${rule.minPerHit}, floor(floor(hpDamage / target.maxHp * ${rule.damagePercentScale}) * ${factor})))`,
            maxGainPerAction: rule.maxPerAction,
          },
        ],
      },
    ],
  };
}

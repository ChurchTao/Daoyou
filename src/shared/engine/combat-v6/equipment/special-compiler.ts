import {
  DamageKind,
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
import { DaoyouRule } from '../rules-daoyou/constants';
import { DAO_RAGE_PASSIVE_ID, DAO_RAGE_RESOURCE_ID } from './special-ids';
import type { EquipmentSpecialPack } from './special-pack';
import type { DaoEquipmentArtDefV1, DaoEquipmentEssenceDefV1 } from './types';

export function compileEquipmentEssence(
  entry: EquipmentSpecialPack['essences'][number],
): DaoEquipmentEssenceDefV1 {
  const { effect, ...entryIdentity } = entry;
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(effect)) {
    if (typeof value !== 'number') continue;
    values[key] = value;
    values[`${key}Abs`] = Math.abs(value);
    values[`${key}Percent`] = Number((value * 100).toFixed(6));
  }
  const identity = {
    ...entryIdentity,
    description: entry.description.replace(/\{(\w+)\}/g, (_, key: string) => {
      if (!(key in values)) throw new Error(`${entry.id}: 未知文案参数 ${key}`);
      return String(values[key]);
    }),
  };
  const passive: SkillDef = {
    id: `${entry.id}.passive`,
    name: entry.name,
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
  };
  switch (effect.type) {
    case 'panelAdd':
      return {
        ...identity,
        panel: [{ attr: effect.attribute, mode: 'add', value: effect.value }],
      };
    case 'requiredStageOffset':
      return { ...identity, requiredStageOffset: effect.value };
    case 'sealChance':
      // Convert probability to the owning ruleset's point scale BEFORE its shared caps.
      return {
        ...identity,
        panel: [
          {
            attr: effect.side === 'hit' ? 'sealHit' : 'sealResist',
            mode: 'add',
            value: effect.value * DaoyouRule.hitChanceScale,
          },
        ],
      };
    case 'antiCrit':
    case 'defenseIgnore':
      return {
        ...identity,
        passive: {
          ...passive,
          hooks: [
            {
              on:
                effect.type === 'antiCrit'
                  ? HookName.OnCritRoll
                  : HookName.OnDefenseIgnoreCalc,
              ...(effect.type === 'antiCrit'
                ? { targetIsSelf: true }
                : { sourceIsSelf: true }),
              requireKind:
                effect.kind === 'physical'
                  ? DamageKind.Physical
                  : DamageKind.Spell,
              effects: [
                {
                  type:
                    effect.type === 'antiCrit'
                      ? EffectType.ModifyChance
                      : EffectType.ModifyDefenseIgnore,
                  add:
                    effect.type === 'antiCrit' ? -effect.value : effect.value,
                },
              ],
            },
          ],
        },
      };
    case 'mpWaiver':
      return {
        ...identity,
        passive: { ...passive, innate: { mpCostWaiverChance: effect.chance } },
      };
    case 'regeneration':
      return {
        ...identity,
        passive: {
          ...passive,
          hooks: [
            {
              on: HookName.OnRoundEnd,
              aim: HookAim.Self,
              when: { sourceStanding: true },
              effects: [
                {
                  type: EffectType.RestoreHp,
                  power: `floor(source.level * ${effect.levelRatio})`,
                },
              ],
            },
          ],
        },
      };
    case 'revival':
      return {
        ...identity,
        passive: {
          ...passive,
          hooks: [
            {
              on: HookName.OnFatal,
              targetIsSelf: true,
              aim: HookAim.Self,
              when: { sourceHpRatioBelow: 0.000001 },
              chance: effect.chance,
              effects: [{ type: EffectType.Revive, hpRatio: effect.hpRatio }],
            },
          ],
        },
      };
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
  const values: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(effect)) {
    if (typeof value === 'number') {
      values[key] = value;
      values[`${key}Percent`] = Number((Math.abs(value) * 100).toFixed(6));
    }
  }
  if (effect.type === 'attack') values.hits = effect.resultFactors.length;
  if (effect.type === 'attack')
    values.segments = effect.resultFactors
      .map((v) => `${Number((v * 100).toFixed(6))}%`)
      .join('、');
  if (effect.type === 'status')
    values.term =
      effect.duration === 'battle'
        ? '持续至战斗结束，倒地清除'
        : `持续${effect.duration}回合（含施放回合）`;
  const description = entry.description.replace(
    /\{(\w+)\}/g,
    (_, key: string) => {
      if (!(key in values)) throw new Error(`${entry.id}: 未知文案参数 ${key}`);
      return String(values[key]);
    },
  );
  const side =
    entry.target === 'self'
      ? TargetSide.Self
      : ['ally', 'allies'].includes(entry.target)
        ? TargetSide.Ally
        : TargetSide.Enemy;
  const skill: SkillDef = {
    id: entry.skillId,
    name: entry.name,
    resourceCosts: [
      { resourceId: DAO_RAGE_RESOURCE_ID, amount: entry.rageCost },
    ],
    tags: [SkillTag.Art, SkillTag.Support],
    targeting: {
      side,
      ...(['allies', 'enemies'].includes(entry.target)
        ? { mode: TargetMode.All }
        : { count: 1 }),
    },
    effects: [],
  };
  let statusDefs: StatusDef[] | undefined;
  const capped = (power: string, cap?: number) =>
    cap === undefined ? power : `min(${power}, target.level * ${cap})`;
  switch (effect.type) {
    case 'heal':
      skill.effects = [
        {
          type: EffectType.Heal,
          power: capped(`target.maxHp * ${effect.ratio}`, effect.capPerLevel),
          fixedBase: true,
        },
      ];
      break;
    case 'revive':
      skill.targeting.includeDowned = true;
      skill.targeting.includeDead = true;
      skill.targeting.onlyDowned = true;
      skill.effects = [
        {
          type: EffectType.Revive,
          ...(effect.capPerLevel === undefined
            ? { hpRatio: effect.hpRatio }
            : {
                hp: capped(
                  `target.maxHp * ${effect.hpRatio}`,
                  effect.capPerLevel,
                ),
              }),
          respectHealTaken: true,
        },
      ];
      break;
    case 'restoreMp':
      skill.effects = [
        {
          type: EffectType.RestoreMp,
          power: capped(
            `target.maxMp * ${effect.ratio} + source.level * ${effect.casterLevelFactor}`,
            effect.capPerLevel,
          ),
        },
      ];
      break;
    case 'massRevive':
      skill.targeting = {
        ...skill.targeting,
        includeDowned: true,
        includeDead: true,
        onlyDowned: true,
        requireRevivable: true,
      };
      skill.requireHpAboveRatio = effect.remainingHpRatio;
      skill.effects = [
        {
          type: EffectType.Revive,
          hpRatio: effect.hpRatio,
          respectHealTaken: true,
        },
      ];
      skill.successCostHp = `source.hp - floor(source.maxHp * ${effect.remainingHpRatio})`;
      skill.successCostMp = `source.mp - floor(source.maxMp * ${effect.remainingMpRatio})`;
      break;
    case 'dispelBuff':
      skill.effects = [
        {
          type: EffectType.Dispel,
          categories: [StatusCategory.Buff],
          chance: effect.chance,
          chanceByClass: { art: effect.artChance },
        },
      ];
      break;
    case 'cleanse':
      skill.effects = [
        {
          type: EffectType.Dispel,
          kinds: effect.kinds,
          excludeStatusFlags: ['blocksRevive'],
        },
      ];
      if (effect.healRatio > 0)
        skill.effects.push({
          type: EffectType.Heal,
          power: `target.maxHp * ${effect.healRatio}`,
          fixedBase: true,
        });
      break;
    case 'rageDamage':
      skill.effects = [
        {
          type: EffectType.ModifyResource,
          resourceId: DAO_RAGE_RESOURCE_ID,
          amount: -effect.amount,
          affectTarget: true,
        },
      ];
      break;
    case 'status': {
      const modifier: Partial<StatusDef> = {};
      const factor = Number((1 + effect.ratio).toFixed(6));
      switch (effect.modifier) {
        case 'physicalDealt':
          modifier.damageDealtPhysical = factor;
          break;
        case 'spellDealt':
          modifier.damageDealtSpell = factor;
          break;
        case 'physicalTaken':
          modifier.damageTakenPhysical = factor;
          break;
        case 'spellTaken':
          modifier.damageTakenSpell = factor;
          break;
        case 'healTaken':
          modifier.healTaken = factor;
          break;
        case 'speed':
          modifier.speedMod = `floor(target.speed * ${effect.ratio})`;
          break;
      }
      statusDefs = [
        {
          id: effect.statusId,
          name: entry.name,
          kind: effect.group,
          category:
            side === TargetSide.Enemy
              ? StatusCategory.Debuff
              : StatusCategory.Buff,
          dispelClass: 'art',
          priority: Math.abs(effect.ratio),
          untilBattleEnd: effect.duration === 'battle',
          expireSameRound: true,
          extendable: false,
          ...modifier,
        },
      ];
      skill.effects = [
        {
          type: EffectType.ApplyStatus,
          statusId: effect.statusId,
          duration: effect.duration === 'battle' ? 1 : effect.duration,
        },
      ];
      break;
    }
    case 'attack':
      skill.tags = [
        SkillTag.Art,
        effect.kind === 'physical' ? SkillTag.Physical : SkillTag.Spell,
      ];
      skill.effects = [
        {
          type:
            effect.kind === 'physical'
              ? EffectType.PhysicalHit
              : EffectType.SpellHit,
          hits: effect.resultFactors.length,
          resultFactors: effect.resultFactors,
          ...(effect.defenseIgnore === undefined
            ? {}
            : { defenseIgnore: effect.defenseIgnore }),
          ...(effect.kind === 'physical' && effect.mpDamageRatio !== undefined
            ? { mpDamageRatio: effect.mpDamageRatio }
            : {}),
        },
      ];
      break;
  }
  return {
    id: entry.id,
    name: entry.name,
    description,
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
        targetIsSelf: true,
        aim: HookAim.Self,
        effects: [
          {
            type: EffectType.ModifyResource,
            resourceId: DAO_RAGE_RESOURCE_ID,
            amount: `min(100, floor(floor(hpDamage / target.maxHp * ${rule.damagePercentScale}) * ${factor}))`,
          },
        ],
      },
    ],
  };
}

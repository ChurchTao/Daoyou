import {
  BEAST_COMBO_SKILL_IDS,
  BEAST_SKILL_CONTENT,
} from '@shared/engine/combat-v6/beasts/content';
import { EffectType, HookName } from '@shared/engine/combat-v6/core/enums';
import type {
  SkillDef,
  SkillEffect,
  StatusDef,
} from '@shared/engine/combat-v6/core/types';
import { DAO_EQUIPMENT_ART_SKILL_ID } from '@shared/engine/combat-v6/equipment/special-content';

const artIds = new Set<string>(Object.values(DAO_EQUIPMENT_ART_SKILL_ID));
function beastPassiveDescription(skill: SkillDef): string | undefined {
  const effect = BEAST_SKILL_CONTENT.find(
    (entry) => entry.id === skill.id,
  )?.effect;
  if (!effect) return;
  const percent = (value: number) => Math.round(value * 100);
  switch (effect.type) {
    case 'ghost':
      return `死亡后第 ${effect.delay} 个回合开始复起，恢复至可恢复气血上限；不接受普通气血恢复，免疫常规异常，神佑失效。驱鬼击杀不再复起，等待期间不计存活。`;
    case 'exorcism':
      return `对鬼魂目标的物理和法术伤害提高 ${percent(effect.factor - 1)}%，击杀后阻止其本次鬼魂复起。`;
    case 'denial':
      return `免疫常规异常并拒绝增益，压制鬼魂、神佑、神迹、精神集中；受到鬼魂的物理与法术伤害增加 ${percent(effect.ghostDamageFactor - 1)}%。${effect.spellFactor < 1 ? `所受法术伤害降低 ${percent(1 - effect.spellFactor)}%。` : ''}`;
    case 'poison':
      return `普通攻击直接扣血后有 ${percent(effect.chance)}% 概率使目标中毒 ${effect.duration} 回合，每回合损失 ${percent(effect.hpRatio)}% 最大气血和 ${percent(effect.mpRatio)}% 最大法力。${effect.immune ? '自身免疫此毒。' : ''}`;
    case 'miracle':
      return `${effect.immune ? '免疫' : '回合末解除'}可驱散的控制、减益和持续伤害状态，不包含禁复活。`;
    case 'concentration':
      return `免疫可驱散的控制状态（不含禁复活），物理伤害降低 ${percent(1 - effect.physicalFactor)}%。${effect.dodgeBonus ? `躲避增加 ${effect.dodgeBonus} 点。` : ''}`;
    case 'eternity':
      return `获得可延长增益时持续时间增加 ${percent(effect.factor - 1)}%，向下取整，最多额外 ${effect.maxExtra} 回合；不延长隐身、控制与特殊入场效果。`;
    case 'stealth':
      return `每场首次出战时隐身 ${effect.minDuration}～${effect.maxDuration} 回合（含入场回合），不能施法，物理伤害降低 ${percent(1 - effect.physicalFactor)}%。感知可看破，群法仍可命中；召回后不重新触发。`;
    case 'perception':
      return `可以选中隐身目标。${effect.dodgeBonus ? `躲避增加 ${effect.dodgeBonus} 点。` : ''}`;
    case 'spellRepeat':
      return `直接伤害法术施放后有 ${percent(effect.chance)}% 概率追加同一法术，伤害乘 ${effect.factor}，不额外耗蓝；沿用原目标，不递归触发。`;
    case 'spellFluctuation':
      return `法术伤害在 ${percent(effect.min)}%～${percent(effect.max)}% 间均匀波动，替换基础法术波动区间。${effect.suppressReflection ? '法术攻击不触发法术反震。' : ''}`;
    case 'groupSpell':
      return `群体法术，攻击 1 + 等级除以 ${effect.levelsPerTarget} 向下取整个目标，最多 ${effect.maxTargets} 个；消耗 ${effect.costMp} 法力，伤害系数 ${effect.coefficient}，附加威力 ${effect.powerBase} + 等级 × ${effect.powerPerLevel}。当前没有元素克制。`;
    case 'parry':
      return `每回合首次命中的物理伤害降低 ${percent(1 - effect.factor)}%。护盾吸收前消耗次数，强力可忽略此效果且不消耗次数。`;
    case 'defenseTraining':
      return `物理防御提高自身等级 × ${effect.perLevel}，向下取整；自身法术伤害降低 ${percent(1 - effect.spellFactor)}%。`;
    case 'strengthTraining':
      return `物理攻击提高自身等级 × ${effect.perLevel}，向下取整；忽略招架减伤，攻击拥有防御或高级防御技能的目标时物理伤害降低 ${percent(1 - effect.versusDefenseFactor)}%。`;
    case 'wisdom':
      return `法术技能的法力消耗降低 ${percent(1 - effect.factor)}%，与其他减耗倍率相乘后向下取整；不影响物理技能和捕捉。`;
    case 'sneakAttack':
      return `物理伤害提高 ${percent(effect.factor - 1)}%，物理攻击不触发目标的反击与反震。`;
    case 'spellResistance':
      return `受到的法术伤害降低 ${percent(1 - effect.takenFactor)}%，自身造成的物理伤害降低 ${percent(1 - effect.physicalFactor)}%；不减免固定伤害。`;
    case 'lifesteal':
      return `物理攻击直接命中后，恢复目标实际损失气血的 ${percent(effect.ratio)}%，向下取整，不超过可恢复上限。连击追加攻击与反击不触发吸血，无法从鬼魂目标吸血。`;
    case 'reflection':
      return `受到${effect.kind === 'physical' ? '物理' : '法术'}攻击并损失气血时，有 ${percent(effect.chance)}% 概率向攻击者反震实际损失气血的 ${percent(effect.ratio)}%，按固定伤害结算，最低 1 点。追加攻击不触发反震。${effect.kind === 'physical' ? '阻止敌方连击，偷袭不解除此限制。' : '不阻止物理连击。'}`;
    case 'divineRevival':
      return `受到致命伤害时，有 ${percent(effect.chance)}% 概率复生，恢复至最大气血的 ${percent(effect.hpRatio)}%，受可恢复上限和禁复活状态限制。每次致命伤害独立判定，成功不计死亡；持有鬼魂术或否定信仰时不生效。`;
    case 'counter':
      return `受到物理攻击并损失气血时，有 ${percent(effect.chance)}% 概率反击，攻击系数为普攻的 ${percent(effect.coefficient)}%。反击与连击追加攻击不再触发反击。`;
    case 'critical':
      return `${effect.kind === 'physical' ? '物理' : '法术'}暴击率提高 ${percent(effect.chance)} 个百分点，暴击倍率沿用战斗规则。`;
    case 'regeneration':
      return `每回合结束时恢复自身等级${effect.levelDivisor === 1 ? '' : `的 1/${effect.levelDivisor}`}点${effect.resource === 'hp' ? '气血' : '法力'}，向下取整，不超过上限；死亡或未出战时不生效。`;
    case 'spellBoost':
      return `造成的法术伤害提高 ${percent(effect.factor - 1)}%。`;
    case 'speed':
      return `自身速度${effect.factor >= 1 ? '提高' : '降低'} ${percent(Math.abs(effect.factor - 1))}%。与其他速度倍率相乘。`;
  }
}
function beastComboDescription(skill: SkillDef): string | undefined {
  if (!BEAST_COMBO_SKILL_IDS.includes(skill.id)) return;
  const hook = skill.hooks?.find((entry) => entry.on === HookName.AfterHit);
  if (typeof hook?.chance !== 'number') return;
  const effect = BEAST_SKILL_CONTENT.find(
    (entry) => entry.id === skill.id,
  )?.effect;
  if (effect?.type !== 'combo') return;
  return `普通攻击命中后，有 ${Math.round(hook.chance * 100)}% 概率向原目标追加一次普攻；自身所有物理伤害降低 ${Math.round((1 - effect.physicalFactor) * 100)}%。目标拥有反震或高级反震时不触发，偷袭不解除此限制。`;
}
const effectLabels: Record<SkillEffect['type'], string> = {
  physicalHit: '造成物理伤害',
  spellHit: '造成法术伤害',
  fixedHit: '造成固定伤害',
  heal: '治疗气血',
  restoreHp: '恢复气血',
  restoreMp: '恢复法力',
  revive: '复起目标',
  applyStatus: '施加状态',
  removeStatus: '移除状态',
  copyStatus: '复制状态',
  emitMechanic: '触发技能机制',
  dispel: '驱散状态',
  skipNextAction: '下一次行动休息',
  damageMp: '削减法力',
  wound: '造成伤势',
  removeWound: '恢复伤势',
  applyBarrier: '获得护盾',
  modifyStrike: '调整伤害',
  modifyDefenseIgnore: '调整忽视防御',
  modifyHeal: '调整治疗',
  modifyBarrier: '调整护盾',
  modifyWound: '调整伤势',
  setCrit: '必定暴击',
  modifyResource: '调整战斗资源',
  modifyChance: '调整触发概率',
  clearSkipNextAction: '取消休息',
  randomBranch: '随机触发效果',
};

/** Public qualitative preview, deliberately excludes formulas and private runtime state. */
export function combatV6SkillDetails(
  skills: SkillDef[],
  statuses: StatusDef[],
) {
  const names = new Map(statuses.map((status) => [status.id, status.name]));
  const describe = (effect: SkillEffect): string => {
    let text = effectLabels[effect.type];
    if (effect.type === EffectType.ApplyStatus) {
      text = `${effect.self ? '自身' : ''}施加「${names.get(effect.statusId) ?? '状态'}」`;
      if (typeof effect.duration === 'number')
        text += `，持续 ${effect.duration} 回合`;
    } else if (effect.type === EffectType.ApplyBarrier) {
      text = `获得「${effect.name}」护盾`;
    } else if (effect.type === EffectType.RandomBranch) {
      text = `随机效果：${effect.successEffects.map(describe).join('、')}；或${effect.failureEffects.map(describe).join('、') || '不产生效果'}`;
    } else if (effect.type === EffectType.EmitMechanic) {
      text = effect.name;
    }
    return `${effect.when ? '满足条件时：' : ''}${text}`;
  };
  return Object.fromEntries(
    skills.map((skill) => [
      skill.id,
      {
        category: artIds.has(skill.id) ? ('art' as const) : ('spell' as const),
        description: skill.capture
          ? '尝试收服野生灵兽，气血越低越容易成功；执行时消耗法力，失败仍消耗。'
          : (beastComboDescription(skill) ??
            beastPassiveDescription(skill) ??
            ([
              ...new Set([
                ...skill.effects.map(describe),
                ...(skill.successEffects ?? []).map(
                  (effect) => `施放成功后：${describe(effect)}`,
                ),
              ]),
            ].join('；') ||
              '被动能力，依技能条件触发。')),
      },
    ]),
  );
}

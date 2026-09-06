import { EffectType } from '@shared/engine/combat-v6/core/enums';
import type {
  SkillDef,
  SkillEffect,
  StatusDef,
} from '@shared/engine/combat-v6/core/types';
import { DAO_EQUIPMENT_ART_SKILL_ID } from '@shared/engine/combat-v6/equipment/special-content';

const artIds = new Set<string>(Object.values(DAO_EQUIPMENT_ART_SKILL_ID));
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
        description:
          [
            ...new Set([
              ...skill.effects.map(describe),
              ...(skill.successEffects ?? []).map(
                (effect) => `施放成功后：${describe(effect)}`,
              ),
            ]),
          ].join('；') || '被动能力，依技能条件触发。',
      },
    ]),
  );
}

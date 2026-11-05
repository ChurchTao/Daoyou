import type { SkillDef, Unit } from '@daoyou/combat-core/types';
import { EXORCISM_BOSSES } from '@daoyou/game-content/dungeon/exorcism';
import type {
  ExorcismBossId,
  ExorcismBuildTag,
} from '@daoyou/game-domain/dungeon/exorcism';

const DAMAGE = new Set(['physicalHit', 'spellHit', 'fixedHit']);
const HEALING = new Set(['heal', 'restoreHp']);

/** 从人物投影看构筑特征，只用于展示克星，不改变战斗。 */
export function exorcismBuildTags(
  unit: {
    skills?: readonly string[];
    passives?: readonly string[];
    attrs?: Partial<Unit['attrs']>;
  },
  skills: readonly SkillDef[],
): ExorcismBuildTag[] {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const own = [...(unit.skills ?? []), ...(unit.passives ?? [])].flatMap(
    (id) => {
      const skill = byId.get(id);
      return skill ? [skill] : [];
    },
  );
  const active = (unit.skills ?? []).flatMap((id) => {
    const skill = byId.get(id);
    return skill ? [skill] : [];
  });
  const tags: ExorcismBuildTag[] = [];
  // 面板双攻不代表打法（术法宗门物攻也可能更高），按主动技能的伤害类型判定；
  // 物法并重的构筑两边都算，所以它会被更多首领克制。固定伤害同样依赖法力，归入术法。
  const count = (type: string) =>
    active.filter((skill) =>
      skill.effects.some((effect) => effect.type === type),
    ).length;
  const physical = count('physicalHit');
  const spell = count('spellHit') + count('fixedHit');
  if (physical >= spell) tags.push('physical');
  if (spell >= physical) tags.push('spell');
  const effects = own.flatMap((skill) => [
    ...skill.effects,
    ...(skill.hooks ?? []).flatMap((hook) => hook.effects),
  ]);
  if (effects.some((effect) => HEALING.has(effect.type))) tags.push('sustain');
  const aoe = active.some(
    (skill) =>
      skill.effects.some((effect) => DAMAGE.has(effect.type)) &&
      (skill.targeting.mode === 'all' ||
        (typeof skill.targeting.count === 'number'
          ? skill.targeting.count > 1
          : typeof skill.targeting.count === 'string')),
  );
  if (!aoe) tags.push('single_target');
  return tags;
}

export function exorcismIsCountered(
  bossId: ExorcismBossId,
  tags: readonly ExorcismBuildTag[],
) {
  return EXORCISM_BOSSES[bossId].counters.some((tag) => tags.includes(tag));
}

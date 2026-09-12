import {
  BEAST_SKILL_CONTENT,
  BEAST_SKILL_FAMILIES,
  BEAST_SKILLS,
} from '../engine/combat-v6/beasts/content';
import { combatV6SkillDetails } from './skill-details';

export type BeastSkillPresentation = {
  name: string;
  icon: string;
  style: 'normal' | 'advanced' | 'unavailable';
  description: string;
};
const descriptions = combatV6SkillDetails(BEAST_SKILLS, []);
const advanced = new Set(BEAST_SKILL_FAMILIES.map((f) => f.advanced));
const presentations = new Map<string, BeastSkillPresentation>([
  ...BEAST_SKILL_CONTENT.map(
    (s) =>
      [
        s.id,
        {
          name: s.name,
          icon: s.icon,
          style: advanced.has(s.id) ? 'advanced' : 'normal',
          description: descriptions[s.id]?.description ?? '暂无技能说明。',
        },
      ] as [string, BeastSkillPresentation],
  ),
]);
export function findBeastSkillPresentation(id: string) {
  return presentations.get(id);
}
/** 仅作展示兜底，不放宽技能或物品的存储校验。 */
export function beastSkillPresentation(id: string): BeastSkillPresentation {
  return (
    findBeastSkillPresentation(id) ?? {
      name: '未知技能',
      icon: '❔',
      style: 'unavailable',
      description: '技能信息暂不可用。',
    }
  );
}

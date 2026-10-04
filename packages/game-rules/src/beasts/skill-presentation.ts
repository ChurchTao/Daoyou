import {
  BEAST_ADVANCED_SKILL_IDS,
  BEAST_SKILL_CONTENT,
  BEAST_SKILLS,
} from '@daoyou/game-content/beasts';
import { combatV6SkillDetails } from '../combat/skill-details.js';

export type BeastSkillPresentation = {
  name: string;
  icon: string;
  style: 'normal' | 'advanced' | 'unavailable';
  summary: string;
  details: string;
  description: string;
};
const descriptions = combatV6SkillDetails(BEAST_SKILLS, []);
const effectDescriptions = combatV6SkillDetails(BEAST_SKILLS, [], {
  includeBeastFlavor: false,
});
const presentations = new Map<string, BeastSkillPresentation>([
  ...BEAST_SKILL_CONTENT.map(
    (s) =>
      [
        s.id,
        {
          name: s.name,
          icon: s.icon,
          style: BEAST_ADVANCED_SKILL_IDS.has(s.id)
            ? 'advanced'
            : 'normal',
          summary: s.flavorText,
          details:
            effectDescriptions[s.id]?.description === s.flavorText
              ? ''
              : (effectDescriptions[s.id]?.description ?? '暂无技能效果。'),
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
      summary: '技能信息暂不可用。',
      details: '',
      description: '技能信息暂不可用。',
    }
  );
}

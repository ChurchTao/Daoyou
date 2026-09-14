import {
  BEAST_BOOK_SKILLS,
  BEAST_SKILL_FAMILIES,
} from '../../engine/combat-v6/beasts/content';
const advancedSkills = new Set(
  BEAST_SKILL_FAMILIES.map((family) => family.advanced),
);

export const BOOKS = BEAST_BOOK_SKILLS.map((skill) => ({
  id: `book.${skill.id}`,
  name: advancedSkills.has(skill.id) ? '上品传承灵印' : '传承灵印',
  kind: 'beast_book' as const,
  skillId: skill.id,
  stackLimit: 99,
}));

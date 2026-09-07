import { BEAST_SKILLS } from '../../engine/combat-v6/beasts';
export const BOOKS = [
  'beast.spirit-flame',
  'beast.stone-guard',
  'beast.wind-strike',
  'beast.combo',
  'beast.advanced-combo',
]
  .map((id) => BEAST_SKILLS.find((skill) => skill.id === id)!)
  .map((skill) => ({
    id: `book.${skill.id}`,
    name: `${skill.name}兽诀`,
    kind: 'beast_book' as const,
    skillId: skill.id,
    stackLimit: 99,
  }));

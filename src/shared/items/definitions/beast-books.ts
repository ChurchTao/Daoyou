import { BEAST_BOOK_SKILLS } from '../../engine/combat-v6/beasts/content';

export const BOOKS = BEAST_BOOK_SKILLS.map((skill) => ({
  id: `book.${skill.id}`,
  name: skill.name,
  kind: 'beast_book' as const,
  skillId: skill.id,
  stackLimit: 99,
}));

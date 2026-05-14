import { renderPrompt } from '@server/lib/prompts';

export {
  getRandomFallbackFortune,
  type DivineFortune,
} from '@shared/lib/divineFortune';

export function getDivineFortunePrompt(): [string, string] {
  const { system, user } = renderPrompt('divine-fortune');
  return [system, user];
}

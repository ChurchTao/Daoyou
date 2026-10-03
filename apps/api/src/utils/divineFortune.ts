import { renderPrompt } from '@server/lib/prompts/index.js';

export {
  getRandomFallbackFortune,
  type DivineFortune,
} from '@daoyou/shared/lib/divineFortune';

export function getDivineFortunePrompt(): [string, string] {
  const { system, user } = renderPrompt('divine-fortune');
  return [system, user];
}

import { buildGeneratedCharacter } from '@daoyou/game-rules/character/creation';
import { CultivatorAIRawSchema } from '@daoyou/game-domain/character/generation';
import { generateAiObject } from '@server/utils/aiClient.js';
import {
  getCharacterGenerationPrompt,
  getCharacterGenerationUserPrompt,
} from './character-prompts.js';

export class CharacterGenerator {
  static async generate(userInput: string) {
    const response = await generateAiObject({
      system: getCharacterGenerationPrompt(),
      prompt: getCharacterGenerationUserPrompt(userInput),
      schema: CultivatorAIRawSchema,
      name: '修仙真形骨架',
      sceneId: 'character-generation',
    });
    return buildGeneratedCharacter(response.output, userInput, Math.random);
  }
}

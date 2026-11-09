import { CultivatorAIRawSchema } from '@daoyou/game-domain/character/generation';
import { buildGeneratedCharacter } from '@daoyou/game-rules/character/creation';
import type { AiService } from '@nestjs/ai';
import { aiDeadlineSignal } from '@server/llm/call-options.js';
import {
  getCharacterGenerationPrompt,
  getCharacterGenerationUserPrompt,
} from './character-prompts.js';

export class CharacterGenerator {
  static async generate(ai: AiService, userInput: string) {
    const response = await ai.generateObject({
      model: 'alibaba.fast',
      abortSignal: aiDeadlineSignal(),
      instructions: getCharacterGenerationPrompt(),
      prompt: getCharacterGenerationUserPrompt(userInput),
      schema: CultivatorAIRawSchema,
      schemaName: '修仙真形骨架',
      label: 'character-generation',
    });
    return buildGeneratedCharacter(response.object, userInput, Math.random);
  }
}

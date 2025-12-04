import { generateNarrative } from './aiClient';
import {
  type BreakthroughStoryPayload,
  type LifespanExhaustedStoryPayload,
  getBreakthroughStoryPrompt,
  getLifespanExhaustedStoryPrompt,
} from './prompts';

export async function createBreakthroughStory(
  payload: BreakthroughStoryPayload,
): Promise<string> {
  const [systemPrompt, userPrompt] = getBreakthroughStoryPrompt(payload);
  return generateNarrative(systemPrompt, userPrompt, 0.75);
}

export async function createLifespanExhaustedStory(
  payload: LifespanExhaustedStoryPayload,
): Promise<string> {
  const [systemPrompt, userPrompt] = getLifespanExhaustedStoryPrompt(payload);
  return generateNarrative(systemPrompt, userPrompt, 0.72);
}

import { text } from './aiClient';
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
  return (await text(systemPrompt, userPrompt, true)).text;
}

export async function createLifespanExhaustedStory(
  payload: LifespanExhaustedStoryPayload,
): Promise<string> {
  const [systemPrompt, userPrompt] = getLifespanExhaustedStoryPrompt(payload);
  return (await text(systemPrompt, userPrompt, true)).text;
}

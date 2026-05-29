const {
  createDeepSeekMock,
  createAlibabaMock,
  createOpenRouterMock,
  generateTextMock,
  streamTextMock,
} = vi.hoisted(() => ({
  createDeepSeekMock: vi.fn(() => vi.fn((modelName: string) => ({ modelName }))),
  createAlibabaMock: vi.fn(() => ({
    languageModel: (modelName: string) => ({ modelName }),
  })),
  createOpenRouterMock: vi.fn(() => vi.fn((modelName: string) => ({ modelName }))),
  generateTextMock: vi.fn(),
  streamTextMock: vi.fn(),
}));

vi.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: createDeepSeekMock,
}));

vi.mock('@ai-sdk/alibaba', () => ({
  createAlibaba: createAlibabaMock,
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: createOpenRouterMock,
}));

vi.mock('@server/lib/http/context', () => ({
  getCurrentContext: vi.fn(() => {
    throw new Error('no context');
  }),
}));

vi.mock('ai', () => ({
  generateText: generateTextMock,
  streamText: streamTextMock,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { buildStructuredSystemPrompt, object } from './aiClient';
import { stableCompactStringify } from './llmPayload';

describe('aiClient structured prompts', () => {
  beforeEach(() => {
    process.env.PROVIDER_CHOOSE = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
    process.env.DEEPSEEK_MODEL_USE = 'deepseek-chat';
    process.env.DEEPSEEK_MODEL_FAST_USE = 'deepseek-chat';
    generateTextMock.mockReset();
    streamTextMock.mockReset();
    createDeepSeekMock.mockClear();
  });

  it('minifies schema injection by default', () => {
    const schema = z.object({
      name: z.string().describe('很长的说明文案'),
    });

    const { systemPrompt, schemaChars } = buildStructuredSystemPrompt('system', {
      schema,
    });

    expect(systemPrompt).toContain('你必须遵循以下 JSON Schema');
    expect(systemPrompt).toContain('"type":"object"');
    expect(systemPrompt).not.toContain('\n  "type"');
    expect(schemaChars).toBeGreaterThan(0);
  });

  it('uses llmSchema for prompt injection and logs scene metrics', async () => {
    const consoleInfoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    generateTextMock.mockResolvedValueOnce({
      output: '{"name":"玄光骨"}',
      usage: {
        inputTokens: 12,
        outputTokens: 3,
        totalTokens: 15,
      },
    });

    await object(
      'base system',
      'base user',
      {
        schema: z.object({
          name: z.string().describe('业务校验说明'),
        }),
        llmSchema: z.object({
          name: z.string(),
        }),
        sceneId: 'fate-naming',
      },
      true,
    );

    const request = generateTextMock.mock.calls[0][0];
    expect(request.system).toContain('"type":"object"');
    expect(request.system).not.toContain('业务校验说明');

    expect(consoleInfoSpy).toHaveBeenCalledWith('[LLM_METRICS]', expect.any(String));
    const metrics = JSON.parse(consoleInfoSpy.mock.calls[0][1]);
    expect(metrics).toMatchObject({
      sceneId: 'fate-naming',
      provider: 'deepseek',
      model: 'deepseek-chat',
      systemChars: 'base system'.length,
      userChars: 'base user'.length,
      schemaChars: stableCompactStringify(
        z.object({
          name: z.string(),
        }).toJSONSchema(),
      ).length,
      retryCount: 0,
      status: 'success',
      usage: {
        inputTokens: 12,
        outputTokens: 3,
        totalTokens: 15,
      },
    });

    consoleInfoSpy.mockRestore();
  });
});

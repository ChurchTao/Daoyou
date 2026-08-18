import { LLM_PROVIDER_DEFAULT_MODELS } from './llm';
import {
  llmRouteKey,
  parseLlmRouteSpec,
  pickHighestWeightLlmRoute,
  pickLlmRouteByUserHash,
  resolveLlmRouteModels,
  resolveServerLlmRoutes,
} from './llmRouting';

const BOTH_KEYS = { alibaba: true, deepseek: true };

describe('parseLlmRouteSpec', () => {
  it('parses provider-only, model, and weight forms', () => {
    expect(parseLlmRouteSpec('alibaba')).toEqual([
      { provider: 'alibaba', weight: 1 },
    ]);
    expect(parseLlmRouteSpec('alibaba/qwen3.7-flash')).toEqual([
      { provider: 'alibaba', model: 'qwen3.7-flash', weight: 1 },
    ]);
    expect(parseLlmRouteSpec(' alibaba/qwen3.7-flash:70, deepseek:30 ')).toEqual(
      [
        { provider: 'alibaba', model: 'qwen3.7-flash', weight: 70 },
        { provider: 'deepseek', weight: 30 },
      ],
    );
  });

  it('allows the same provider with different models', () => {
    expect(
      parseLlmRouteSpec('alibaba/qwen3.7-flash:70,alibaba/qwen-plus:30'),
    ).toEqual([
      { provider: 'alibaba', model: 'qwen3.7-flash', weight: 70 },
      { provider: 'alibaba', model: 'qwen-plus', weight: 30 },
    ]);
  });

  it.each([
    ['', 'Expected provider[/model][:weight]'],
    ['openai', 'Expected one of'],
    ['alibaba:0', 'positive integer'],
    ['alibaba:-1', 'provider[/model][:weight]'],
    ['alibaba:1.5', 'provider[/model][:weight]'],
    ['alibaba/', 'provider[/model][:weight]'],
    ['alibaba,alibaba', 'Duplicate'],
    ['alibaba/qwen,alibaba/qwen', 'Duplicate'],
  ])('rejects %j', (raw, message) => {
    expect(() => parseLlmRouteSpec(raw)).toThrow(message);
  });
});

describe('resolveLlmRouteModels', () => {
  it('fills omitted models from defaults', () => {
    expect(resolveLlmRouteModels(parseLlmRouteSpec('alibaba,deepseek'))).toEqual(
      [
        {
          provider: 'alibaba',
          model: LLM_PROVIDER_DEFAULT_MODELS.alibaba,
          weight: 1,
        },
        {
          provider: 'deepseek',
          model: LLM_PROVIDER_DEFAULT_MODELS.deepseek,
          weight: 1,
        },
      ],
    );
  });

  it('keeps explicit models and fills the rest from provider defaults', () => {
    expect(
      resolveLlmRouteModels(parseLlmRouteSpec('alibaba/qwen-plus,deepseek')),
    ).toEqual([
      { provider: 'alibaba', model: 'qwen-plus', weight: 1 },
      {
        provider: 'deepseek',
        model: LLM_PROVIDER_DEFAULT_MODELS.deepseek,
        weight: 1,
      },
    ]);
  });

  it('rejects two omitted models that resolve to the same route', () => {
    expect(() =>
      resolveLlmRouteModels(parseLlmRouteSpec('alibaba,alibaba/qwen3.7-flash')),
    ).toThrow('Duplicate LLM_PROVIDER route "alibaba/qwen3.7-flash"');
  });
});

describe('resolveServerLlmRoutes', () => {
  it('covers single and multi provider / model combinations', () => {
    expect(
      resolveServerLlmRoutes({
        providerSpec: 'alibaba/qwen3.7-flash',
        availableProviders: BOTH_KEYS,
      }),
    ).toEqual([
      { provider: 'alibaba', model: 'qwen3.7-flash', weight: 1 },
    ]);

    expect(
      resolveServerLlmRoutes({
        providerSpec: 'alibaba/qwen3.7-flash:70,alibaba/qwen-plus:30',
        availableProviders: BOTH_KEYS,
      }),
    ).toHaveLength(2);

    expect(
      resolveServerLlmRoutes({
        providerSpec: 'alibaba/qwen3.7-flash:70,deepseek/deepseek-v4-flash:30',
        availableProviders: BOTH_KEYS,
      }).map(llmRouteKey),
    ).toEqual(['alibaba/qwen3.7-flash', 'deepseek/deepseek-v4-flash']);

    expect(
      resolveServerLlmRoutes({
        providerSpec:
          'alibaba/qwen3.7-flash:50,alibaba/qwen-plus:20,deepseek/deepseek-v4-flash:30',
        availableProviders: BOTH_KEYS,
      }),
    ).toHaveLength(3);
  });

  it('auto-detects one provider and uses its default model', () => {
    expect(
      resolveServerLlmRoutes({
        availableProviders: { alibaba: true, deepseek: true },
      }),
    ).toEqual([
      {
        provider: 'alibaba',
        model: LLM_PROVIDER_DEFAULT_MODELS.alibaba,
        weight: 1,
      },
    ]);
    expect(
      resolveServerLlmRoutes({
        availableProviders: { deepseek: true },
      }),
    ).toEqual([
      {
        provider: 'deepseek',
        model: LLM_PROVIDER_DEFAULT_MODELS.deepseek,
        weight: 1,
      },
    ]);
  });

  it('rejects a listed provider without an API key', () => {
    expect(() =>
      resolveServerLlmRoutes({
        providerSpec: 'alibaba,deepseek',
        availableProviders: { alibaba: true },
      }),
    ).toThrow('API key is not set');
  });
});

describe('pickLlmRouteByUserHash', () => {
  const weighted = resolveLlmRouteModels(
    parseLlmRouteSpec(
      'alibaba/qwen3.7-flash:50,alibaba/qwen-plus:20,deepseek/deepseek-v4-flash:30',
    ),
  );

  it('keeps the same user on the same provider and model', () => {
    const userId = '4c8f1a2e-2b7c-4d91-9f0a-12ab34cd56ef';
    const first = pickLlmRouteByUserHash(weighted, userId);
    const second = pickLlmRouteByUserHash(weighted, userId);
    expect(llmRouteKey(first)).toBe(llmRouteKey(second));
  });

  it('does not depend on route list order', () => {
    const reversed = resolveLlmRouteModels(
      parseLlmRouteSpec(
        'deepseek/deepseek-v4-flash:30,alibaba/qwen-plus:20,alibaba/qwen3.7-flash:50',
      ),
    );
    const userId = 'user-order-stable';
    expect(llmRouteKey(pickLlmRouteByUserHash(reversed, userId))).toBe(
      llmRouteKey(pickLlmRouteByUserHash(weighted, userId)),
    );
  });

  it('splits users close to the configured weights', () => {
    const counts = {
      'alibaba/qwen3.7-flash': 0,
      'alibaba/qwen-plus': 0,
      'deepseek/deepseek-v4-flash': 0,
    };
    for (let index = 0; index < 10_000; index += 1) {
      const picked = pickLlmRouteByUserHash(weighted, `user-${index}`);
      counts[llmRouteKey(picked) as keyof typeof counts] += 1;
    }

    expect(counts['alibaba/qwen3.7-flash'] / 10_000).toBeGreaterThan(0.45);
    expect(counts['alibaba/qwen3.7-flash'] / 10_000).toBeLessThan(0.55);
    expect(counts['alibaba/qwen-plus'] / 10_000).toBeGreaterThan(0.15);
    expect(counts['alibaba/qwen-plus'] / 10_000).toBeLessThan(0.25);
    expect(counts['deepseek/deepseek-v4-flash'] / 10_000).toBeGreaterThan(0.25);
    expect(counts['deepseek/deepseek-v4-flash'] / 10_000).toBeLessThan(0.35);
  });
});

describe('pickHighestWeightLlmRoute', () => {
  it('picks the heaviest route and breaks ties by provider then model', () => {
    expect(
      llmRouteKey(
        pickHighestWeightLlmRoute(
          resolveLlmRouteModels(
            parseLlmRouteSpec('alibaba/qwen-plus:30,deepseek/deepseek-v4-flash:70'),
          ),
        ),
      ),
    ).toBe('deepseek/deepseek-v4-flash');
    expect(
      llmRouteKey(
        pickHighestWeightLlmRoute(
          resolveLlmRouteModels(
            parseLlmRouteSpec('alibaba/qwen-plus:50,alibaba/qwen3.7-flash:50'),
          ),
        ),
      ),
    ).toBe('alibaba/qwen-plus');
  });
});

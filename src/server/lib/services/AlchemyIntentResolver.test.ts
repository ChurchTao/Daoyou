const { objectMock } = vi.hoisted(() => ({
  objectMock: vi.fn(),
}));

vi.mock('@server/utils/aiClient', () => ({
  object: objectMock,
}));

import { AlchemyIntentResolver } from './AlchemyIntentResolver';

describe('AlchemyIntentResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses structured alchemy intent and deduplicates tags', async () => {
    objectMock.mockResolvedValueOnce({
      object: {
        targetTags: ['healing', 'mana', 'healing'],
        focusMode: 'balanced',
        requestedElementBias: '水',
      },
    });

    const resolver = new AlchemyIntentResolver({ timeoutMs: 1000 });
    const result = await resolver.resolve('兼顾疗伤与回元，偏水性一些');

    expect(result).toEqual({
      targetTags: ['healing', 'mana'],
      focusMode: 'balanced',
      requestedElementBias: '水',
    });
  });

  it('rejects invalid empty tag output', async () => {
    objectMock.mockResolvedValueOnce({
      object: {
        targetTags: [],
        focusMode: 'focused',
      },
    });

    const resolver = new AlchemyIntentResolver({ timeoutMs: 1000 });
    await expect(resolver.resolve('疗伤')).rejects.toThrow();
  });
});

const { objectArrayMock } = vi.hoisted(() => ({
  objectArrayMock: vi.fn(),
}));

vi.mock('@server/utils/aiClient', () => ({
  objectArray: objectArrayMock,
}));

import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import type { MaterialSkeleton } from '@shared/engine/material/creation/types';

describe('MaterialGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes alchemyProfile when AI generation succeeds', async () => {
    objectArrayMock.mockResolvedValueOnce({
      object: [
        {
          name: '青岚草',
          description: '草叶清润，常用于温养经络与补益真息。',
          element: '木',
        },
      ],
    });

    const materials = await MaterialGenerator.generateFromSkeletons([
      { type: 'herb', rank: '真品', quantity: 1 } satisfies MaterialSkeleton,
    ]);

    expect(materials[0]?.details?.alchemyProfile).toMatchObject({
      effectTags: ['healing'],
      elementBias: '木',
      potency: 26,
      toxicity: 2,
    });
  });

  it('writes alchemyProfile when AI generation falls back to presets', async () => {
    objectArrayMock.mockRejectedValueOnce(new Error('boom'));

    const materials = await MaterialGenerator.generateFromSkeletons([
      { type: 'monster', rank: '真品', quantity: 1 } satisfies MaterialSkeleton,
    ]);

    expect(materials[0]?.details?.alchemyProfile).toMatchObject({
      effectTags: ['marrow_wash'],
      potency: 26,
      toxicity: 8,
    });
  });
});

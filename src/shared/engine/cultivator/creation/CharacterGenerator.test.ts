import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CultivatorAIRawData } from './types';
import { CharacterGenerator } from './CharacterGenerator';
import { CultivatorAIRawSchema } from './types';

const { objectMock } = vi.hoisted(() => ({
  objectMock: vi.fn(),
}));

vi.mock('@server/utils/aiClient', () => ({
  object: objectMock,
}));

const buildAIData = (
  overrides: Partial<CultivatorAIRawData> = {},
): CultivatorAIRawData => ({
  name: '林秋',
  gender: '男',
  origin: '青岚山',
  personality: '沉静坚韧',
  background: '少年出身山村，偶得残卷，自此踏上修行之路。',
  element_preferences: ['金', '木', '水', '火'],
  aptitude_score: 78,
  balance_notes: '双目有神，命数稳中带锋。',
  ...overrides,
});

describe('CharacterGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the tolerant AI schema and trims extra element preferences', async () => {
    objectMock.mockResolvedValueOnce({
      object: buildAIData({
        element_preferences: ['金', '木', '水', '火', '土'],
      }),
    });

    const { cultivator } = await CharacterGenerator.generate('偏向剑修的少年');

    expect(objectMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        schema: CultivatorAIRawSchema,
        schemaName: '修仙真形骨架',
        sceneId: 'character-generation',
      }),
      false,
    );
    expect(cultivator.spiritual_roots.map((root) => root.element)).toEqual([
      '金',
      '木',
      '水',
      '火',
    ]);
  });

  it('deduplicates repeated element preferences before generating roots', async () => {
    objectMock.mockResolvedValueOnce({
      object: buildAIData({
        element_preferences: ['火', '火', '水'],
      }),
    });

    const { cultivator } = await CharacterGenerator.generate('擅长丹火的修士');

    expect(cultivator.spiritual_roots.map((root) => root.element)).toEqual([
      '火',
      '水',
    ]);
  });
});

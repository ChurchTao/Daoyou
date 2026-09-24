import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CultivatorAIRawData } from './types';
import { CharacterGenerator } from './CharacterGenerator';
import { CultivatorAIRawSchema } from './types';

const { generateAiObjectMock } = vi.hoisted(() => ({
  generateAiObjectMock: vi.fn(),
}));

vi.mock('@server/utils/aiClient', () => ({
  generateAiObject: generateAiObjectMock,
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
    generateAiObjectMock.mockResolvedValueOnce({
      output: buildAIData({
        element_preferences: ['金', '木', '水', '火', '土'],
      }),
    });

    const { cultivator } = await CharacterGenerator.generate('偏向剑修的少年');

    expect(generateAiObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.any(String),
        prompt: expect.any(String),
        schema: CultivatorAIRawSchema,
        name: '修仙真形骨架',
        sceneId: 'character-generation',
      }),
    );
    expect(cultivator.spiritual_roots.map((root) => root.element)).toEqual([
      '金',
      '木',
      '水',
      '火',
    ]);
  });

  it('deduplicates repeated element preferences before generating roots', async () => {
    generateAiObjectMock.mockResolvedValueOnce({
      output: buildAIData({
        element_preferences: ['火', '火', '水'],
      }),
    });

    const { cultivator } = await CharacterGenerator.generate('擅长丹火的修士');

    expect(cultivator.spiritual_roots.map((root) => root.element)).toEqual([
      '火',
      '水',
    ]);
  });

  it('creates fixed base attributes without a persisted skill cap field', async () => {
    generateAiObjectMock.mockResolvedValueOnce({
      output: buildAIData({
        aptitude_score: 95,
      }),
    });

    const { cultivator } = await CharacterGenerator.generate('根骨上佳的修士');

    expect(cultivator.attributes).toEqual({
      vitality: 15,
      strength: 15,
      spirit: 15,
      endurance: 15,
      speed: 15,
      willpower: 15,
    });
    expect(cultivator.unallocated_attribute_points).toBe(25);
    const removedSkillCapKey = 'max' + '_skills';
    expect(removedSkillCapKey in cultivator).toBe(false);
  });
});

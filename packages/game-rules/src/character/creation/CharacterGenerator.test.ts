import { describe, expect, it } from 'vitest';
import { buildGeneratedCharacter } from './CharacterGenerator.js';
import type { CultivatorAIRawData } from '@daoyou/game-domain/character/generation';

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

describe('buildGeneratedCharacter', () => {
  it('trims extra element preferences', () => {
    const { cultivator } = buildGeneratedCharacter(
      buildAIData({ element_preferences: ['金', '木', '水', '火', '土'] }),
      '偏向剑修的少年',
      () => 0.5,
    );
    expect(cultivator.spiritual_roots.map((root) => root.element)).toEqual([
      '金',
      '木',
      '水',
      '火',
    ]);
  });
  it('deduplicates repeated element preferences', () => {
    const { cultivator } = buildGeneratedCharacter(
      buildAIData({ element_preferences: ['火', '火', '水'] }),
      '擅长丹火的修士',
      () => 0.5,
    );
    expect(cultivator.spiritual_roots.map((root) => root.element)).toEqual([
      '火',
      '水',
    ]);
  });
  it('creates fixed attributes and uses host supplied randomness for age and lifespan', () => {
    const { cultivator } = buildGeneratedCharacter(
      buildAIData({ aptitude_score: 95 }),
      '根骨上佳的修士',
      () => 0.5,
    );
    expect(cultivator.attributes).toEqual({
      vitality: 15,
      strength: 15,
      spirit: 15,
      endurance: 15,
      speed: 15,
      willpower: 15,
    });
    expect(cultivator.unallocated_attribute_points).toBe(25);
    expect(cultivator.age).toBe(17);
    expect(cultivator.lifespan).toBe(110);
    expect('max' + '_skills' in cultivator).toBe(false);
  });
});

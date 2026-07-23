import { describe, expect, it } from 'vitest';
import {
  SectAbilityLoadoutRequestSchema,
  SectMeridianLoadoutRequestSchema,
} from './sect';

describe('SectAbilityLoadoutRequestSchema', () => {
  it('accepts exactly four nullable fixed slots', () => {
    expect(
      SectAbilityLoadoutRequestSchema.safeParse({
        abilityIds: ['guiding-sword', null, 'turning-body', null],
      }).success,
    ).toBe(true);
    expect(
      SectAbilityLoadoutRequestSchema.safeParse({
        abilityIds: ['guiding-sword'],
      }).success,
    ).toBe(false);
    expect(
      SectAbilityLoadoutRequestSchema.safeParse({
        abilityIds: ['guiding-sword', null, null, null, null],
      }).success,
    ).toBe(false);
  });
});

describe('SectMeridianLoadoutRequestSchema', () => {
  it('accepts paths with seven or more layers up to the transport limit', () => {
    expect(
      SectMeridianLoadoutRequestSchema.safeParse({
        nodeIds: Array.from({ length: 7 }, (_, index) => `node-${index + 1}`),
      }).success,
    ).toBe(true);
    expect(
      SectMeridianLoadoutRequestSchema.safeParse({
        nodeIds: Array.from({ length: 65 }, (_, index) => `node-${index + 1}`),
      }).success,
    ).toBe(false);
  });
});

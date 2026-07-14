import { describe, expect, it } from 'vitest';
import { SectAbilityLoadoutRequestSchema } from './sect';

describe('SectAbilityLoadoutRequestSchema', () => {
  it('accepts exactly four nullable fixed slots', () => {
    expect(SectAbilityLoadoutRequestSchema.safeParse({
      abilityIds: ['guiding-sword', null, 'turning-body', null],
    }).success).toBe(true);
    expect(SectAbilityLoadoutRequestSchema.safeParse({
      abilityIds: ['guiding-sword'],
    }).success).toBe(false);
    expect(SectAbilityLoadoutRequestSchema.safeParse({
      abilityIds: ['guiding-sword', null, null, null, null],
    }).success).toBe(false);
  });
});

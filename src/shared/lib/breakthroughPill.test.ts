import { describe, expect, it } from 'vitest';

import type { PillSpec } from '@shared/types/consumable';

import {
  getBreakthroughFocusPillLabel,
  getBreakthroughPillLabel,
} from './breakthroughPill';

describe('getBreakthroughPillLabel', () => {
  it('returns dedicated names for higher-realm breakthrough pills', () => {
    expect(getBreakthroughPillLabel('化神')).toBe('叩神丹');
    expect(getBreakthroughPillLabel('炼虚')).toBe('洞虚丹');
    expect(getBreakthroughPillLabel('合体')).toBe('合真丹');
    expect(getBreakthroughPillLabel('大乘')).toBe('证道丹');
    expect(getBreakthroughPillLabel('渡劫')).toBe('应劫丹');
  });
});

describe('getBreakthroughFocusPillLabel', () => {
  function createBreakthroughSpec(
    status: 'breakthrough_focus' | 'clear_mind' | 'protect_meridians',
  ): PillSpec {
    return {
      kind: 'pill',
      family: 'breakthrough',
      operations: [
        {
          type: 'add_status',
          status,
          usesRemaining: 1,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['静神芝'],
        analysisVersion: 2,
        propertyVector: [],
        sourceMaterialVectors: [],
        stability: 80,
        toxicityRating: 20,
        tags: ['breakthrough'],
        breakthroughTargetRealm: '元婴',
      },
    };
  }

  it('returns fixed breakthrough names only for breakthrough focus effects', () => {
    expect(
      getBreakthroughFocusPillLabel(
        createBreakthroughSpec('breakthrough_focus'),
      ),
    ).toBe('护婴丹');
    expect(
      getBreakthroughFocusPillLabel(createBreakthroughSpec('clear_mind')),
    ).toBe(null);
    expect(
      getBreakthroughFocusPillLabel(
        createBreakthroughSpec('protect_meridians'),
      ),
    ).toBe(null);
  });
});

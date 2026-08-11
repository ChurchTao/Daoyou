import { describe, expect, it } from 'vitest';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { AbilityType, BuffType } from '../../core/types';
import { StackRule } from '../../buffs/Buff';
import { resolveBattleAbilityVisual } from '../../presentation';

describe('BattleVisualRegistry', () => {
  it('prefers an explicitly authored visual profile', () => {
    expect(resolveBattleAbilityVisual('custom', {
      slug: 'custom',
      name: '自定义',
      type: AbilityType.ACTIVE_SKILL,
      presentation: {
        visual: { discipline: 'true', delivery: 'beam', element: 'thunder', impact: 'break' },
      },
    })).toMatchObject({ delivery: 'beam', element: 'thunder', impact: 'break' });
  });

  it('infers dynamic AOE control visuals from runtime tags and effects', () => {
    const visual = resolveBattleAbilityVisual('generated-control', {
      slug: 'generated-control',
      name: '天罗',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.CHANNEL.MAGIC, GameplayTags.ABILITY.ELEMENT.ICE],
      targetPolicy: { team: 'enemy', scope: 'aoe' },
      effects: [{
        type: 'apply_buff',
        params: {
          buffConfig: {
            id: 'bind',
            name: '束缚',
            type: BuffType.CONTROL,
            duration: 1,
            stackRule: StackRule.REFRESH_DURATION,
          },
        },
      }],
    });
    expect(visual).toMatchObject({
      discipline: 'spell',
      delivery: 'field',
      distribution: 'area',
      weight: 'heavy',
      element: 'ice',
      impact: 'bind',
    });
  });
});

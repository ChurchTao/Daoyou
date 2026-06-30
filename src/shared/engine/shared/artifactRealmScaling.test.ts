import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_REALM_SCALING_EXPONENT,
  getArtifactRealmGrowthFactor,
  getArtifactWearerRealmFactor,
  isArtifactMainPanelFixedModifier,
  scaleArtifactMainPanelFixedModifiers,
} from './artifactRealmScaling';
import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import { getRealmStageAttributeBudget } from '@shared/config/realmProgression';

describe('artifactRealmScaling', () => {
  it('uses the shared realm growth exponent for anchor scaling', () => {
    expect(getArtifactRealmGrowthFactor('渡劫', '圆满')).toBeCloseTo(
      Math.pow(
        getRealmStageAttributeBudget('渡劫', '圆满') / 50,
        ARTIFACT_REALM_SCALING_EXPONENT,
      ),
      10,
    );
  });

  it('defaults missing artifact anchor stage to realm completion', () => {
    expect(getArtifactRealmGrowthFactor('金丹')).toBeCloseTo(
      getArtifactRealmGrowthFactor('金丹', '圆满'),
      10,
    );
  });

  it('makes cross-realm decay the inverse ratio of the same growth curve', () => {
    const anchorFactor = getArtifactRealmGrowthFactor('金丹', '圆满');
    const wearerFactor = getArtifactRealmGrowthFactor('炼气', '初期');
    const decay = getArtifactWearerRealmFactor(
      '金丹',
      '圆满',
      '炼气',
      '初期',
    );

    expect(decay).toBeCloseTo(wearerFactor / anchorFactor, 10);
    expect(100 * anchorFactor * decay).toBeCloseTo(100 * wearerFactor, 10);
  });

  it('does not boost low-anchor artifacts when worn by higher realms', () => {
    expect(
      getArtifactWearerRealmFactor('炼气', '初期', '金丹', '圆满'),
    ).toBe(1);
  });

  it('scales only fixed artifact main-panel modifiers', () => {
    expect(
      isArtifactMainPanelFixedModifier({
        attrType: AttributeType.ATK,
        type: ModifierType.FIXED,
      }),
    ).toBe(true);
    expect(
      isArtifactMainPanelFixedModifier({
        attrType: AttributeType.CRIT_RATE,
        type: ModifierType.FIXED,
      }),
    ).toBe(false);
    expect(
      isArtifactMainPanelFixedModifier({
        attrType: AttributeType.ATK,
        type: ModifierType.ADD,
      }),
    ).toBe(false);

    expect(
      scaleArtifactMainPanelFixedModifiers(
        [
          {
            attrType: AttributeType.ATK,
            type: ModifierType.FIXED,
            value: 100,
          },
          {
            attrType: AttributeType.CRIT_RATE,
            type: ModifierType.FIXED,
            value: 0.1,
          },
        ],
        0.5,
      ),
    ).toEqual([
      {
        attrType: AttributeType.ATK,
        type: ModifierType.FIXED,
        value: 50,
      },
      {
        attrType: AttributeType.CRIT_RATE,
        type: ModifierType.FIXED,
        value: 0.1,
      },
    ]);
  });
});

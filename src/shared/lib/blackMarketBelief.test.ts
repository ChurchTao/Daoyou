import {
  applyBlackMarketBeliefPatch,
  describeBlackMarketClaimMode,
} from './blackMarketBelief';

const belief = {
  confidence: 'medium' as const,
  beliefSummary: '货主仍相信自己的原判断。',
  clueInterpretations: [
    { observationId: 'surface-a', interpretation: '原有解释' },
  ],
};

describe('black market belief patch', () => {
  it('moves confidence by one level and clamps at the bounds', () => {
    expect(
      applyBlackMarketBeliefPatch({
        belief,
        patch: {
          confidenceDelta: 1,
          interpretationUpdates: [],
        },
        relevantObservationIds: new Set(),
        negativeChangeAllowed: false,
        summaryChangeAllowed: true,
      }).belief.confidence,
    ).toBe('high');

    expect(
      applyBlackMarketBeliefPatch({
        belief: { ...belief, confidence: 'high' },
        patch: {
          confidenceDelta: 1,
          interpretationUpdates: [],
        },
        relevantObservationIds: new Set(),
        negativeChangeAllowed: false,
        summaryChangeAllowed: true,
      }).belief.confidence,
    ).toBe('high');
  });

  it('drops unsupported negative confidence changes', () => {
    const result = applyBlackMarketBeliefPatch({
      belief,
      patch: {
        confidenceDelta: -1,
        beliefSummary: '货主已经动摇。',
        interpretationUpdates: [],
      },
      relevantObservationIds: new Set(),
      negativeChangeAllowed: false,
      summaryChangeAllowed: false,
    });

    expect(result).toEqual({ belief, changed: false });
  });

  it('updates at most two relevant observation interpretations', () => {
    const result = applyBlackMarketBeliefPatch({
      belief,
      patch: {
        confidenceDelta: 0,
        beliefSummary: '货主重新权衡了几处痕迹。',
        interpretationUpdates: [
          { observationId: 'surface-a', interpretation: '新的解释' },
          { observationId: 'inspection-b', interpretation: '第二条解释' },
          { observationId: 'inspection-c', interpretation: '第三条解释' },
          { observationId: 'unknown', interpretation: '越权解释' },
        ],
      },
      relevantObservationIds: new Set([
        'surface-a',
        'inspection-b',
        'inspection-c',
      ]),
      negativeChangeAllowed: true,
      summaryChangeAllowed: true,
    });

    expect(result.belief.clueInterpretations).toEqual([
      { observationId: 'surface-a', interpretation: '新的解释' },
      { observationId: 'inspection-b', interpretation: '第二条解释' },
    ]);
    expect(result.belief.beliefSummary).toBe('货主重新权衡了几处痕迹。');
  });

  it('returns only narrative belief fields', () => {
    const result = applyBlackMarketBeliefPatch({
      belief,
      patch: {
        confidenceDelta: 0,
        interpretationUpdates: [],
      },
      relevantObservationIds: new Set(),
      negativeChangeAllowed: false,
      summaryChangeAllowed: false,
    });

    expect(Object.keys(result.belief).sort()).toEqual([
      'beliefSummary',
      'clueInterpretations',
      'confidence',
    ]);
  });

  it('describes belief without claiming it was objectively wrong', () => {
    expect(describeBlackMarketClaimMode('belief')).toBe('主观判断');
    expect(describeBlackMarketClaimMode('bluff')).toBe('虚张声势');
    expect(describeBlackMarketClaimMode('evasion')).toBe('无法证实');
  });
});

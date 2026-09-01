import { describe, expect, it } from 'vitest';
import { FORMULA_FIT_POLICIES, getFormulaFitPolicy } from './alchemyFormulaFit';

describe('alchemy formula fit policy', () => {
  it('keeps stronger LLM verdicts strictly above weaker verdicts', () => {
    expect(FORMULA_FIT_POLICIES.aligned.score).toBeGreaterThan(
      FORMULA_FIT_POLICIES.degraded.score,
    );
    expect(FORMULA_FIT_POLICIES.degraded.score).toBeGreaterThan(
      FORMULA_FIT_POLICIES.poor.score,
    );
    expect(FORMULA_FIT_POLICIES.aligned.minMultiplier).toBeGreaterThan(
      FORMULA_FIT_POLICIES.degraded.maxMultiplier,
    );
    expect(FORMULA_FIT_POLICIES.degraded.minMultiplier).toBeGreaterThan(
      FORMULA_FIT_POLICIES.poor.maxMultiplier,
    );
  });

  it('returns bounded server-owned settlement values for every verdict', () => {
    for (const [band, policy] of Object.entries(FORMULA_FIT_POLICIES)) {
      expect(
        getFormulaFitPolicy(band as keyof typeof FORMULA_FIT_POLICIES),
      ).toBe(policy);
      expect(policy.baseMultiplier).toBeGreaterThanOrEqual(
        policy.minMultiplier,
      );
      expect(policy.baseMultiplier).toBeLessThanOrEqual(policy.maxMultiplier);
      expect(policy.score).toBeGreaterThanOrEqual(0);
      expect(policy.score).toBeLessThanOrEqual(1);
    }
  });
});

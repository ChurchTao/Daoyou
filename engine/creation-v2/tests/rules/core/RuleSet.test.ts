import { Rule, RuleDecisionMeta, RuleSet } from '@/engine/creation-v2';

interface TestFacts {
  totalEnergy: number;
}

interface TestDecision extends RuleDecisionMeta {
  signatureUnlocked: boolean;
}

describe('RuleSet', () => {
  const unlockSignatureRule: Rule<TestFacts, TestDecision> = {
    id: 'recipe.unlock.signature',
    apply(context) {
      if (context.facts.totalEnergy >= 32) {
        context.decision.signatureUnlocked = true;
        context.diagnostics.addReason({
          code: 'signature_unlocked',
          message: '总能量达到 signature 解锁阈值',
          details: { totalEnergy: context.facts.totalEnergy },
        });
        context.diagnostics.addTrace({
          ruleId: 'recipe.unlock.signature',
          outcome: 'applied',
          message: '已解锁 signature 词缀槽位',
        });
        return;
      }

      context.diagnostics.addWarning({
        code: 'signature_locked',
        message: '总能量不足，signature 词缀仍锁定',
        details: { totalEnergy: context.facts.totalEnergy },
      });
      context.diagnostics.addTrace({
        ruleId: 'recipe.unlock.signature',
        outcome: 'skipped',
        message: '未达到解锁阈值',
      });
    },
  };

  const createDecision = (): TestDecision => ({
    signatureUnlocked: false,
    reasons: [],
    warnings: [],
    trace: [],
  });

  it('应将规则诊断合并进 decision', () => {
    const ruleSet = new RuleSet([unlockSignatureRule], createDecision);

    const decision = ruleSet.evaluate({ totalEnergy: 40 }, {
      metadata: { phase: 'recipe_validation' },
    });

    expect(decision.signatureUnlocked).toBe(true);
    expect(decision.reasons).toEqual([
      expect.objectContaining({ code: 'signature_unlocked' }),
    ]);
    expect(decision.trace).toEqual([
      expect.objectContaining({
        ruleId: 'recipe.unlock.signature',
        outcome: 'applied',
      }),
    ]);
  });

  it('应在规则未命中时保留 warning 与 trace', () => {
    const ruleSet = new RuleSet([unlockSignatureRule], createDecision);

    const decision = ruleSet.evaluate({ totalEnergy: 12 });

    expect(decision.signatureUnlocked).toBe(false);
    expect(decision.warnings).toEqual([
      expect.objectContaining({ code: 'signature_locked' }),
    ]);
    expect(decision.trace).toEqual([
      expect.objectContaining({
        ruleId: 'recipe.unlock.signature',
        outcome: 'skipped',
      }),
    ]);
  });
});
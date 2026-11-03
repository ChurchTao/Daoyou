import { getMysteryTemplate } from '@daoyou/game-content/dungeon/scenarios';
import { describe, expect, it } from 'vitest';
import { createMysteryRun } from './engine.js';
import { projectMysteryView } from './projection.js';
import { mysteryConfrontationTarget, scoreMysteryRun } from './scoring.js';
import { buildMysterySkeleton } from './skeleton.js';
import {
  estimateMysteryMinimumActions,
  validateMysteryCase,
} from './validate.js';

const template = getMysteryTemplate('faction_choice')!;
const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 7);
const KNOWN = { intent_a: 'intent_a_true', intent_b: 'intent_b_true' };

describe('allegiance skeleton', () => {
  it('produces valid, solvable cases for every seed', () => {
    for (const seed of seeds) {
      const { caseFile } = buildMysterySkeleton(template, seed);
      expect(validateMysteryCase(caseFile, template), `seed ${seed}`).toEqual(
        [],
      );
      expect(estimateMysteryMinimumActions(caseFile)).toBeLessThanOrEqual(
        template.scale.action_budget * 0.75,
      );
    }
  });
});

describe('allegiance variants', () => {
  it('mixes in the honest-broker variant, where an envoy hides the harm', () => {
    let honest = 0;
    for (const seed of seeds) {
      const { caseFile } = buildMysterySkeleton(template, seed);
      const broker = caseFile.npcs.find((n) => n.role === 'broker')!;
      if (caseFile.variant !== 'honest_broker') {
        expect(broker.reactions.some((r) => r.exposesLie)).toBe(true);
        continue;
      }
      honest++;
      expect(broker.reactions).toEqual([]);
      // 调停且揭穿隐瞒祸事的代表后，对手是那位代表而不是中间人。
      const target = mysteryConfrontationTarget(
        caseFile,
        template,
        { ...KNOWN, side: 'side_mediate' },
        { flags: ['broker_exposed'] },
      );
      expect(target?.role, `seed ${seed}`).toMatch(/^envoy_/);
    }
    expect(honest).toBeGreaterThan(90);
  });
});

describe('allegiance judgement', () => {
  it('scores the intents but not the side you choose', () => {
    const { caseFile } = buildMysterySkeleton(template, 11);
    const run = createMysteryRun(caseFile, template.scale.action_budget);
    const totals = ['side_a', 'side_b', 'side_mediate'].map((side) => {
      const result = scoreMysteryRun(caseFile, template, run, {
        ...KNOWN,
        side,
      });
      expect(result.correct).toEqual({ intent_a: true, intent_b: true });
      return result.total;
    });
    expect(new Set(totals).size).toBe(1);
    expect(
      scoreMysteryRun(caseFile, template, run, { ...KNOWN, side: 'side_a' })
        .breakdown.truth,
    ).toBe(16); // 两道图谋都答对但没有掌握支撑线索，各得 40%。
  });

  it('shows your own choice for the judgement question', () => {
    const { caseFile } = buildMysterySkeleton(template, 11);
    const run = createMysteryRun(caseFile, template.scale.action_budget);
    const answers = { ...KNOWN, side: 'side_b' };
    const view = projectMysteryView(
      {
        templateId: template.id,
        caseSource: 'fallback',
        caseFile,
        run,
        result: scoreMysteryRun(caseFile, template, run, answers),
      },
      template,
    );
    expect(view.questions.find((q) => q.id === 'side')?.judgement).toBe(true);
    const side = view.result!.explanations.find(
      (e) => e.questionId === 'side',
    )!;
    expect(side.judgement).toBe(true);
    expect(side.answerLabel).toBe(
      caseFile.questions
        .find((q) => q.id === 'side')!
        .options!.find((o) => o.id === 'side_b')!.label,
    );
  });

  it('picks the opponent from your choice', () => {
    const { caseFile } = buildMysterySkeleton(template, 11);
    const target = (side: string, flags: string[] = []) =>
      mysteryConfrontationTarget(
        caseFile,
        template,
        { ...KNOWN, side },
        {
          flags,
        },
      )?.role;
    expect(target('side_a')).toBe('envoy_b');
    expect(target('side_b')).toBe('envoy_a');
    expect(target('side_mediate')).toBeUndefined();
    expect(target('side_mediate', ['broker_exposed'])).toBe('broker');
    expect(
      mysteryConfrontationTarget(
        caseFile,
        template,
        { ...KNOWN, intent_a: 'intent_a_claim', side: 'side_a' },
        { flags: [] },
      ),
    ).toBeNull();
  });
});

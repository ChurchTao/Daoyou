import { z } from 'zod';
import { IdentityReshapeCandidateSchema } from '@shared/types/identityReshape';
import {
  IDENTITY_RESHAPE_QUESTIONS,
  selectIdentityReshapeQuestions,
  validateIdentityReshapeAnswers,
} from './identityReshape';

describe('identity reshape question bank', () => {
  it('uses unique question and option ids with complete content', () => {
    expect(
      new Set(IDENTITY_RESHAPE_QUESTIONS.map((item) => item.id)).size,
    ).toBe(IDENTITY_RESHAPE_QUESTIONS.length);
    for (const question of IDENTITY_RESHAPE_QUESTIONS) {
      expect(question.source).toBeTruthy();
      expect(question.quote).toBeTruthy();
      expect(question.prompt).toBeTruthy();
      expect(question.options).toHaveLength(3);
      expect(new Set(question.options.map((item) => item.id)).size).toBe(3);
      expect(question.options.every((item) => item.label.length > 0)).toBe(
        true,
      );
    }
  });

  it('selects three distinct questions', () => {
    const selected = selectIdentityReshapeQuestions(3, () => 0.25);
    expect(selected).toHaveLength(3);
    expect(new Set(selected.map((item) => item.id)).size).toBe(3);
  });

  it('validates answers against the selected questions', () => {
    const selected = IDENTITY_RESHAPE_QUESTIONS.slice(0, 3);
    const answers = selected.map((question) => ({
      questionId: question.id,
      optionId: question.options[0].id,
    }));
    expect(
      validateIdentityReshapeAnswers(
        selected.map((item) => item.id),
        answers,
        true,
      ),
    ).toBe(true);
    expect(
      validateIdentityReshapeAnswers(
        selected.map((item) => item.id),
        [...answers, answers[0]],
        true,
      ),
    ).toBe(false);
  });

  it('enforces candidate text limits', () => {
    expect(
      IdentityReshapeCandidateSchema.safeParse({
        name: '陆观澜',
        origin: '北境散修',
        personality: '外静内坚',
        background: '幼时随商旅入山，于风雪古观中得见修行门径。',
      }).success,
    ).toBe(true);
    expect(
      IdentityReshapeCandidateSchema.safeParse({
        name: '一',
        origin: '北境',
        personality: '沉静',
        background: '背景过短',
      }).success,
    ).toBe(false);
  });

  it('emits a provider-compatible JSON Schema name pattern', () => {
    const jsonSchema = JSON.stringify(
      z.toJSONSchema(IdentityReshapeCandidateSchema),
    );

    expect(jsonSchema).not.toContain('\\\\p{Script=Han}');
    expect(jsonSchema).toContain('\\\\u3400-\\\\u4dbf');
  });
});

import {
  IDENTITY_RESHAPE_QUESTIONS,
  IDENTITY_RESHAPE_QUESTION_COUNT,
} from '@daoyou/game-content/identity-reshape';
import type {
  IdentityReshapeAnswer,
  IdentityReshapeQuestion,
} from '@daoyou/game-domain/identity-reshape';

const questionById = new Map(
  IDENTITY_RESHAPE_QUESTIONS.map((question) => [question.id, question]),
);

export function getIdentityReshapeQuestions(
  questionIds: readonly string[],
): IdentityReshapeQuestion[] {
  return questionIds.map((id) => {
    const question = questionById.get(id);
    if (!question) throw new Error(`身份重塑题目不存在：${id}`);
    return question;
  });
}

export function selectIdentityReshapeQuestions(
  count = IDENTITY_RESHAPE_QUESTION_COUNT,
  random: () => number = Math.random,
): IdentityReshapeQuestion[] {
  if (count < 0 || count > IDENTITY_RESHAPE_QUESTIONS.length) {
    throw new Error('身份重塑题目抽取数量非法');
  }
  const pool = [...IDENTITY_RESHAPE_QUESTIONS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const selectedIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[selectedIndex]] = [pool[selectedIndex], pool[index]];
  }
  return pool.slice(0, count);
}

export function validateIdentityReshapeAnswers(
  questionIds: readonly string[],
  answers: readonly IdentityReshapeAnswer[],
  requireComplete = false,
): boolean {
  const expectedIds = new Set(questionIds);
  if (answers.length > expectedIds.size) return false;
  if (requireComplete && answers.length !== expectedIds.size) return false;

  const seen = new Set<string>();
  return answers.every((answer) => {
    if (!expectedIds.has(answer.questionId) || seen.has(answer.questionId)) {
      return false;
    }
    seen.add(answer.questionId);
    const question = questionById.get(answer.questionId);
    return Boolean(
      question?.options.some((option) => option.id === answer.optionId),
    );
  });
}

export function describeIdentityReshapeAnswers(
  answers: readonly IdentityReshapeAnswer[],
): string {
  return answers
    .map((answer) => {
      const question = questionById.get(answer.questionId);
      const option = question?.options.find(
        (entry) => entry.id === answer.optionId,
      );
      if (!question || !option) throw new Error('身份重塑答案非法');
      return `${question.source}“${question.quote}”\n${question.prompt}\n选择：${option.label}`;
    })
    .join('\n\n');
}

import type {
  IdentityReshapeAnswer,
  IdentityReshapeQuestion,
} from '@daoyou/shared/types/identityReshape';

export const IDENTITY_RESHAPE_SCENARIO = 'identity_reshape';
export const IDENTITY_RESHAPE_TALISMAN_NAME = '改天换地符';
export const IDENTITY_RESHAPE_QUESTION_COUNT = 3;
export const IDENTITY_RESHAPE_SESSION_TTL_SECONDS = 3600;
export const IDENTITY_RESHAPE_DESCRIPTION_MIN_LENGTH = 2;
export const IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH = 200;

function options(...labels: string[]) {
  return labels.map((label, index) => ({
    id: String.fromCharCode(97 + index),
    label,
  }));
}

export const IDENTITY_RESHAPE_QUESTIONS: IdentityReshapeQuestion[] = [
  {
    id: 'dao-water',
    source: '《道德经》',
    quote: '上善若水，水善利万物而不争。',
    prompt: '身处争流，你愿如何自处？',
    options: options('润物不争', '顺势而行', '聚流破障'),
  },
  {
    id: 'dao-self-knowing',
    source: '《道德经》',
    quote: '知人者智，自知者明。',
    prompt: '你更愿先照见什么？',
    options: options('自己的本心', '众人的所求', '世局的变化'),
  },
  {
    id: 'dao-bend-whole',
    source: '《道德经》',
    quote: '曲则全，枉则直。',
    prompt: '遭逢逆境时，你会如何？',
    options: options('守柔待时', '迎难直进', '另辟蹊径'),
  },
  {
    id: 'dao-stillness',
    source: '《道德经》',
    quote: '致虚极，守静笃。',
    prompt: '心念纷乱时，你从何处求解？',
    options: options('静中观变', '行中求证', '向人问道'),
  },
  {
    id: 'dao-first-step',
    source: '《道德经》',
    quote: '千里之行，始于足下。',
    prompt: '面对遥远道途，你先做什么？',
    options: options('走好眼前一步', '先定最终归处', '等待真正契机'),
  },
  {
    id: 'zhuangzi-deep-water',
    source: '《庄子·逍遥游》',
    quote: '水之积也不厚，则其负大舟也无力。',
    prompt: '远志与根基之间，你如何取舍？',
    options: options('厚积根基', '借势远行', '以险境磨砺自己'),
  },
  {
    id: 'zhuangzi-right-wrong',
    source: '《庄子·齐物论》',
    quote: '彼亦一是非，此亦一是非。',
    prompt: '遇见相反立场时，你会如何？',
    options: options('求同存异', '坚守己见', '暂忘是非之分'),
  },
  {
    id: 'zhuangzi-natural-pattern',
    source: '《庄子·养生主》',
    quote: '依乎天理……因其固然。',
    prompt: '困局横在眼前，你从哪里破局？',
    options: options('循理取隙', '以力破局', '退后重新谋划'),
  },
  {
    id: 'zhuangzi-empty-room',
    source: '《庄子·人间世》',
    quote: '虚室生白，吉祥止止。',
    prompt: '怎样的心境最接近真实的你？',
    options: options('清空成见', '守住所信', '让喧嚣催我醒来'),
  },
  {
    id: 'yi-heaven',
    source: '《周易·乾》',
    quote: '天行健，君子以自强不息。',
    prompt: '你相信力量主要来自哪里？',
    options: options('不息的修行', '同行者的扶持', '长期蓄势后的决断'),
  },
  {
    id: 'yi-earth',
    source: '《周易·坤》',
    quote: '地势坤，君子以厚德载物。',
    prompt: '面对众生牵挂，你愿承担什么？',
    options: options('包容承载', '明辨取舍', '只守护最亲近之人'),
  },
  {
    id: 'yi-humility',
    source: '《周易·谦》',
    quote: '谦谦君子，卑以自牧也。',
    prompt: '声名来到身前时，你会如何？',
    options: options('敛锋自省', '当仁不让', '功成身退'),
  },
  {
    id: 'yi-change',
    source: '《周易·系辞下》',
    quote: '穷则变，变则通，通则久。',
    prompt: '道路已尽时，你会如何？',
    options: options('主动变通', '坚守到底', '暂退蓄势'),
  },
  {
    id: 'yi-many-views',
    source: '《周易·系辞上》',
    quote: '仁者见之谓之仁，知者见之谓之知。',
    prompt: '面对同一件事的多种解释，你相信什么？',
    options: options('接纳多解', '追寻唯一真义', '让结果作答'),
  },
  {
    id: 'clarity-stillness',
    source: '《太上老君说常清静经》',
    quote: '人能常清静，天地悉皆归。',
    prompt: '世事扰心时，你如何安顿自己？',
    options: options('守静澄心', '入世解纷', '随性而化'),
  },
  {
    id: 'response-and-retribution',
    source: '《太上感应篇》',
    quote: '祸福无门，惟人自召。',
    prompt: '面对因果与取舍，你最看重什么？',
    options: options('慎独积善', '先问本心', '权衡远近得失'),
  },
];

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

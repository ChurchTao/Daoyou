import type {
  BaixiaoAdminQuestion,
  BaixiaoQuestionStatus,
} from '@daoyou/contracts/baixiao/meet';
import {
  BaixiaoCategorySchema,
  BaixiaoDifficultySchema,
} from '@daoyou/game-domain/baixiao/question';

export type BankQuestion = BaixiaoAdminQuestion;
export const statusLabels = {
  published: '启用',
  retired: '停用',
} satisfies Record<BaixiaoQuestionStatus, string>;

export const categories = BaixiaoCategorySchema.options;
export const difficulties = BaixiaoDifficultySchema.options;

import type {
  BaixiaoAdminView,
  BaixiaoQuestionStatus,
} from '@daoyou/contracts/baixiao/meet';
import {
  BaixiaoCategorySchema,
  BaixiaoDifficultySchema,
} from '@daoyou/game-domain/baixiao/question';

export type BankQuestion = BaixiaoAdminView['bank'][number];
type Category = BankQuestion['category'];
type Difficulty = BankQuestion['difficulty'];

export const categoryLabels = {
  literature: '文学与文史',
  history: '历史地理',
  riddle: '脑洞与谜语',
  science: '博物与科学',
} satisfies Record<Category, string> & Record<string, string>;

export const difficultyLabels = {
  easy: '易',
  medium: '中',
  hard: '难',
} satisfies Record<Difficulty, string>;

export const statusLabels = {
  published: '启用',
  retired: '停用',
} satisfies Record<BaixiaoQuestionStatus, string>;

export const categories = BaixiaoCategorySchema.options;
export const difficulties = BaixiaoDifficultySchema.options;

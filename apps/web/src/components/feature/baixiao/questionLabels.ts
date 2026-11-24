import type { BaixiaoQuestionData } from '@daoyou/game-domain/baixiao/question';

export const categoryLabels = {
  literature: '文学与文史',
  history: '历史地理',
  riddle: '脑洞与谜语',
  science: '博物与科学',
} satisfies Record<BaixiaoQuestionData['category'], string> &
  Record<string, string>;

export const difficultyLabels = {
  easy: '易',
  medium: '中',
  hard: '难',
} satisfies Record<BaixiaoQuestionData['difficulty'], string>;

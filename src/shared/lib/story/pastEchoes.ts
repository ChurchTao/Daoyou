import {
  PERSONAL_STORY_FRAMEWORK_ID,
  PERSONAL_STORY_FRAMEWORK_TITLE,
  PERSONAL_STORY_FRAMEWORK_VERSION,
} from './personalStory';

export const PAST_ECHOES_FRAMEWORK = {
  id: PERSONAL_STORY_FRAMEWORK_ID,
  version: PERSONAL_STORY_FRAMEWORK_VERSION,
  title: PERSONAL_STORY_FRAMEWORK_TITLE,
  theme: '过去的一次选择重新找上玩家',
  entryConditions: [
    '玩家至少完成过一次秘境',
    '存在一条可以引用的个人记忆',
    '玩家当前没有其他活跃个人剧情线',
  ],
  stages: ['omen', 'choice', 'confrontation', 'aftermath', 'resolved'],
  forbiddenClaims: [
    '替玩家决定选择',
    '改变已确认战斗结果',
    '直接发放或扣除资源',
    '复活已确认死亡的实体',
    '让已确认死亡的实体主动回信或嘱咐玩家',
    '把新人物自称的故人关系写成已证实事实',
    '引用其他玩家的私有事实',
  ],
} as const;

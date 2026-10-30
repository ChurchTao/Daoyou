import type { SectDefinition } from '@daoyou/game-domain/sects';
import { BAILU_SECT_ID } from './ids.js';

/** 组织传承索引；战斗技能、流派及经脉只由 combat-v6 内容提供。 */
export const BAILU_DEFINITION: SectDefinition = {
  id: BAILU_SECT_ID,
  name: '白鹿书院',
  description:
    '白鹿书院以经义修心，以浩气立身。门人一言可止争，一笔可诛邪；先以正言约束敌手，再以文章显化攻势。欲使言行天地，须先使身心无愧。',
  raceIds: ['human'],
  configVersion: 1,
  methods: [
    {
      id: 'bailu.method.canon',
      slot: 1,
      name: '《白鹿正学》',
      description: '修身立言，胸存正气；欲正人言，先正己心。',
      isPrimary: true,
    },
    {
      id: 'bailu.method.song',
      slot: 2,
      name: '《正气长歌》',
      description: '以经义发正声，以浩然之气化文章为攻势。',
    },
    {
      id: 'bailu.method.edict',
      slot: 3,
      name: '《春秋笔法》',
      description: '一字褒贬，自有法度；以短言断敌势，以笔削破浮华。',
    },
    {
      id: 'bailu.method.recovery',
      slot: 4,
      name: '《养气存诚》',
      description: '存诚养心，调息护体，使损耗的生机渐归平稳。',
    },
    {
      id: 'bailu.method.bearing',
      slot: 5,
      name: '《慎独明心》',
      description: '独处不欺，临敌不乱；温养浩气，借先贤篇章护持自身。',
    },
    {
      id: 'bailu.method.step',
      slot: 6,
      name: '《君子行》',
      description: '行止有度，进退从容；步履之间不失所守。',
    },
  ],
  abilities: [
    {
      id: 'bailu.skill.poxie',
      kind: 'default',
      baseName: '破邪！',
      description: '一声破邪，凝浩气攻击敌人。',
      role: 'generator',
      unlock: { type: 'method', methodId: 'bailu.method.song', level: 1 },
    },
    {
      id: 'bailu.passive.righteousness',
      kind: 'passive',
      baseName: '浩然正气',
      description: '胸存正气，以所学辨邪正。',
      role: 'utility',
      sourceMethodId: 'bailu.method.canon',
      unlock: { type: 'always' },
    },
    {
      id: 'bailu.skill.jinfa',
      kind: 'active',
      baseName: '禁法！',
      description: '以言令封住敌方法术，削弱其法术防御。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'bailu.method.edict', level: 40 },
    },
    {
      id: 'bailu.skill.fuyuan',
      kind: 'active',
      baseName: '复元！',
      description: '收心存诚，消耗法力恢复自身气血。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'bailu.method.recovery', level: 1 },
    },
    {
      id: 'bailu.skill.hushen',
      kind: 'active',
      baseName: '护身！',
      description: '先贤篇章凝成文影，为自身拦下敌方攻势。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'bailu.method.bearing', level: 120 },
    },
    {
      id: 'bailu.organization.step',
      kind: 'passive',
      baseName: '君子行',
      description: '《君子行》的传承索引，战斗面板由当前心法投影提供。',
      role: 'utility',
      visibility: 'internal',
      unlock: { type: 'method', methodId: 'bailu.method.step', level: 1 },
    },
  ],
  paths: [],
  onboarding: {
    initialContribution: 0,
    initialMethods: {
      'bailu.method.canon': 1,
      'bailu.method.song': 1,
      'bailu.method.edict': 1,
      'bailu.method.recovery': 1,
      'bailu.method.bearing': 1,
      'bailu.method.step': 1,
    },
    initialAbilityLoadout: ['bailu.skill.fuyuan', null, null, null],
  },
};

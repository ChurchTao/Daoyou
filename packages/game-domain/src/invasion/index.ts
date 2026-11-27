import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { GenderType } from '../character.js';
import type { ItemGrant } from '../items/inventory.js';

export const INVASION_NODE_ID = 'SAT_TN_INVASION';
export const INVASION_PATH = '/game/ancient-demon-invasion';
export const INVASION_CARDS = [
  'assault',
  'guard',
  'healing',
  'focus',
  'shield',
] as const;
export type InvasionCard = (typeof INVASION_CARDS)[number];
export const INVASION_CARD_COPY: Record<
  InvasionCard,
  { name: string; effect: string }
> = {
  assault: { name: '破军', effect: '自身物理、法术伤害提高 12%' },
  guard: { name: '镇岳', effect: '自身受到的物理、法术伤害降低 12%' },
  healing: { name: '回春', effect: '自身施放的治疗效果提高 20%' },
  focus: { name: '凝神', effect: '自身技能法力消耗降低 20%' },
  shield: { name: '护心', effect: '开场获得气血上限 18% 的护盾，持续 3 回合' },
};
export type InvasionResources = {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
};
export type InvasionReward = {
  cultivationExp: number;
  spiritStones: number;
  insight: number;
  drops: ItemGrant[];
};
export type InvasionRewardSummary = InvasionReward & {
  lastWave?: { wave: number; reward: InvasionReward };
};
export type InvasionMember = {
  userId: string;
  cultivatorId: string;
  name: string;
  title: string | null;
  gender: GenderType;
  realm: RealmType;
  realmStage: RealmStage;
};
export type InvasionCards = Partial<Record<InvasionCard, number>>;
export type InvasionPhase =
  'assembling' | 'launching' | 'battle' | 'rest' | 'finished';
export type InvasionBattle = { teamId: string; wave: number; endsAt: number };

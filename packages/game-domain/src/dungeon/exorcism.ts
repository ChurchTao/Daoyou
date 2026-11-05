import type { PresentedBattleInput } from '../combat/battle-input.js';
import type { PveRestoredState } from '../combat/runtime.js';

/** 云游·除祟：一局四场，第四场为首领。 */
export const EXORCISM_STAGE_COUNT = 4;

export const EXORCISM_LINEAGE_IDS = [
  'grass',
  'earth',
  'water',
  'demonic',
  'corpse',
] as const;
export type ExorcismLineageId = (typeof EXORCISM_LINEAGE_IDS)[number];

export const EXORCISM_BOSS_IDS = [
  'withered_vine',
  'broken_vein',
  'soul_shadow',
  'mirror_lord',
  'tide_serpent',
  'gilded_corpse',
  'heretic',
  'dream_binder',
  'bronze_warden',
  'lingering_soul',
  'mountain_king',
  'blood_broker',
  'blood_python',
  'rot_crone',
] as const;
export type ExorcismBossId = (typeof EXORCISM_BOSS_IDS)[number];

/** 构筑特征，也是首领克制的对象。 */
export const EXORCISM_BUILD_TAGS = [
  'physical',
  'spell',
  'sustain',
  'single_target',
] as const;
export type ExorcismBuildTag = (typeof EXORCISM_BUILD_TAGS)[number];

export type ExorcismGrade = 'S' | 'A' | 'B' | 'C' | 'D';
export type ExorcismSupplyChoice = 'rest' | 'search';
export type ExorcismEndReason = 'cleared' | 'defeated' | 'retreated';
export type ExorcismPhase = 'battle' | 'supply' | 'finished';

export interface ExorcismUnitResources {
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
}

/** 局内资源，与人物现实气血法力完全分开。缺省表示本局尚未开战、将以满状态入场。 */
export interface ExorcismResources {
  player: ExorcismUnitResources;
  beasts: Record<string, ExorcismUnitResources>;
}

export interface ExorcismRunState {
  bossId: ExorcismBossId;
  lineageId: ExorcismLineageId;
  /** 开局时冻结：本局首领是否克制此构筑。 */
  countered: boolean;
  phase: ExorcismPhase;
  /** 已胜场次，0–4。 */
  wins: number;
  resources?: ExorcismResources;
  supplies: ExorcismSupplyChoice[];
  endReason?: ExorcismEndReason;
  /** 一场未胜为 null。 */
  grade?: ExorcismGrade | null;
  /** 结束时人物气血比例。 */
  finalHpRatio?: number;
}

export interface ExorcismNpcPlan {
  cycle: string[];
  fallback: string;
}

export interface ExorcismBattleSnapshot extends PveRestoredState {
  version: 'exorcism-v6-v1';
  playerId: string;
  input: PresentedBattleInput;
  npcPlans: Record<string, ExorcismNpcPlan>;
}

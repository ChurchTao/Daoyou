import type { BattleEvent } from '@daoyou/combat-core/types';


export interface CombatV6UnitAppearance {
  icon: string;
  speciesName?: string;
  isMutant?: boolean;
}


export interface CombatV6TrainingUnitViewV1 {
  /** Other participants expose bars in basis points, not exact resource values. */
  publicBars?: boolean;
  id: string;
  name: string;
  side: 0 | 1;
  slot: number;
  kind?: 'player' | 'pet' | 'npc';
  ownerId?: string;
  attributes?: Record<string, number>;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  wound: number;
  downed: boolean;
  dead: boolean;
  escaped: boolean;
  statuses: Array<{
    id: string;
    name?: string;
    remainingRounds: number;
    untilBattleEnd?: boolean;
    importance?: 'control' | 'harmful';
    stacks: number;
  }>;
  barriers: Array<{
    untilBattleEnd?: boolean;
    id: string;
    name: string;
    current: number;
    remainingRounds: number;
  }>;
  resources: Array<{ id: string; name: string; current: number; max: number | null }>;
}


export type CombatV6UnitChanges = Partial<
  Omit<CombatV6TrainingUnitViewV1, 'id'>
>;

export type CombatV6OptionalUnitField =
  'kind' | 'ownerId' | 'attributes' | 'publicBars';

export interface CombatV6DeltaFrameV1 {
  afterEventSeq: number;
  round: number;
  updates: Array<{
    id: string;
    set: CombatV6UnitChanges;
    unset?: CombatV6OptionalUnitField[];
  }>;
  added?: CombatV6TrainingUnitViewV1[];
  removed?: string[];
  /** Present only when insertion/reordering cannot preserve the existing array order. */
  order?: string[];
}

export interface CombatV6PlaybackV1 {
  format: 'delta-v1';
  fromEventSeq: number;
  frames: CombatV6DeltaFrameV1[];
}


type PrivateResourceFields =
  | 'hp'
  | 'hpAfter'
  | 'mpAfter'
  | 'maxHpAfter'
  | 'recoverableHpAfter'
  | 'generationSeed';

type DisplayEvent<E> = E extends BattleEvent
  ? Omit<E, PrivateResourceFields> &
      Partial<Pick<E, Extract<keyof E, PrivateResourceFields>>>
  : never;

/** PVE may include exact resources; arena redacts post-action resource balances. */
export type CombatV6DisplayEvent = DisplayEvent<BattleEvent>;

export type CombatV6DisplayCatalog = {
    unitAppearances?: Record<string, CombatV6UnitAppearance>;
    unitNames?: Record<string, string>;
    skills: Record<string, string>;
    skillDetails?: Record<
      string,
      { category: 'spell' | 'art'; description: string }
    >;
    statuses: Record<string, string>;
  };

export type SequencedCombatV6Event = { seq: number; event: CombatV6DisplayEvent };

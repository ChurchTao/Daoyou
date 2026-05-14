import type { BuffConfig, AttributeModifierConfig } from '../core/configs';
import {
  AttributeType,
  type ModifierType,
} from '../core/types';

export type ResourcePointState =
  | { mode: 'absolute'; value: number }
  | { mode: 'percent'; value: number };

export interface PersistentCombatStatusV5 {
  version: 1;
  templateId: string;
  stacks: number;
  usesRemaining?: number;
  expiresAt?: number;
  payload?: Record<string, number | string | boolean>;
}

export interface BattleUnitInitStartingBuff {
  buff: BuffConfig;
  stacks?: number;
  source: 'self' | 'opponent';
}

export interface BattleUnitInitSpec {
  baseAttributeOverrides?: Partial<
    Record<
      | AttributeType.SPIRIT
      | AttributeType.VITALITY
      | AttributeType.SPEED
      | AttributeType.WILLPOWER
      | AttributeType.WISDOM,
      number
    >
  >;
  modifiers?: AttributeModifierConfig[];
  resourceState?: {
    hp?: ResourcePointState;
    mp?: ResourcePointState;
    shield?: number;
  };
  statusRefs?: PersistentCombatStatusV5[];
  startingBuffs?: BattleUnitInitStartingBuff[];
}

export interface BattleInitConfigV5 {
  player?: BattleUnitInitSpec;
  opponent?: BattleUnitInitSpec;
}

export interface CombatStatusTemplateDisplay {
  icon: string;
  shortDesc?: string;
  path?: string;
  action?: string;
  showUses?: boolean;
  showExpiry?: boolean;
}

export interface CombatStatusTemplate {
  id: string;
  name: string;
  description: string;
  display: CombatStatusTemplateDisplay;
  toBattleInit(status: PersistentCombatStatusV5): BattleUnitInitSpec;
}

export interface TrainingRoomModifierDraft {
  id: string;
  attrType: AttributeType;
  type: Exclude<ModifierType, 'base'>;
  value: number;
}

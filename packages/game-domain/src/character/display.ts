import type { Cultivator, Attributes } from '../cultivator.js';
import type { CharacterPanelV1 } from '../combat/panel.js';
import type { CharacterCombatInput } from '../combat/projection.js';

export type CultivatorDisplayInput = Pick<
  Cultivator,
  'id' | 'name' | 'attributes' | 'realm' | 'realm_stage' | 'condition' | 'sect'
> & {
  combatV6ResourceAuthority?: CombatV6ResourceAuthority & {
    build: CharacterDisplayBuild | null;
  };
};

export type CharacterDisplayBuild = Pick<
  CharacterCombatInput,
  'sect' | 'equipment' | 'manuals'
>;

export interface CombatV6ResourceAuthority {
  maxHp: number;
  maxMp: number;
  recoveryPaused: boolean;
  attrs: CharacterPanelV1;
  effectiveAttributes: Attributes;
}

export interface CultivatorDisplaySnapshot {
  attrs: CharacterPanelV1;
  effectiveAttributes: Attributes;
  resources: Record<
    'hp' | 'mp',
    { current: number; max: number; percent: number }
  >;
}

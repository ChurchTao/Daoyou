export type CombatVisualDiscipline = 'physical' | 'spell' | 'true';

export type CombatVisualDelivery =
  'melee' | 'projectile' | 'beam' | 'field' | 'self';

export type CombatVisualDistribution = 'single' | 'fanout' | 'area';

export type CombatVisualWeight = 'light' | 'normal' | 'heavy';

export type CombatControlVisual =
  'stun' | 'bind' | 'sleep' | 'freeze' | 'generic';

export interface CombatVisualSpec {
  discipline: CombatVisualDiscipline;
  delivery: CombatVisualDelivery;
  distribution?: CombatVisualDistribution;
  weight?: CombatVisualWeight;
  element?:
    | 'metal'
    | 'wood'
    | 'water'
    | 'fire'
    | 'earth'
    | 'wind'
    | 'ice'
    | 'thunder'
    | 'none';
  impact?: 'slash' | 'burst' | 'bind' | 'heal' | 'shield' | 'drain' | 'break';
}

export interface CombatVisualReactionRef {
  sourceId: string;
  label: string;
}

interface CombatVisualFactBase {
  id: string;
  sourceId?: string;
  targetIds: string[];
  label?: string;
  timing?: 'cast' | 'impact' | 'after';
  reaction?: CombatVisualReactionRef;
}

export type CombatVisualFact =
  | (CombatVisualFactBase & {
      kind: 'damage';
      amount: number;
      hpDamage?: number;
      damageType: 'physical' | 'magical' | 'true' | 'dot';
      damageSource?: 'direct' | 'reflect' | 'counter' | 'follow_up' | 'delayed';
      critical?: boolean;
      shieldAbsorbed?: number;
    })
  | (CombatVisualFactBase & {
      kind: 'recovery';
      resource: 'hp' | 'mp';
      amount: number;
    })
  | (CombatVisualFactBase & {
      kind: 'shield';
      operation: 'gain' | 'break' | 'absorb';
      amount: number;
    })
  | (CombatVisualFactBase & {
      kind: 'status';
      operation: 'apply' | 'layers' | 'remove' | 'immune';
      statusId: string;
      statusName: string;
      statusType: 'buff' | 'debuff' | 'control';
      controlVisual?: CombatControlVisual;
      layers?: number;
      durationMs?: number;
    })
  | (CombatVisualFactBase & {
      kind: 'defense';
      defense:
        'mana_shield' | 'damage_immune' | 'dodge' | 'resist' | 'interrupt';
      amount?: number;
      detail?: string;
    })
  | (CombatVisualFactBase & {
      kind: 'resource';
      resourceId: string;
      resourceName: string;
      before: number;
      after: number;
      max?: number;
    })
  | (CombatVisualFactBase & {
      kind: 'action_state';
      stateType: 'rest' | 'queued_action' | 'ability_mode';
      phase: 'entered' | 'triggered' | 'cancelled' | 'skipped';
      stateName: string;
      durationMs?: number;
    })
  | (CombatVisualFactBase & {
      kind: 'mechanic';
      mechanic:
        | 'ability_transform'
        | 'ability_lock'
        | 'tag_trigger'
        | 'hp_sacrifice'
        | 'damage_defer'
        | 'mana_burn'
        | 'cooldown_change'
        | 'memory_record'
        | 'memory_release'
        | 'control_skip'
        | 'named_trigger'
        | 'status_transition';
      displayName: string;
      amount?: number;
      detail?: string;
    })
  | (CombatVisualFactBase & {
      kind: 'death_prevented';
      sourceName?: string;
    })
  | (CombatVisualFactBase & {
      kind: 'unit_died';
    });

export interface CombatVisualActionInput {
  id: string;
  sourceId: string;
  targetIds: string[];
  ability: {
    id: string;
    name: string;
  };
  annotation?: string;
  visual: CombatVisualSpec;
  facts: CombatVisualFact[];
}

export type CombatImpactCue =
  | {
      id: string;
      sourceId: string;
      targetId: string;
      kind: 'damage';
      amount: number;
      shieldAbsorbed: number;
      damageType: 'physical' | 'magical' | 'true' | 'dot';
      critical: boolean;
    }
  | {
      id: string;
      sourceId: string;
      targetId: string;
      kind: 'recovery';
      amount: number;
    }
  | {
      id: string;
      sourceId: string;
      targetId: string;
      kind: 'message';
      label: '闪避' | '抵抗' | '免疫' | '中断' | '留命' | '离阵';
      tone: 'defense' | 'survival' | 'neutral';
    };

interface CombatVisualCommandBase {
  id: string;
  at: number;
  duration: number;
}

export type CombatVisualCommand =
  | (CombatVisualCommandBase & {
      kind: 'cast';
    })
  | (CombatVisualCommandBase & {
      kind: 'delivery';
      impactAt: number;
    })
  | (CombatVisualCommandBase & {
      kind: 'reaction';
      fact: CombatVisualFact;
    })
  | (CombatVisualCommandBase & {
      kind: 'resolve';
      fact: CombatVisualFact;
    })
  | (CombatVisualCommandBase & {
      kind: 'impact_cue';
      cue: CombatImpactCue;
    })
  | (CombatVisualCommandBase & {
      kind: 'settle';
    });

export interface CombatVisualTimeline {
  action: CombatVisualActionInput;
  duration: number;
  impactAt: number;
  commands: CombatVisualCommand[];
}

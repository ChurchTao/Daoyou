import type { ActionStatePhase, ActionStateType } from '../core/actionState';
import type { UnitStateDelta, UnitStateSnapshot } from '../systems/state/types';
import type { CombatMechanicPayloadV3 } from './mechanics';

export interface UnitRefV3 {
  id: string;
  name: string;
}

export interface AbilityRefV3 {
  id: string;
  name: string;
}

export type CombatCarrierV3 =
  | { kind: 'ability'; id: string; name: string }
  | { kind: 'buff'; id: string; name: string }
  | { kind: 'equipment'; id: string; name: string }
  | { kind: 'gongfa'; id: string; name: string }
  | { kind: 'mechanic'; id: string; name: string };

export type CombatOriginV3 =
  | {
      kind: 'owned';
      owner: UnitRefV3;
      carrier: CombatCarrierV3;
    }
  | {
      kind: 'system';
      carrier: { kind: 'system'; id: string; name: string };
    };

export interface CombatTraceV3 {
  eventId: string;
  sequenceId: string;
  ordinal: number;
  parentEventId?: string;
  resolutionId?: string;
  narrativeCauseId?: string;
}

export interface CombatNarrativeRelationV3 {
  causeId: string;
  role: 'cue' | 'result';
}

export type CombatSequencePhaseV3 =
  | 'battle_init'
  | 'round_start'
  | 'round_post'
  | 'action_pre'
  | 'action'
  | 'action_after'
  | 'battle_end';

export interface CombatSequenceScopeV3 {
  id?: string;
  turn: number;
  phase: CombatSequencePhaseV3;
  actor?: UnitRefV3;
  ability?: AbilityRefV3;
}

export interface ResolvedCombatSequenceScopeV3 extends Omit<
  CombatSequenceScopeV3,
  'id'
> {
  id: string;
}

export interface CombatFactBaseV3 {
  id: string;
  trace: CombatTraceV3;
  origin: CombatOriginV3;
  target: UnitRefV3;
  narrative?: CombatNarrativeRelationV3;
}

export type CombatStatusApplicationTransitionV3 =
  'added' | 'stacked' | 'refreshed' | 'replaced';

export type CombatStatusRemovalReasonV3 =
  'expired' | 'dispelled' | 'consumed' | 'replaced' | 'manual';

export type CombatStatusLayerChangeReasonV3 =
  'modified' | 'consumed' | 'dispelled';

type CombatStatusFactV3 = CombatFactBaseV3 &
  (
    | {
        type: 'status';
        operation: 'apply';
        transition: CombatStatusApplicationTransitionV3;
        statusId: string;
        statusName: string;
        statusType: 'buff' | 'debuff' | 'control';
        beforeLayers: number;
        afterLayers: number;
        duration: number;
      }
    | {
        type: 'status';
        operation: 'layers';
        reason: CombatStatusLayerChangeReasonV3;
        statusId: string;
        statusName: string;
        statusType: 'buff' | 'debuff' | 'control';
        beforeLayers: number;
        afterLayers: number;
      }
    | {
        type: 'status';
        operation: 'remove';
        reason: CombatStatusRemovalReasonV3;
        statusId: string;
        statusName: string;
        statusType: 'buff' | 'debuff' | 'control';
        beforeLayers: number;
        afterLayers: 0;
      }
    | {
        type: 'status';
        operation: 'immune';
        statusId: string;
        statusName: string;
        statusType: 'buff' | 'debuff' | 'control';
      }
  );

type CombatActionStateFactV3 = CombatFactBaseV3 & {
  type: 'action_state';
  phase: ActionStatePhase;
  name: string;
  remainingActions: number;
} & (
    | {
        stateType: 'queued_action';
        ability: AbilityRefV3;
      }
    | {
        stateType: Exclude<ActionStateType, 'queued_action'>;
        ability?: never;
      }
  );

export type CombatFactV3 =
  | (CombatFactBaseV3 & {
      type: 'damage';
      amount: number;
      beforeHp: number;
      afterHp: number;
      damageType: 'physical' | 'magical' | 'true' | 'dot';
      damageSource?: 'direct' | 'reflect' | 'counter' | 'follow_up' | 'delayed';
      critical: boolean;
      shieldAbsorbed: number;
    })
  | (CombatFactBaseV3 & {
      type: 'recovery';
      resource: 'hp' | 'mp';
      amount: number;
      after: number;
    })
  | (CombatFactBaseV3 & {
      type: 'shield';
      amount: number;
      after: number;
    })
  | CombatStatusFactV3
  | (CombatFactBaseV3 & {
      type: 'defense';
      defense:
        | 'mana_shield'
        | 'damage_immune'
        | 'skill_immune'
        | 'dodge'
        | 'resist'
        | 'interrupt';
      amount?: number;
      detail?: string;
    })
  | (CombatFactBaseV3 & {
      type: 'resource';
      resourceId: string;
      resourceName: string;
      before: number;
      after: number;
      applied: number;
      max?: number;
    })
  | CombatActionStateFactV3
  | (CombatFactBaseV3 & {
      type: 'mechanic';
      code: string;
      payload: CombatMechanicPayloadV3;
    })
  | (CombatFactBaseV3 & {
      type: 'death_prevented';
      sourceKey?: string;
      sourceName?: string;
    })
  | (CombatFactBaseV3 & {
      type: 'unit_died';
      killer?: UnitRefV3;
    });

export interface CombatSequenceV3 extends ResolvedCombatSequenceScopeV3 {
  facts: CombatFactV3[];
}

export type CombatFactDraftV3 = CombatFactV3 extends infer T
  ? T extends CombatFactV3
    ? Omit<T, keyof CombatFactBaseV3>
    : never
  : never;

export interface BattleStateFrameV3 {
  frameId: number;
  turn: number;
  phase:
    | 'battle_init'
    | 'action_pre'
    | 'action_post'
    | 'round_post'
    | 'battle_end';
  actorId?: string;
  sourceSequenceId: string;
  units: Record<string, UnitStateSnapshot>;
  deltas?: Record<string, UnitStateDelta>;
}

export interface BattleStateTimelineV3 {
  frames: BattleStateFrameV3[];
  unitIds: string[];
  unitNames: Record<string, string>;
}

export interface BattleRecordV3 {
  participants: {
    player: UnitRefV3;
    opponent: UnitRefV3;
  };
  outcome: {
    winner: UnitRefV3;
    loser: UnitRefV3;
    turns: number;
  };
  sequences: CombatSequenceV3[];
  stateTimeline: BattleStateTimelineV3;
  finalSnapshots: {
    winner: UnitStateSnapshot;
    loser: UnitStateSnapshot;
  };
}

export type PresentedLogToneV3 =
  | 'neutral'
  | 'secondary'
  | 'ability'
  | 'damage'
  | 'damage_physical'
  | 'damage_magical'
  | 'damage_true'
  | 'damage_dot'
  | 'positive'
  | 'negative'
  | 'shield'
  | 'resource'
  | 'buff'
  | 'debuff'
  | 'control'
  | 'mechanic'
  | 'defense'
  | 'fatal';

export interface PresentedLogPartV3 {
  kind: 'text' | 'unit' | 'ability' | 'number' | 'resource' | 'status';
  text: string;
  tone?: PresentedLogToneV3;
  emphasis?: 'normal' | 'strong';
}

export interface PresentedLogLineV3 {
  role:
    | 'header'
    | 'primary'
    | 'trigger'
    | 'secondary'
    | 'resource'
    | 'state'
    | 'system';
  parts: PresentedLogPartV3[];
  /** 来源与结果合并时使用因果谓语，或直接承接已自带谓语的完整句。 */
  attributionLink?: 'caused' | 'context';
}

export type CombatLogPresentationModeV3 = 'concise' | 'detailed';

interface PresentedLogGroupBaseV3 {
  id: string;
}

/** 当前 Sequence 的直接结果，不额外声明来源。 */
export interface PresentedRootLogGroupV3 extends PresentedLogGroupBaseV3 {
  layout: 'root';
  lines: PresentedLogLineV3[];
}

/** 单一来源结果，来源和结果合并为一行。 */
export interface PresentedInlineLogGroupV3 extends PresentedLogGroupBaseV3 {
  layout: 'inline';
  line: PresentedLogLineV3;
}

/** 同一来源产生多个结果，保留显式来源标题和结果子树。 */
export interface PresentedBranchLogGroupV3 extends PresentedLogGroupBaseV3 {
  layout: 'branch';
  heading: PresentedLogLineV3;
  lines: PresentedLogLineV3[];
}

export type PresentedLogGroupV3 =
  | PresentedRootLogGroupV3
  | PresentedInlineLogGroupV3
  | PresentedBranchLogGroupV3;

export interface PresentedCombatSequenceV3 {
  id: string;
  heading?: PresentedLogLineV3;
  groups: PresentedLogGroupV3[];
}

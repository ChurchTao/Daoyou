import { isActionStatePhase, isActionStateType } from '../core/actionState';
import type {
  BattleStateTimeline,
  UnitStateSnapshot,
} from '../systems/state/types';
import { isCombatMechanicCuePayloadV3 } from './mechanics';
import type {
  BattleRecordV3,
  BattleStateTimelineV3,
  CombatFactV3,
  CombatSequenceV3,
  UnitRefV3,
} from './types';

export function toBattleStateTimelineV3(
  timeline: BattleStateTimeline,
): BattleStateTimelineV3 {
  return {
    unitIds: [...timeline.unitIds],
    unitNames: { ...timeline.unitNames },
    frames: timeline.frames.map((frame) => {
      if (!frame.sourceSequenceId) {
        throw new Error(
          `Battle state frame ${frame.frameId} has no sourceSequenceId`,
        );
      }
      return { ...frame, sourceSequenceId: frame.sourceSequenceId };
    }),
  };
}

export class BattleRecordValidatorV3 {
  private readonly knownUnitIds: Set<string>;
  private readonly sequenceIndex = new Map<string, number>();
  private readonly eventOrdinals = new Map<string, number>();
  private readonly factIds = new Set<string>();
  private readonly ordinals = new Set<number>();
  private readonly deaths = new Map<
    string,
    { ordinal: number; sequenceIndex: number }
  >();
  private readonly resolutionOutcomes = new Map<
    string,
    Set<'death_prevented' | 'unit_died'>
  >();
  private readonly resolutionOutcomeTargets = new Map<string, string>();
  private readonly damageResolutions = new Map<string, string>();

  constructor(private readonly record: BattleRecordV3) {
    this.knownUnitIds = new Set(record.stateTimeline.unitIds);
  }

  validate(): void {
    this.sequenceIndex.clear();
    this.eventOrdinals.clear();
    this.factIds.clear();
    this.ordinals.clear();
    this.deaths.clear();
    this.resolutionOutcomes.clear();
    this.resolutionOutcomeTargets.clear();
    this.damageResolutions.clear();
    this.validateShape();
    this.validateSequences();
    this.validateParentOrder();
    this.validateResolutionOutcomes();
    this.validateActionsAfterDeath();
    this.validateTimeline();
    this.validateOutcome();
  }

  private validateShape(): void {
    if (!this.record || typeof this.record !== 'object') {
      throw new Error('BattleRecordV3 is missing');
    }
    if (!this.record.sequences.length) {
      throw new Error('BattleRecordV3 has no combat sequences');
    }
    if (!this.record.stateTimeline.frames.length) {
      throw new Error('BattleRecordV3 has no state timeline frames');
    }
    if (
      this.knownUnitIds.size !== 2 ||
      this.record.stateTimeline.unitIds.length !== 2
    ) {
      throw new Error('BattleRecordV3 requires exactly two unique units');
    }

    const playerId = this.record.participants.player.id;
    const opponentId = this.record.participants.opponent.id;
    if (playerId === opponentId) {
      throw new Error('BattleRecordV3 participants must be distinct');
    }
    this.assertKnownUnitRef(this.record.participants.player, 'player');
    this.assertKnownUnitRef(this.record.participants.opponent, 'opponent');
    for (const id of this.knownUnitIds) {
      if (id !== playerId && id !== opponentId) {
        throw new Error(
          `BattleRecordV3 timeline contains non-participant: ${id}`,
        );
      }
      if (!this.record.stateTimeline.unitNames[id]) {
        throw new Error(`BattleRecordV3 timeline has no name for unit: ${id}`);
      }
    }
    this.assertKnownUnitRef(this.record.outcome.winner, 'winner');
    this.assertKnownUnitRef(this.record.outcome.loser, 'loser');
    if (this.record.outcome.winner.id === this.record.outcome.loser.id) {
      throw new Error('BattleRecordV3 winner and loser must be distinct');
    }
  }

  private validateSequences(): void {
    let previousTurn = -1;
    let previousOrdinal = 0;
    for (const [index, sequence] of this.record.sequences.entries()) {
      if (!sequence.id || this.sequenceIndex.has(sequence.id)) {
        throw new Error(`BattleRecordV3 duplicate sequence: ${sequence.id}`);
      }
      this.sequenceIndex.set(sequence.id, index);
      if (sequence.turn < previousTurn) {
        throw new Error('BattleRecordV3 sequence turns are not monotonic');
      }
      previousTurn = sequence.turn;
      if (sequence.actor) {
        this.assertKnownUnitRef(sequence.actor, 'sequence actor');
      }
      if (
        ['action_pre', 'action', 'action_after', 'battle_end'].includes(
          sequence.phase,
        ) &&
        !sequence.actor
      ) {
        throw new Error(
          `BattleRecordV3 ${sequence.phase} sequence has no actor`,
        );
      }
      if (
        sequence.phase === 'battle_end' &&
        sequence.actor?.id !== this.record.outcome.winner.id
      ) {
        throw new Error(
          'BattleRecordV3 battle end actor does not match winner',
        );
      }
      if (
        sequence.ability &&
        (!sequence.ability.id || !sequence.ability.name)
      ) {
        throw new Error(
          `BattleRecordV3 sequence ${sequence.id} has invalid ability`,
        );
      }

      for (const fact of sequence.facts) {
        this.validateFact(fact, sequence, index);
        if (fact.trace.ordinal <= previousOrdinal) {
          throw new Error('BattleRecordV3 fact ordinals are not monotonic');
        }
        previousOrdinal = fact.trace.ordinal;
      }
    }
  }

  private validateFact(
    fact: CombatFactV3,
    sequence: CombatSequenceV3,
    sequenceIndex: number,
  ): void {
    if (!fact.trace?.eventId || !fact.trace.sequenceId) {
      throw new Error(`BattleRecordV3 fact ${fact.id} has no trace`);
    }
    if (fact.id !== fact.trace.eventId) {
      throw new Error(
        `BattleRecordV3 fact ${fact.id} does not match its event id`,
      );
    }
    if (this.factIds.has(fact.id)) {
      throw new Error(`BattleRecordV3 duplicate fact id: ${fact.id}`);
    }
    if (this.eventOrdinals.has(fact.trace.eventId)) {
      throw new Error(
        `BattleRecordV3 duplicate event id: ${fact.trace.eventId}`,
      );
    }
    if (!Number.isInteger(fact.trace.ordinal) || fact.trace.ordinal <= 0) {
      throw new Error(`BattleRecordV3 fact ${fact.id} has invalid ordinal`);
    }
    if (this.ordinals.has(fact.trace.ordinal)) {
      throw new Error(
        `BattleRecordV3 duplicate ordinal: ${fact.trace.ordinal}`,
      );
    }
    if (fact.trace.sequenceId !== sequence.id) {
      throw new Error(
        `BattleRecordV3 fact ${fact.id} is linked to another sequence`,
      );
    }
    this.factIds.add(fact.id);
    this.eventOrdinals.set(fact.trace.eventId, fact.trace.ordinal);
    this.ordinals.add(fact.trace.ordinal);

    if (fact.narrative) {
      if (
        !fact.narrative.causeId.trim() ||
        !['cue', 'result'].includes(fact.narrative.role)
      ) {
        throw new Error(
          `BattleRecordV3 fact ${fact.id} has invalid narrative relation`,
        );
      }
      if (
        fact.trace.narrativeCauseId !== undefined &&
        fact.trace.narrativeCauseId !== fact.narrative.causeId
      ) {
        throw new Error(
          `BattleRecordV3 fact ${fact.id} has inconsistent narrative cause`,
        );
      }
    }

    if (!fact.target?.id || !fact.target.name) {
      throw new Error(`BattleRecordV3 fact ${fact.id} has no target`);
    }
    this.assertKnownUnitRef(fact.target, `fact ${fact.id} target`);
    if (!fact.origin?.carrier?.id || !fact.origin.carrier.name) {
      throw new Error(`BattleRecordV3 fact ${fact.id} has no origin`);
    }
    if (fact.origin.kind === 'owned') {
      if (!fact.origin.owner?.id || !fact.origin.owner.name) {
        throw new Error(`BattleRecordV3 fact ${fact.id} has no origin owner`);
      }
      this.assertKnownUnitRef(
        fact.origin.owner,
        `fact ${fact.id} origin owner`,
      );
      if (
        !['ability', 'buff', 'equipment', 'gongfa', 'mechanic'].includes(
          fact.origin.carrier.kind,
        )
      ) {
        throw new Error(
          `BattleRecordV3 fact ${fact.id} has invalid owned carrier`,
        );
      }
    } else if (
      fact.origin.kind !== 'system' ||
      fact.origin.carrier.kind !== 'system'
    ) {
      throw new Error(`BattleRecordV3 fact ${fact.id} has invalid origin`);
    }
    this.validateFactPayload(fact);
    if (fact.type === 'damage') {
      const resolutionId = fact.trace.resolutionId;
      if (!resolutionId) {
        throw new Error('BattleRecordV3 damage fact has no resolutionId');
      }
      if (this.damageResolutions.has(resolutionId)) {
        throw new Error(
          `BattleRecordV3 resolution ${resolutionId} has duplicate damage facts`,
        );
      }
      this.damageResolutions.set(resolutionId, fact.target.id);
    }
    if (fact.type === 'unit_died') {
      if (fact.killer) this.assertKnownUnitRef(fact.killer, 'killer');
      if (this.deaths.has(fact.target.id)) {
        throw new Error(
          `BattleRecordV3 duplicate death for unit: ${fact.target.id}`,
        );
      }
      this.deaths.set(fact.target.id, {
        ordinal: fact.trace.ordinal,
        sequenceIndex,
      });
    }
    if (fact.type === 'death_prevented' || fact.type === 'unit_died') {
      const resolutionId = fact.trace.resolutionId;
      if (!resolutionId) {
        throw new Error(`BattleRecordV3 ${fact.type} fact has no resolutionId`);
      }
      const outcomes = this.resolutionOutcomes.get(resolutionId) ?? new Set();
      outcomes.add(fact.type);
      this.resolutionOutcomes.set(resolutionId, outcomes);
      const existingTarget = this.resolutionOutcomeTargets.get(resolutionId);
      if (existingTarget && existingTarget !== fact.target.id) {
        throw new Error(
          `BattleRecordV3 resolution ${resolutionId} has inconsistent outcome targets`,
        );
      }
      this.resolutionOutcomeTargets.set(resolutionId, fact.target.id);
    }
  }

  private validateFactPayload(fact: CombatFactV3): void {
    switch (fact.type) {
      case 'damage':
        if (!['physical', 'magical', 'true', 'dot'].includes(fact.damageType)) {
          throw new Error(
            `BattleRecordV3 damage fact ${fact.id} has invalid damage type`,
          );
        }
        this.assertNonNegativeFinite(fact.amount, fact, 'amount');
        this.assertNonNegativeFinite(fact.beforeHp, fact, 'beforeHp');
        this.assertNonNegativeFinite(fact.afterHp, fact, 'afterHp');
        this.assertNonNegativeFinite(
          fact.shieldAbsorbed,
          fact,
          'shieldAbsorbed',
        );
        break;
      case 'recovery':
      case 'shield':
        this.assertPositiveFinite(fact.amount, fact, 'amount');
        this.assertNonNegativeFinite(fact.after, fact, 'after');
        break;
      case 'status':
        this.validateStatusFact(fact);
        break;
      case 'defense':
        if (
          ![
            'mana_shield',
            'damage_immune',
            'skill_immune',
            'dodge',
            'resist',
            'interrupt',
          ].includes(fact.defense)
        ) {
          throw new Error(
            `BattleRecordV3 defense fact ${fact.id} has invalid defense`,
          );
        }
        if (fact.amount !== undefined) {
          this.assertNonNegativeFinite(fact.amount, fact, 'amount');
        }
        break;
      case 'resource':
        this.assertNonNegativeFinite(fact.before, fact, 'before');
        this.assertNonNegativeFinite(fact.after, fact, 'after');
        this.assertFinite(fact.applied, fact, 'applied');
        if (fact.after - fact.before !== fact.applied) {
          throw new Error(
            `BattleRecordV3 resource fact ${fact.id} has inconsistent applied value`,
          );
        }
        if (fact.max !== undefined) {
          this.assertNonNegativeFinite(fact.max, fact, 'max');
          if (fact.before > fact.max || fact.after > fact.max) {
            throw new Error(
              `BattleRecordV3 resource fact ${fact.id} exceeds max`,
            );
          }
        }
        break;
      case 'action_state':
        if (
          !isActionStateType(fact.stateType) ||
          !isActionStatePhase(fact.phase) ||
          !fact.name.trim() ||
          !Number.isInteger(fact.remainingActions) ||
          fact.remainingActions < 0
        ) {
          throw new Error(
            `BattleRecordV3 action_state fact ${fact.id} has invalid action state`,
          );
        }
        if (
          fact.stateType === 'queued_action' &&
          (!fact.ability?.id || !fact.ability.name)
        ) {
          throw new Error(
            `BattleRecordV3 queued action fact ${fact.id} has no ability`,
          );
        }
        break;
      case 'mechanic':
        this.validateMechanicFact(fact);
        break;
      case 'death_prevented':
      case 'unit_died':
        break;
      default:
        throw new Error('BattleRecordV3 contains an unknown fact type');
    }
  }

  private validateStatusFact(
    fact: Extract<CombatFactV3, { type: 'status' }>,
  ): void {
    const factId = fact.id;
    if (!fact.statusId.trim() || !fact.statusName.trim()) {
      throw new Error(`BattleRecordV3 status fact ${fact.id} is incomplete`);
    }
    if (!['buff', 'debuff', 'control'].includes(fact.statusType)) {
      throw new Error(
        `BattleRecordV3 status fact ${fact.id} has invalid status type`,
      );
    }
    if (fact.operation === 'apply') {
      if (
        !['added', 'stacked', 'refreshed', 'replaced'].includes(
          fact.transition,
        ) ||
        !Number.isInteger(fact.beforeLayers) ||
        fact.beforeLayers < 0 ||
        !Number.isInteger(fact.afterLayers) ||
        fact.afterLayers < 1 ||
        (fact.duration !== -1 &&
          (!Number.isInteger(fact.duration) || fact.duration < 1))
      ) {
        throw new Error(
          `BattleRecordV3 status fact ${fact.id} has invalid application`,
        );
      }
      if (fact.transition === 'added' && fact.beforeLayers !== 0) {
        throw new Error(
          `BattleRecordV3 status fact ${fact.id} has invalid added transition`,
        );
      }
      if (
        fact.transition === 'stacked' &&
        fact.afterLayers <= fact.beforeLayers
      ) {
        throw new Error(
          `BattleRecordV3 status fact ${fact.id} has invalid stacked transition`,
        );
      }
      if (
        fact.transition === 'refreshed' &&
        fact.afterLayers !== fact.beforeLayers
      ) {
        throw new Error(
          `BattleRecordV3 status fact ${fact.id} has invalid refreshed transition`,
        );
      }
      return;
    }
    if (fact.operation === 'remove') {
      if (
        !['expired', 'dispelled', 'consumed', 'replaced', 'manual'].includes(
          fact.reason,
        ) ||
        !Number.isInteger(fact.beforeLayers) ||
        fact.beforeLayers < 1 ||
        fact.afterLayers !== 0
      ) {
        throw new Error(
          `BattleRecordV3 status fact ${fact.id} has invalid removal reason`,
        );
      }
      return;
    }
    if (fact.operation === 'layers') {
      if (
        !['modified', 'consumed', 'dispelled'].includes(fact.reason) ||
        !Number.isInteger(fact.beforeLayers) ||
        fact.beforeLayers < 1 ||
        !Number.isInteger(fact.afterLayers) ||
        fact.afterLayers < 1 ||
        fact.beforeLayers === fact.afterLayers
      ) {
        throw new Error(
          `BattleRecordV3 status fact ${fact.id} has invalid layer change`,
        );
      }
      return;
    }
    if (fact.operation === 'immune') return;
    throw new Error(
      `BattleRecordV3 status fact ${factId} has invalid operation`,
    );
  }

  private validateMechanicFact(
    fact: Extract<CombatFactV3, { type: 'mechanic' }>,
  ): void {
    if (
      !fact.code.trim() ||
      !fact.payload ||
      typeof fact.payload !== 'object'
    ) {
      throw new Error(`BattleRecordV3 mechanic fact ${fact.id} is incomplete`);
    }
    const payload = fact.payload;
    const isCue = isCombatMechanicCuePayloadV3(payload);
    if (isCue && fact.narrative?.role !== 'cue') {
      throw new Error(
        `BattleRecordV3 mechanic fact ${fact.id} has no cue relation`,
      );
    }
    if (!isCue && fact.narrative?.role === 'cue') {
      throw new Error(
        `BattleRecordV3 mechanic fact ${fact.id} has invalid cue relation`,
      );
    }
    switch (payload.kind) {
      case 'ability_transform':
        this.assertPositiveInteger(payload.triggers, fact, 'triggers');
        if (!payload.modifiers.length) {
          throw new Error(
            `BattleRecordV3 mechanic fact ${fact.id} has no ability modifiers`,
          );
        }
        for (const modifier of payload.modifiers) {
          if (
            ![
              'true_damage',
              'dispel',
              'mp_cost_to_hp',
              'free_mana_cost',
              'cooldown',
              'force_critical',
              'stored_damage',
            ].includes(modifier.kind)
          ) {
            throw new Error(
              `BattleRecordV3 mechanic fact ${fact.id} has unknown ability modifier`,
            );
          }
          if (modifier.kind === 'cooldown') {
            if (!Number.isInteger(modifier.rounds) || modifier.rounds === 0) {
              throw new Error(
                `BattleRecordV3 mechanic fact ${fact.id} has invalid cooldown modifier`,
              );
            }
          }
        }
        break;
      case 'ability_lock':
        this.assertText(payload.abilityName, fact, 'abilityName');
        this.assertPositiveInteger(payload.rounds, fact, 'rounds');
        break;
      case 'tag_trigger':
      case 'named_trigger':
        this.assertText(payload.label, fact, 'label');
        break;
      case 'hp_sacrifice':
      case 'mana_burn':
        this.assertPositiveFinite(payload.amount, fact, 'amount');
        break;
      case 'memory_record':
        if (
          ![
            'damage_taken',
            'damage_dealt',
            'heal',
            'shield',
            'critical_taken',
            'shield_break',
            'shield_absorbed',
          ].includes(payload.source)
        ) {
          throw new Error(
            `BattleRecordV3 mechanic fact ${fact.id} has invalid memory source`,
          );
        }
        this.assertPositiveFinite(
          payload.sampledAmount,
          fact,
          'sampledAmount',
        );
        this.assertNonNegativeFinite(payload.before, fact, 'before');
        this.assertNonNegativeFinite(payload.after, fact, 'after');
        break;
      case 'damage_defer':
        this.assertPositiveFinite(payload.amount, fact, 'amount');
        this.assertPositiveInteger(payload.turns, fact, 'turns');
        break;
      case 'cooldown_change':
        this.assertText(payload.abilityName, fact, 'abilityName');
        if (!Number.isInteger(payload.rounds) || payload.rounds === 0) {
          throw new Error(
            `BattleRecordV3 mechanic fact ${fact.id} has invalid cooldown change`,
          );
        }
        break;
      case 'memory_release':
        this.assertPositiveFinite(payload.amount, fact, 'amount');
        if (
          ![
            'damage',
            'heal',
            'shield',
            'reflect',
            'counter',
            'follow_up',
          ].includes(payload.releaseAs)
        ) {
          throw new Error(
            `BattleRecordV3 mechanic fact ${fact.id} has invalid release type`,
          );
        }
        break;
      case 'control_skip':
        this.assertText(payload.controlName, fact, 'controlName');
        break;
      case 'status_transition':
        this.assertText(payload.label, fact, 'label');
        if (
          !['apply', 'refresh', 'replace', 'consume'].includes(
            payload.operation,
          )
        ) {
          throw new Error(
            `BattleRecordV3 mechanic fact ${fact.id} has invalid transition`,
          );
        }
        if (
          payload.operation === 'replace' &&
          payload.previousLabel !== undefined
        ) {
          this.assertText(payload.previousLabel, fact, 'previousLabel');
        }
        break;
      default:
        throw new Error(
          `BattleRecordV3 mechanic fact ${fact.id} has unknown payload`,
        );
    }
  }

  private assertText(value: string, fact: CombatFactV3, field: string): void {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `BattleRecordV3 ${fact.type} fact ${fact.id} has invalid ${field}`,
      );
    }
  }

  private assertPositiveInteger(
    value: number,
    fact: CombatFactV3,
    field: string,
  ): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `BattleRecordV3 ${fact.type} fact ${fact.id} has invalid ${field}`,
      );
    }
  }

  private assertFinite(value: number, fact: CombatFactV3, field: string): void {
    if (!Number.isFinite(value)) {
      throw new Error(
        `BattleRecordV3 ${fact.type} fact ${fact.id} has invalid ${field}`,
      );
    }
  }

  private assertNonNegativeFinite(
    value: number,
    fact: CombatFactV3,
    field: string,
  ): void {
    this.assertFinite(value, fact, field);
    if (value < 0) {
      throw new Error(
        `BattleRecordV3 ${fact.type} fact ${fact.id} has negative ${field}`,
      );
    }
  }

  private assertPositiveFinite(
    value: number,
    fact: CombatFactV3,
    field: string,
  ): void {
    this.assertFinite(value, fact, field);
    if (value <= 0) {
      throw new Error(
        `BattleRecordV3 ${fact.type} fact ${fact.id} has non-positive ${field}`,
      );
    }
  }

  private validateParentOrder(): void {
    for (const sequence of this.record.sequences) {
      for (const fact of sequence.facts) {
        const parentId = fact.trace.parentEventId;
        if (!parentId) continue;
        const parentOrdinal = this.eventOrdinals.get(parentId);
        if (
          parentOrdinal !== undefined &&
          parentOrdinal >= fact.trace.ordinal
        ) {
          throw new Error(
            `BattleRecordV3 ${fact.type} fact ${fact.id} (ordinal ${fact.trace.ordinal}) ` +
              `precedes visible parent ${parentId} (ordinal ${parentOrdinal})`,
          );
        }
      }
    }
  }

  private validateResolutionOutcomes(): void {
    for (const [resolutionId, outcomes] of this.resolutionOutcomes) {
      if (outcomes.size > 1) {
        throw new Error(
          `BattleRecordV3 resolution ${resolutionId} contains both death prevention and death`,
        );
      }
      const damageTarget = this.damageResolutions.get(resolutionId);
      if (!damageTarget) {
        throw new Error(
          `BattleRecordV3 resolution ${resolutionId} has no matching damage`,
        );
      }
      if (damageTarget !== this.resolutionOutcomeTargets.get(resolutionId)) {
        throw new Error(
          `BattleRecordV3 resolution ${resolutionId} outcome target does not match damage target`,
        );
      }
    }
  }

  private validateActionsAfterDeath(): void {
    for (const [index, sequence] of this.record.sequences.entries()) {
      for (const fact of sequence.facts) {
        if (fact.origin.kind !== 'owned') continue;
        const ownerDeath = this.deaths.get(fact.origin.owner.id);
        if (ownerDeath && ownerDeath.ordinal < fact.trace.ordinal) {
          throw new Error(
            `BattleRecordV3 dead unit ${fact.origin.owner.id} commits owned fact ${fact.id}`,
          );
        }
      }
      if (
        !sequence.actor ||
        (sequence.phase !== 'action_pre' && sequence.phase !== 'action')
      ) {
        continue;
      }
      const death = this.deaths.get(sequence.actor.id);
      if (death && death.sequenceIndex < index) {
        throw new Error(
          `BattleRecordV3 dead unit ${sequence.actor.id} enters action sequence`,
        );
      }
    }
  }

  private validateTimeline(): void {
    let previousFrameId = 0;
    let previousTurn = -1;
    let previousSequenceIndex = -1;
    const frameIds = new Set<number>();
    for (const frame of this.record.stateTimeline.frames) {
      if (
        !Number.isInteger(frame.frameId) ||
        frame.frameId <= previousFrameId ||
        frameIds.has(frame.frameId)
      ) {
        throw new Error(
          'BattleRecordV3 frame ids are not unique and monotonic',
        );
      }
      frameIds.add(frame.frameId);
      previousFrameId = frame.frameId;
      if (frame.turn < previousTurn) {
        throw new Error('BattleRecordV3 frame turns are not monotonic');
      }
      previousTurn = frame.turn;
      const linkedSequenceIndex = this.sequenceIndex.get(
        frame.sourceSequenceId,
      );
      if (linkedSequenceIndex === undefined) {
        throw new Error(
          `BattleRecordV3 frame ${frame.frameId} references unknown sequence`,
        );
      }
      if (linkedSequenceIndex < previousSequenceIndex) {
        throw new Error(
          'BattleRecordV3 frame sequence links are not monotonic',
        );
      }
      previousSequenceIndex = linkedSequenceIndex;
      if (frame.actorId) this.assertKnownUnit(frame.actorId, 'frame actor');

      const frameUnitIds = Object.keys(frame.units);
      if (frameUnitIds.length !== this.knownUnitIds.size) {
        throw new Error(
          `BattleRecordV3 frame ${frame.frameId} has incomplete units`,
        );
      }
      for (const id of this.knownUnitIds) {
        const snapshot = frame.units[id];
        if (!snapshot || snapshot.id !== id) {
          throw new Error(
            `BattleRecordV3 frame ${frame.frameId} has incomplete units`,
          );
        }
        if (snapshot.name !== this.record.stateTimeline.unitNames[id]) {
          throw new Error(
            `BattleRecordV3 frame ${frame.frameId} has inconsistent unit name: ${id}`,
          );
        }
      }
      for (const id of frameUnitIds) this.assertKnownUnit(id, 'frame unit');
    }
  }

  private validateOutcome(): void {
    const finalFrame =
      this.record.stateTimeline.frames[
        this.record.stateTimeline.frames.length - 1
      ];
    if (finalFrame.phase !== 'battle_end') {
      throw new Error('BattleRecordV3 final frame is not battle_end');
    }
    if (finalFrame.turn !== this.record.outcome.turns) {
      throw new Error('BattleRecordV3 outcome turns do not match final frame');
    }
    const winnerId = this.record.outcome.winner.id;
    const loserId = this.record.outcome.loser.id;
    const winner = finalFrame.units[winnerId];
    const loser = finalFrame.units[loserId];
    if (!winner?.alive) {
      throw new Error('BattleRecordV3 winner is not alive in final frame');
    }
    if (
      !snapshotsEqual(winner, this.record.finalSnapshots.winner) ||
      !snapshotsEqual(loser, this.record.finalSnapshots.loser)
    ) {
      throw new Error(
        'BattleRecordV3 final snapshots do not match final frame',
      );
    }
    const loserDeath = this.deaths.get(loserId);
    if (!loser.alive && !loserDeath) {
      throw new Error('BattleRecordV3 dead loser has no matching death fact');
    }
    if (loser.alive && loserDeath) {
      throw new Error('BattleRecordV3 living loser has a death fact');
    }
    for (const deadUnitId of this.deaths.keys()) {
      if (deadUnitId !== loserId) {
        throw new Error('BattleRecordV3 death facts do not match the loser');
      }
    }
  }

  private assertKnownUnit(id: string, label: string): void {
    if (!this.knownUnitIds.has(id)) {
      throw new Error(`BattleRecordV3 ${label} references unknown unit: ${id}`);
    }
  }

  private assertKnownUnitRef(ref: UnitRefV3, label: string): void {
    if (!ref?.id || !ref.name) {
      throw new Error(`BattleRecordV3 ${label} is incomplete`);
    }
    this.assertKnownUnit(ref.id, label);
    if (this.record.stateTimeline.unitNames[ref.id] !== ref.name) {
      throw new Error(`BattleRecordV3 ${label} has inconsistent unit name`);
    }
  }
}

function snapshotsEqual(
  left: UnitStateSnapshot | undefined,
  right: UnitStateSnapshot | undefined,
): boolean {
  if (!left || !right) return false;
  return structuresEqual(left, right);
}

function structuresEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structuresEqual(value, right[index]))
    );
  }
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        structuresEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export function validateBattleRecordV3(record: BattleRecordV3): void {
  new BattleRecordValidatorV3(record).validate();
}

import type { BattleRoster } from '../core/BattleRoster';
import type { TeamVictoryResult } from '../systems/TeamVictorySystem';
import type { BattleRecordV3 } from '../v3/types';
import { validateBattleRecordV3 } from '../v3/BattleRecordV3';
import type { BattleOutcomeV4, BattleRecordV4 } from './types';

export function createBattleRecordV4(input: {
  roster: BattleRoster;
  outcome: TeamVictoryResult;
  rounds: number;
  sequences: BattleRecordV4['sequences'];
  stateTimeline: BattleRecordV4['stateTimeline'];
}): BattleRecordV4 {
  const teams = [...input.roster.teams.values()].map((team) => ({
    id: team.id,
    units: team.unitIds.map((unitId) => {
      const unit = input.roster.getUnit(unitId);
      return { id: unit.id, name: unit.name, slot: unit.slot };
    }),
  }));
  if (teams.length !== 2) throw new Error('BattleRecordV4 requires two teams');

  const finalFrame =
    input.stateTimeline.frames[input.stateTimeline.frames.length - 1];
  if (!finalFrame) throw new Error('BattleRecordV4 requires a final frame');
  const outcome: BattleOutcomeV4 = input.outcome.draw
    ? { result: 'draw', rounds: input.rounds }
    : {
        result: 'victory',
        winnerTeamId: input.outcome.winnerTeamId!,
        loserTeamId: input.outcome.loserTeamId!,
        rounds: input.rounds,
        reason: input.outcome.reachedMaxRounds ? 'round_limit' : 'elimination',
      };

  const record: BattleRecordV4 = {
    version: 'battle_record_v4',
    teams: teams as BattleRecordV4['teams'],
    outcome,
    sequences: input.sequences,
    stateTimeline: input.stateTimeline,
    finalSnapshots: { ...finalFrame.units },
  };
  validateBattleRecordV4(record);
  return record;
}

export function battleRecordV4FromV3(record: BattleRecordV3): BattleRecordV4 {
  validateBattleRecordV3(record);
  const finalFrame =
    record.stateTimeline.frames[record.stateTimeline.frames.length - 1];
  return {
    version: 'battle_record_v4',
    teams: [
      {
        id: 'player',
        units: [{ ...record.participants.player, slot: 0 }],
      },
      {
        id: 'opponent',
        units: [{ ...record.participants.opponent, slot: 0 }],
      },
    ],
    outcome: {
      result: 'victory',
      winnerTeamId:
        record.outcome.winner.id === record.participants.player.id
          ? 'player'
          : 'opponent',
      loserTeamId:
        record.outcome.loser.id === record.participants.player.id
          ? 'player'
          : 'opponent',
      rounds: record.outcome.turns,
      reason: record.finalSnapshots.loser.alive
        ? 'round_limit'
        : 'elimination',
    },
    sequences: record.sequences,
    stateTimeline: record.stateTimeline,
    finalSnapshots: { ...finalFrame.units },
  };
}

export function validateBattleRecordV4(record: BattleRecordV4): void {
  if (record.version !== 'battle_record_v4') {
    throw new Error('BattleRecordV4 has an invalid version');
  }
  if (record.teams.length !== 2) {
    throw new Error('BattleRecordV4 requires exactly two teams');
  }

  const teamIds = new Set<string>();
  const unitIds = new Set<string>();
  for (const team of record.teams) {
    if (!team.id || teamIds.has(team.id)) {
      throw new Error(`BattleRecordV4 duplicate or empty team id: ${team.id}`);
    }
    teamIds.add(team.id);
    if (team.units.length < 1 || team.units.length > 4) {
      throw new Error(`BattleRecordV4 team ${team.id} has invalid size`);
    }
    const slots = new Set<number>();
    for (const unit of team.units) {
      if (!unit.id || !unit.name || unitIds.has(unit.id)) {
        throw new Error(`BattleRecordV4 duplicate or incomplete unit: ${unit.id}`);
      }
      if (slots.has(unit.slot)) {
        throw new Error(`BattleRecordV4 duplicate slot in team ${team.id}`);
      }
      slots.add(unit.slot);
      unitIds.add(unit.id);
    }
  }

  assertSameIds(record.stateTimeline.unitIds, unitIds, 'timeline');
  if (record.stateTimeline.frames.length === 0) {
    throw new Error('BattleRecordV4 has no state timeline frames');
  }
  for (const frame of record.stateTimeline.frames) {
    assertSameIds(Object.keys(frame.units), unitIds, `frame ${frame.frameId}`);
  }
  assertSameIds(Object.keys(record.finalSnapshots), unitIds, 'final snapshots');

  for (const sequence of record.sequences) {
    if (sequence.actor && !unitIds.has(sequence.actor.id)) {
      throw new Error(`BattleRecordV4 sequence references unknown actor: ${sequence.actor.id}`);
    }
    for (const fact of sequence.facts) {
      if (!unitIds.has(fact.target.id)) {
        throw new Error(`BattleRecordV4 fact references unknown target: ${fact.target.id}`);
      }
      if (fact.origin.kind === 'owned' && !unitIds.has(fact.origin.owner.id)) {
        throw new Error(`BattleRecordV4 fact references unknown owner: ${fact.origin.owner.id}`);
      }
    }
  }

  if (record.outcome.result === 'victory') {
    const outcome = record.outcome;
    if (
      !teamIds.has(record.outcome.winnerTeamId) ||
      !teamIds.has(record.outcome.loserTeamId) ||
      record.outcome.winnerTeamId === record.outcome.loserTeamId
    ) {
      throw new Error('BattleRecordV4 has an invalid team outcome');
    }
    const winner = record.teams.find(
      (team) => team.id === outcome.winnerTeamId,
    )!;
    const loser = record.teams.find(
      (team) => team.id === outcome.loserTeamId,
    )!;
    if (
      !winner.units.some(
        (unit) => record.finalSnapshots[unit.id].hp.current > 0,
      )
    ) {
      throw new Error('BattleRecordV4 winner team has no living unit');
    }
    if (
      outcome.reason === 'elimination' &&
      loser.units.some((unit) => record.finalSnapshots[unit.id].hp.current > 0)
    ) {
      throw new Error('BattleRecordV4 loser team is not eliminated');
    }
  }
}

function assertSameIds(
  actual: readonly string[],
  expected: ReadonlySet<string>,
  label: string,
): void {
  if (
    actual.length !== expected.size ||
    actual.some((id) => !expected.has(id))
  ) {
    throw new Error(`BattleRecordV4 ${label} has incomplete units`);
  }
}

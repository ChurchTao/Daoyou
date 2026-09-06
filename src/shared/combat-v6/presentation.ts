import { diffUnits } from '@shared/combat-v6/playback';
import type {
  CombatV6TrainingSessionViewV1,
  CombatV6TrainingUnitViewV1,
} from '@shared/contracts/combatV6';
import type {
  BattleState,
  SkillDef,
  StatusDef,
} from '@shared/engine/combat-v6/core';
import { effectiveAttrs } from '@shared/engine/combat-v6/core/units';
import { combatV6SkillDetails } from './skill-details';

export function combatV6Display(skills: SkillDef[], statuses: StatusDef[]) {
  return {
    skills: Object.fromEntries(skills.map((s) => [s.id, s.name])),
    skillDetails: combatV6SkillDetails(skills, statuses),
    statuses: Object.fromEntries(statuses.map((s) => [s.id, s.name])),
  };
}

/** Whitelist display facts; the server never serializes commands, RNG or private build facts. */
export function combatV6Units(
  state: BattleState,
  statuses: StatusDef[],
): CombatV6TrainingUnitViewV1[] {
  const names = new Map(statuses.map((s) => [s.id, s.name]));
  return state.units
    .filter((u) => !u.flags.benched)
    .map((u) => {
      const attrs = effectiveAttrs(u);
      return {
        id: u.id,
        name: u.name,
        side: u.side,
        slot: u.slot,
        kind: u.kind,
        ownerId: u.ownerId,
        hp: u.attrs.hp,
        maxHp: u.attrs.maxHp,
        mp: u.attrs.mp,
        maxMp: u.attrs.maxMp,
        attributes: {
          physicalAtk: attrs.physicalAtk,
          physicalDef: attrs.physicalDef,
          magicAtk: attrs.magicAtk,
          magicDef: attrs.magicDef,
          speed: attrs.speed,
          healPower: attrs.healPower,
        },
        wound: u.wound,
        downed: u.flags.downed,
        dead: u.flags.dead,
        escaped: u.flags.escaped,
        statuses: u.statuses.map((s) => ({
          id: s.id,
          name: names.get(s.id) ?? '未知状态',
          remainingRounds: s.remainingRounds,
          stacks: s.stacks,
        })),
        barriers: u.barriers.map((b) => ({
          id: b.id,
          name: b.name,
          current: b.current,
          remainingRounds: b.remainingRounds,
        })),
        resources: u.resources.map((r) => ({ ...r })),
      };
    });
}

export function combatV6Playback(
  fromEventSeq: number,
  statuses: StatusDef[],
  initial: BattleState,
) {
  let previous = combatV6Units(initial, statuses);
  const playback: NonNullable<CombatV6TrainingSessionViewV1['playback']> = {
    format: 'delta-v1',
    fromEventSeq,
    frames: [],
  };
  return {
    playback,
    capture(state: BattleState, afterEventSeq: number) {
      if (
        afterEventSeq <=
        (playback.frames[playback.frames.length - 1]?.afterEventSeq ??
          fromEventSeq)
      )
        return;
      const next = combatV6Units(state, statuses);
      playback.frames.push(
        diffUnits(previous, next, afterEventSeq, state.round),
      );
      previous = next;
    },
  };
}

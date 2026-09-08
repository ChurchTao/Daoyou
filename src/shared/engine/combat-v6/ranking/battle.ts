import {
  replayRound,
  startReplayTimeline,
} from '../../../combat-v6/replay-timeline';
import { BEAST_SKILLS, projectBeastRoster } from '../beasts';
import {
  createBattle,
  isStanding,
  type CreateBattleInput,
  type SkillDef,
  type StatusDef,
} from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import { projectCultivatorMultiSectV5ToCombatV6 } from '../projection';
import { daoyouRulesetV6 } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

export type RankingBattleInput = Omit<CreateBattleInput, 'ruleset'> & {
  seed: number;
};

export function compileRankingBattle(
  players: [CombatV6TrainingPlayerInput, CombatV6TrainingPlayerInput],
  seed: number,
): RankingBattleInput {
  if (players[0].cultivator.id === players[1].cultivator.id)
    throw new Error('不能挑战自己');
  const units: CreateBattleInput['units'] = [];
  const skills = new Map<string, SkillDef>(BEAST_SKILLS.map((s) => [s.id, s]));
  const statuses = new Map<string, StatusDef>();
  function merge<T extends { id: string }>(map: Map<string, T>, values: T[]) {
    for (const value of values) {
      if (
        map.has(value.id) &&
        JSON.stringify(map.get(value.id)) !== JSON.stringify(value)
      )
        throw new Error(`战斗定义冲突：${value.id}`);
      map.set(value.id, value);
    }
  }
  players.forEach((player, index) => {
    const side = index as 0 | 1;
    const p = projectCultivatorMultiSectV5ToCombatV6({
      ...player,
      side,
      slot: 0,
      resourcePolicy: 'full',
    });
    if (!p.ok) throw new Error('天骄榜构筑无法编译');
    units.push(
      p.unit,
      ...projectBeastRoster(
        player.beasts,
        p.unit.id!,
        side,
        0,
        p.unit.level,
      ).filter((b) => !b.benched),
    );
    merge(skills, p.skills);
    merge(statuses, p.statusDefs);
  });
  return structuredClone({
    seed,
    units,
    skills: [...skills.values()],
    statusDefs: [...statuses.values()],
    versions: {
      ...COMBAT_V6_PHASE_6D_VERSIONS,
      rulesetVersion: 'daoyou_rules_v8',
      contentVersion: 'combat-v6-ranking-v1',
    },
  });
}

/** Explicitly use ruleset AI for both sides, without online timeout command filling. */
export function simulateRankingBattle(input: RankingBattleInput) {
  const battle = createBattle({
    ...structuredClone(input),
    ruleset: daoyouRulesetV6,
  });
  const statuses = input.statusDefs ?? [];
  const timeline = startReplayTimeline(
    battle.snapshot(),
    statuses,
    battle.log().length - 1,
  );
  const rounds = [];
  while (!battle.finished) {
    const state = battle.snapshot();
    for (const unit of state.units.filter(isStanding)) {
      battle.submit(
        unit.id,
        daoyouRulesetV6.decideCommand({
          unit,
          state,
          enemies: state.units.filter(
            (u) => u.side !== unit.side && isStanding(u),
          ),
          allies: state.units.filter(
            (u) => u.side === unit.side && u.id !== unit.id && isStanding(u),
          ),
        }),
      );
    }
    rounds.push({
      round: state.round,
      commands: battle
        .snapshot()
        .units.flatMap((u) =>
          u.command ? [{ unitId: u.id, command: u.command }] : [],
        ),
    });
    const recording = replayRound(
      timeline,
      battle.snapshot(),
      statuses,
      battle.log().length - 1,
    );
    battle.lockAndResolve(recording.capture);
    recording.finish(battle.snapshot(), battle.log().length - 1);
  }
  return {
    seed: input.seed,
    initialUnits: input.units,
    skills: input.skills ?? [],
    statusDefs: statuses,
    rounds,
    events: [...battle.log()],
    timeline,
    finalState: battle.snapshot(),
  };
}

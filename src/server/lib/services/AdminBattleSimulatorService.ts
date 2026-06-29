import { sampleActiveCultivatorIds } from '@server/lib/repositories/cultivatorRepository';
import {
  getCultivatorByIdUnsafe,
  type CultivatorWithOwner,
} from '@server/lib/services/cultivatorService';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import type {
  AdminBattleDuelRequest,
  AdminBattleDuelResult,
  AdminBattleMonteCarloBreakdown,
  AdminBattleMonteCarloRequest,
  AdminBattleMonteCarloResult,
  AdminBattleMonteCarloSample,
  AdminBattleParticipantSummary,
  AdminBattleTemplateFilters,
} from '@shared/contracts/adminBattleSimulator';
import { EnemyGenerator } from '@shared/engine/enemyGenerator';
import type { BattleRecord } from '@shared/types/battle';
import {
  ENEMY_RACE_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';

const SAMPLE_LOG_LINE_LIMIT = 80;

export class AdminBattleSimulatorError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AdminBattleSimulatorError';
  }
}

type SimulateBattle = typeof simulateBattleV5;
type LoadCultivator = typeof getCultivatorByIdUnsafe;
type SampleCultivatorIds = typeof sampleActiveCultivatorIds;

interface AdminBattleSimulatorDeps {
  generator?: EnemyGenerator;
  simulateBattle?: SimulateBattle;
  loadCultivator?: LoadCultivator;
  sampleCultivatorIds?: SampleCultivatorIds;
}

interface Combatant {
  summary: AdminBattleParticipantSummary;
  cultivator: Cultivator;
}

interface SimulationRun {
  index: number;
  a: Combatant;
  b: Combatant;
  record: BattleRecord;
  winnerSide: 'A' | 'B';
}

function choice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
  ) / 100;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? 0;
}

function resolveDifficultyBand(
  difficulty: number,
): NonNullable<AdminBattleParticipantSummary['template']>['difficultyBand'] {
  if (difficulty >= 85) return 'legendary';
  if (difficulty >= 60) return 'advanced';
  if (difficulty >= 25) return 'variant';
  return 'core';
}

function buildParticipantSummary(args: {
  side: 'A' | 'B';
  cultivator: Cultivator;
  source: AdminBattleParticipantSummary['source'];
  template?: NonNullable<AdminBattleParticipantSummary['template']>;
}): AdminBattleParticipantSummary {
  return {
    side: args.side,
    source: args.source,
    cultivatorId: args.cultivator.id ?? `${args.source}:${args.cultivator.name}`,
    name: args.cultivator.name,
    title: args.cultivator.title ?? null,
    realm: args.cultivator.realm,
    realmStage: args.cultivator.realm_stage,
    race: args.cultivator.race,
    ...(args.template ? { template: args.template } : {}),
  };
}

function resolveSnapshot(
  record: BattleRecord,
  side: 'A' | 'B',
) {
  const id = side === 'A' ? record.player : record.opponent;
  const finalFrame =
    record.stateTimeline.frames[record.stateTimeline.frames.length - 1];
  const snapshot = finalFrame?.units[id];
  if (!snapshot) {
    throw new AdminBattleSimulatorError('战斗终态缺少单位快照', 500);
  }
  return snapshot;
}

function toDuelResult(run: SimulationRun): AdminBattleDuelResult {
  const loserSide = run.winnerSide === 'A' ? 'B' : 'A';
  return {
    participants: {
      a: run.a.summary,
      b: run.b.summary,
    },
    winnerSide: run.winnerSide,
    loserSide,
    turns: run.record.turns,
    finalState: {
      a: {
        participant: run.a.summary,
        snapshot: resolveSnapshot(run.record, 'A'),
      },
      b: {
        participant: run.b.summary,
        snapshot: resolveSnapshot(run.record, 'B'),
      },
    },
    logs: run.record.logs,
    logSpans: run.record.logSpans,
    stateTimeline: run.record.stateTimeline,
  };
}

function toMonteCarloSample(run: SimulationRun): AdminBattleMonteCarloSample {
  const aSnapshot = resolveSnapshot(run.record, 'A');
  const bSnapshot = resolveSnapshot(run.record, 'B');
  return {
    index: run.index,
    participants: {
      a: run.a.summary,
      b: run.b.summary,
    },
    winnerSide: run.winnerSide,
    turns: run.record.turns,
    finalHp: {
      a: {
        current: aSnapshot.hp.current,
        max: aSnapshot.hp.max,
      },
      b: {
        current: bSnapshot.hp.current,
        max: bSnapshot.hp.max,
      },
    },
    logs: run.record.logs.slice(0, SAMPLE_LOG_LINE_LIMIT),
  };
}

function addBreakdownCandidate(
  map: Map<string, SimulationRun[]>,
  dimension: string,
  key: string | number | undefined,
  run: SimulationRun,
) {
  if (key == null || key === '') return;
  const id = `${dimension}:${key}`;
  map.set(id, [...(map.get(id) ?? []), run]);
}

function buildBreakdowns(runs: SimulationRun[]): AdminBattleMonteCarloBreakdown[] {
  const grouped = new Map<string, SimulationRun[]>();

  for (const run of runs) {
    addBreakdownCandidate(grouped, 'A境界', run.a.summary.realm, run);
    addBreakdownCandidate(grouped, 'B境界', run.b.summary.realm, run);
    addBreakdownCandidate(grouped, 'A阶段', run.a.summary.realmStage, run);
    addBreakdownCandidate(grouped, 'B阶段', run.b.summary.realmStage, run);
    addBreakdownCandidate(grouped, 'A种族', run.a.summary.race, run);
    addBreakdownCandidate(grouped, 'B种族', run.b.summary.race, run);
    addBreakdownCandidate(
      grouped,
      'A难度段',
      run.a.summary.template?.difficultyBand,
      run,
    );
    addBreakdownCandidate(
      grouped,
      'B难度段',
      run.b.summary.template?.difficultyBand,
      run,
    );
  }

  return Array.from(grouped.entries())
    .map(([id, group]) => {
      const separator = id.indexOf(':');
      const dimension = id.slice(0, separator);
      const key = id.slice(separator + 1);
      const aWins = group.filter((run) => run.winnerSide === 'A').length;
      const bWins = group.length - aWins;
      return {
        dimension,
        key,
        sampleCount: group.length,
        aWins,
        bWins,
        aWinRate: roundRate(aWins / group.length),
        averageTurns: average(group.map((run) => run.record.turns)),
      };
    })
    .sort((left, right) => right.sampleCount - left.sampleCount)
    .slice(0, 40);
}

export class AdminBattleSimulatorService {
  private readonly generator: EnemyGenerator;
  private readonly simulateBattle: SimulateBattle;
  private readonly loadCultivator: LoadCultivator;
  private readonly sampleIds: SampleCultivatorIds;

  constructor(deps: AdminBattleSimulatorDeps = {}) {
    this.generator = deps.generator ?? new EnemyGenerator();
    this.simulateBattle = deps.simulateBattle ?? simulateBattleV5;
    this.loadCultivator = deps.loadCultivator ?? getCultivatorByIdUnsafe;
    this.sampleIds = deps.sampleCultivatorIds ?? sampleActiveCultivatorIds;
  }

  async duel(request: AdminBattleDuelRequest): Promise<AdminBattleDuelResult> {
    const [player, opponent] = await Promise.all([
      this.loadActiveCultivator(request.playerCultivatorId),
      this.loadActiveCultivator(request.opponentCultivatorId),
    ]);

    const run = this.runSimulation(1, {
      a: this.toCultivatorCombatant('A', player.cultivator),
      b: this.toCultivatorCombatant('B', opponent.cultivator),
    });
    return toDuelResult(run);
  }

  async monteCarlo(
    request: AdminBattleMonteCarloRequest,
  ): Promise<AdminBattleMonteCarloResult> {
    const runs: SimulationRun[] = [];
    const anchor = request.anchorCultivatorId
      ? await this.loadActiveCultivator(request.anchorCultivatorId)
      : null;
    const livePool = await this.loadLivePool(request, anchor?.cultivator.id);

    for (let index = 1; index <= request.sampleCount; index += 1) {
      const combatants = this.resolveMonteCarloCombatants({
        index,
        request,
        anchor: anchor?.cultivator ?? null,
        livePool,
      });
      runs.push(this.runSimulation(index, combatants));
    }

    const aWins = runs.filter((run) => run.winnerSide === 'A').length;
    const bWins = runs.length - aWins;
    const turns = runs.map((run) => run.record.turns);

    return {
      scenario: request.scenario,
      sampleCount: runs.length,
      aWins,
      bWins,
      aWinRate: roundRate(aWins / runs.length),
      bWinRate: roundRate(bWins / runs.length),
      turnStats: {
        average: average(turns),
        p50: percentile(turns, 0.5),
        p95: percentile(turns, 0.95),
        min: Math.min(...turns),
        max: Math.max(...turns),
      },
      breakdowns: buildBreakdowns(runs),
      samples: runs
        .filter((run) => run.winnerSide === 'B')
        .concat(runs.filter((run) => run.winnerSide !== 'B'))
        .slice(0, request.sampleLogLimit)
        .map(toMonteCarloSample),
    };
  }

  private async loadActiveCultivator(
    cultivatorId: string,
  ): Promise<CultivatorWithOwner> {
    const record = await this.loadCultivator(cultivatorId);
    if (!record) {
      throw new AdminBattleSimulatorError('未找到 active 角色', 404);
    }
    return record;
  }

  private async loadLivePool(
    request: AdminBattleMonteCarloRequest,
    anchorId?: string,
  ): Promise<Cultivator[]> {
    const usesLive =
      request.scenario === 'fixed_vs_live_sample' ||
      request.scenario === 'live_sample_vs_live_sample';
    if (!usesLive) return [];

    const needed =
      request.scenario === 'live_sample_vs_live_sample' && !anchorId
        ? Math.min(100, Math.max(2, request.sampleCount * 2))
        : request.sampleCount;
    const ids = await this.sampleIds({
      limit: needed,
      realms: request.liveSampleFilters?.realms,
      realmStages: request.liveSampleFilters?.realmStages,
      excludeIds: anchorId ? [anchorId] : undefined,
    });
    if (ids.length < (request.scenario === 'live_sample_vs_live_sample' && !anchorId ? 2 : 1)) {
      throw new AdminBattleSimulatorError('可用线上 active 角色样本不足', 400);
    }

    const loaded: Cultivator[] = [];
    for (const id of ids) {
      const record = await this.loadActiveCultivator(id);
      loaded.push(record.cultivator);
    }
    return loaded;
  }

  private resolveMonteCarloCombatants(args: {
    index: number;
    request: AdminBattleMonteCarloRequest;
    anchor: Cultivator | null;
    livePool: Cultivator[];
  }): { a: Combatant; b: Combatant } {
    const { request, anchor } = args;
    if (request.scenario === 'fixed_vs_template') {
      if (!anchor) throw new AdminBattleSimulatorError('缺少固定角色', 400);
      return {
        a: this.toCultivatorCombatant('A', anchor),
        b: this.createTemplateCombatant('B', request.templateFilters, args.index),
      };
    }

    if (request.scenario === 'template_vs_template') {
      return {
        a: this.createTemplateCombatant('A', request.templateFilters, args.index),
        b: this.createTemplateCombatant('B', request.templateFilters, args.index),
      };
    }

    if (request.scenario === 'fixed_vs_live_sample') {
      if (!anchor) throw new AdminBattleSimulatorError('缺少固定角色', 400);
      return {
        a: this.toCultivatorCombatant('A', anchor),
        b: this.toCultivatorCombatant('B', choice(args.livePool)),
      };
    }

    if (anchor) {
      return {
        a: this.toCultivatorCombatant('A', anchor),
        b: this.toCultivatorCombatant('B', choice(args.livePool)),
      };
    }

    const a = choice(args.livePool);
    const candidatePool = args.livePool.filter((entry) => entry.id !== a.id);
    return {
      a: this.toCultivatorCombatant('A', a),
      b: this.toCultivatorCombatant('B', choice(candidatePool)),
    };
  }

  private runSimulation(
    index: number,
    combatants: { a: Combatant; b: Combatant },
  ): SimulationRun {
    const record = this.simulateBattle(
      combatants.a.cultivator,
      combatants.b.cultivator,
    );
    const winnerSide = record.winner.id === combatants.a.cultivator.id ? 'A' : 'B';
    return {
      index,
      a: combatants.a,
      b: combatants.b,
      record,
      winnerSide,
    };
  }

  private toCultivatorCombatant(
    side: 'A' | 'B',
    cultivator: Cultivator,
  ): Combatant {
    return {
      cultivator,
      summary: buildParticipantSummary({
        side,
        cultivator,
        source: 'cultivator',
      }),
    };
  }

  private createTemplateCombatant(
    side: 'A' | 'B',
    filters: AdminBattleTemplateFilters | undefined,
    index: number,
  ): Combatant {
    const realms = filters?.realms ?? REALM_VALUES;
    const realmStages = filters?.realmStages ?? REALM_STAGE_VALUES;
    const races = filters?.races ?? ENEMY_RACE_VALUES;
    const difficultyMin = filters?.difficultyMin ?? 0;
    const difficultyMax = filters?.difficultyMax ?? 100;
    const difficulty = randomInt(difficultyMin, difficultyMax);
    const race = choice(races);
    const realm = choice(realms);
    const realmStage = choice(realmStages);
    const variantSeed = [
      'admin-battle-simulator',
      side,
      index,
      realm,
      realmStage,
      race,
      difficulty,
      Math.random().toString(36).slice(2, 8),
    ].join(':');
    const draft = this.generator.buildDraft({
      realm,
      realmStage,
      race,
      difficulty,
      isBoss: Math.random() < (filters?.bossRate ?? 0.1),
      variantSeed,
    });
    return {
      cultivator: draft.cultivator,
      summary: buildParticipantSummary({
        side,
        cultivator: draft.cultivator,
        source: 'template',
        template: {
          difficulty: draft.input.difficulty,
          difficultyBand: resolveDifficultyBand(draft.input.difficulty),
          variantSeed: draft.balance.variantKey,
        },
      }),
    };
  }
}

export const adminBattleSimulatorService = new AdminBattleSimulatorService();

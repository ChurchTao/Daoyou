import { describe, expect, it, vi } from 'vitest';
import { createSectTaskWorkflow } from './SectTaskWorkflow';
import { SWEEP_RULES_VERSION, type SweepInputSegment } from '@shared/engine/sect';

function lawnmowerTrace(): SweepInputSegment[] {
  const trace: SweepInputSegment[] = [
    { ticks: 48, direction: 6, sweeping: true },
  ];
  for (let row = 0; row < 5; row += 1) {
    trace.push({ ticks: 12, direction: 0, sweeping: true });
    trace.push({ ticks: 104, direction: row % 2 === 0 ? 2 : 6, sweeping: true });
  }
  return trace;
}

function createHarness(winnerId: string, mirrorId: string | null = null) {
  const definition = {
    id: 'fixture_battle',
    name: '试剑',
    description: '夹具宗门战斗',
    kind: 'weekly',
    requiredRank: 'registered',
    contributionReward: 40,
    executor: 'battle',
    target: 1,
  } as const;
  const scenario = {
    taskId: definition.id,
    kind: 'member_mirror',
    opponentName: '无名残影',
    title: '夹具小比',
    attributeMultiplier: 1,
    fallback: {
      kind: 'scaled_npc',
      opponentName: '夹具剑傀',
      title: '夹具小比',
      attributeMultiplier: 0.8,
    },
  } as const;
  const organization = {
    tasks: {
      get: vi.fn((id: string) => (id === definition.id ? definition : undefined)),
      findByRole: vi.fn(() => undefined),
    },
    battles: { get: vi.fn(() => scenario) },
    ranks: { requirement: vi.fn() },
  };
  const membership = {
    id: 'membership-1',
    sectId: 'fixture',
    discipleRank: 'registered',
    contribution: 100,
  };
  const activeRecord = {
    id: 'record-1',
    membershipId: membership.id,
    taskId: definition.id,
    kind: 'weekly',
    periodKey: 'fixture-week',
    status: 'active',
    progress: 0,
    payload: { target: 1, mode: 'battle' },
    completedAt: null,
  };
  const completedRecord = {
    ...activeRecord,
    status: 'completed',
    progress: 1,
    completedAt: new Date('2026-07-19T00:00:00Z'),
  };
  const player = {
    id: 'cultivator-1',
    name: '道友',
    title: '',
    realm: '炼气',
    realm_stage: '初期',
    attributes: {
      vitality: 100,
      spirit: 100,
      wisdom: 100,
      speed: 100,
      willpower: 100,
    },
    skills: [],
    cultivations: [],
    inventory: { artifacts: [] },
  };
  const repository = {
    findSectTaskRecord: vi.fn(async () => activeRecord),
    completeSectTaskRecord: vi.fn(async () => completedRecord),
    addSectContribution: vi.fn(async () => undefined),
    findSectMirrorCultivatorId: vi.fn(async () => mirrorId),
  };
  const simulateBattle = vi.fn((..._args: unknown[]) => ({
    winner: { id: winnerId },
    loser: { id: winnerId === player.id ? 'opponent' : player.id },
    turns: 1,
    timeline: [],
  }));
  const workflow = createSectTaskWorkflow({
    runtime: {
      registry: { require: vi.fn(() => ({ organization })) },
    } as never,
    organizationRepository: repository as never,
    membershipRepository: {
      findMembership: vi.fn(async () => membership),
      loadSectCultivatorProgress: vi.fn(async () => null),
    } as never,
    benefits: { assertPermission: vi.fn() } as never,
    getPlayer: vi.fn(async (id: string) =>
      id === player.id ? { cultivator: player } : null,
    ) as never,
    updateCultivationExp: vi.fn() as never,
    simulateBattle: simulateBattle as never,
    getExecutor: vi.fn(() => ({}) as never),
  });
  return { workflow, repository, simulateBattle, player, definition };
}

describe('SectTaskWorkflow battle settlement', () => {
  it('completes and rewards the task only after victory', async () => {
    const harness = createHarness('cultivator-1');
    const result = await harness.workflow.challengeTask(
      'user-1',
      'cultivator-1',
      harness.definition.id,
      {} as never,
      'attempt-1',
    );
    expect(result.won).toBe(true);
    expect(result.rewardGranted).toBe(true);
    expect(harness.repository.completeSectTaskRecord).toHaveBeenCalledOnce();
    expect(harness.repository.addSectContribution).toHaveBeenCalledOnce();
  });

  it('keeps the task active and grants nothing after defeat', async () => {
    const harness = createHarness('opponent');
    const result = await harness.workflow.challengeTask(
      'user-1',
      'cultivator-1',
      harness.definition.id,
      {} as never,
      'attempt-1',
    );
    expect(result.won).toBe(false);
    expect(result.task.status).toBe('active');
    expect(harness.repository.completeSectTaskRecord).not.toHaveBeenCalled();
    expect(harness.repository.addSectContribution).not.toHaveBeenCalled();
  });

  it('excludes the player from mirror lookup and uses the deterministic fallback', async () => {
    const harness = createHarness('opponent');
    await harness.workflow.challengeTask(
      'user-1',
      'cultivator-1',
      harness.definition.id,
      {} as never,
      'attempt-stable',
    );
    expect(harness.repository.findSectMirrorCultivatorId).toHaveBeenCalledWith(
      'fixture',
      'cultivator-1',
      expect.anything(),
    );
    const opponent = harness.simulateBattle.mock.calls[0]?.[1] as {
      id: string;
      name: string;
    };
    expect(opponent.id).toBe('sect-task-record-1-attempt-stable');
    expect(opponent.name).toBe('夹具剑傀');
  });
});

describe('SectTaskWorkflow sweep verification', () => {
  function createSweepHarness(sessionId = 'session-1') {
    const definition = {
      id: 'fixture_sweep',
      kind: 'daily',
      executor: 'sweep',
      contributionReward: 25,
    };
    const membership = {
      id: 'membership-1',
      sectId: 'fixture',
      discipleRank: 'registered',
    };
    const record = {
      id: 'record-sweep',
      taskId: definition.id,
      kind: 'daily',
      periodKey: 'today',
      status: 'active',
      progress: 0,
      payload: {
        target: 1,
        sweepSession: {
          sessionId,
          seed: 'sweep-success',
          rulesVersion: SWEEP_RULES_VERSION,
          startedAt: new Date(Date.now() - 40_000).toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      completedAt: null,
    };
    const completed = {
      ...record,
      status: 'completed',
      progress: 1,
      completedAt: new Date(),
    };
    const repository = {
      findDailySectTask: vi.fn(async () => record),
      completeSectTaskRecord: vi.fn(async () => completed),
      addSectContribution: vi.fn(async () => undefined),
      countCompletedDailySectTasksSince: vi.fn(async () => 1),
    };
    const workflow = createSectTaskWorkflow({
      runtime: {
        registry: {
          require: vi.fn(() => ({
            organization: {
              tasks: {
                get: vi.fn(() => definition),
                findByRole: vi.fn(() => undefined),
              },
            },
          })),
        },
      } as never,
      organizationRepository: repository as never,
      membershipRepository: {
        findMembership: vi.fn(async () => membership),
        loadSectCultivatorProgress: vi.fn(async () => null),
      } as never,
      benefits: {} as never,
      getPlayer: vi.fn() as never,
      updateCultivationExp: vi.fn() as never,
      simulateBattle: vi.fn() as never,
      getExecutor: vi.fn(() => ({}) as never),
    });
    return { workflow, repository };
  }

  it('settles a server-replayed successful trace once', async () => {
    const { workflow, repository } = createSweepHarness();
    const task = await workflow.completeSweep(
      'user-1',
      'cultivator-1',
      {
        sessionId: 'session-1',
        rulesVersion: SWEEP_RULES_VERSION,
        segments: lawnmowerTrace(),
      },
      {} as never,
    );
    expect(task.status).toBe('completed');
    expect(repository.completeSectTaskRecord).toHaveBeenCalledOnce();
    expect(repository.addSectContribution).toHaveBeenCalledOnce();
  });

  it('rejects a session that does not belong to the current task', async () => {
    const { workflow, repository } = createSweepHarness();
    await expect(
      workflow.completeSweep(
        'user-1',
        'cultivator-1',
        {
          sessionId: 'another-session',
          rulesVersion: SWEEP_RULES_VERSION,
          segments: lawnmowerTrace(),
        },
        {} as never,
      ),
    ).rejects.toThrow('清扫场次与当前任务不匹配');
    expect(repository.completeSectTaskRecord).not.toHaveBeenCalled();
  });
});

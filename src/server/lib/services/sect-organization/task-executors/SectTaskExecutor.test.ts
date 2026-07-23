import {
  createSweepMaze,
  sweepDirectionsForPath,
  SWEEP_RULES_VERSION,
  type SectTaskDefinition,
} from '@shared/engine/sect';
import { describe, expect, it } from 'vitest';
import {
  BattleTaskExecutor,
  MaterialDeliveryTaskExecutor,
  SweepGameTaskExecutor,
  type SectTaskExecutionContext,
} from './SectTaskExecutor';

const definition: SectTaskDefinition = {
  id: 'fixture',
  kind: 'weekly',
  requiredCapability: 'sect.tasks.use',
  contributionReward: 1,
  executorKey: 'sect.battle',
  completion: [],
  presentation: {
    title: '夹具任务',
    description: '验证执行器拥有交互类型。',
    rewardSummary: '1 宗门贡献',
    actionLabel: '执行任务',
  },
  target: 1,
};

const record = {
  id: 'record',
  membershipId: 'membership',
  taskId: definition.id,
  kind: definition.kind,
  periodKey: '2026-W29',
  status: 'active' as const,
  progress: 0,
  payload: { quantity: 2, minQuality: '玄品' },
};

describe('SectTaskExecutor action presentation', () => {
  it('derives renderer from the selected executor instead of task content', () => {
    expect(new BattleTaskExecutor().actions(definition)[0]?.renderer).toBe(
      'sect.action.battle',
    );
    expect(
      new MaterialDeliveryTaskExecutor().actions(definition, record)[0],
    ).toMatchObject({
      renderer: 'sect.action.item-delivery',
      parameters: { itemKind: 'material', quantity: 2, minQuality: '玄品' },
    });
    expect(new SweepGameTaskExecutor().actions(definition)[0]?.renderer).toBe(
      'sect.action.sweep',
    );
  });

  it('starts and deterministically validates a version two sweep session', async () => {
    const executor = new SweepGameTaskExecutor();
    const sessionId = '22222222-2222-4222-8222-222222222222';
    let now = new Date('2026-07-22T10:00:00.000Z');
    const context = {
      userId: 'user',
      cultivatorId: 'cultivator',
      requestId: 'request',
      membership: { id: 'membership', sectId: 'fixture-sect' },
      record,
      definition,
      ports: {
        ids: { next: () => sessionId },
        clock: { now: () => now },
      },
    } as unknown as SectTaskExecutionContext;

    const started = await executor.execute('start', context, {});
    expect(started).toMatchObject({
      completed: false,
      outcome: {
        renderer: 'sect.outcome.sweep-session',
        data: { sessionId, rulesVersion: SWEEP_RULES_VERSION },
      },
    });
    const seed = `${record.id}:${sessionId}`;
    const moves = sweepDirectionsForPath(createSweepMaze(seed).solution);
    const completionContext = {
      ...context,
      record: { ...record, payload: started.payload },
    } as SectTaskExecutionContext;
    await expect(
      executor.execute('complete', completionContext, {
        sessionId,
        rulesVersion: SWEEP_RULES_VERSION,
        moves,
      }),
    ).resolves.toMatchObject({ completed: true });

    now = new Date('2026-07-22T10:11:00.000Z');
    await expect(
      executor.execute('complete', completionContext, {
        sessionId,
        rulesVersion: SWEEP_RULES_VERSION,
        moves,
      }),
    ).rejects.toThrow('清扫场次已过期');
  });

  it('accepts only bounded four-direction sweep move payloads', () => {
    const schema = new SweepGameTaskExecutor().inputSchema('complete');
    expect(
      schema.safeParse({
        sessionId: '22222222-2222-4222-8222-222222222222',
        rulesVersion: SWEEP_RULES_VERSION,
        moves: ['up', 'right'],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        sessionId: '22222222-2222-4222-8222-222222222222',
        rulesVersion: SWEEP_RULES_VERSION,
        segments: [{ direction: 0, ticks: 1, sweeping: true }],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        sessionId: '22222222-2222-4222-8222-222222222222',
        rulesVersion: SWEEP_RULES_VERSION,
        moves: ['diagonal'],
      }).success,
    ).toBe(false);
  });
});

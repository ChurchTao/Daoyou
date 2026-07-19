import type { SectTaskDefinition } from '@shared/engine/sect';
import { describe, expect, it } from 'vitest';
import {
  BattleTaskExecutor,
  MaterialDeliveryTaskExecutor,
  SweepGameTaskExecutor,
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
});

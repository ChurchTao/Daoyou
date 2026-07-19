import { describe, expect, it } from 'vitest';
import {
  SectDomainEventDispatcher,
  type SectDomainEventDispatchContext,
  type SectDomainEventHandlerContribution,
} from './SectDomainEventDispatcher';

function dispatchContext(): SectDomainEventDispatchContext {
  return {
    scope: 'membership',
    command: {
      clock: {
        now: () => new Date('2026-07-19T00:00:00.000Z'),
        dateKey: () => '2026-07-19',
        weekKey: () => '2026-W29',
      },
      modules: {
        require: () => {
          throw new Error('not used');
        },
      },
      facilities: { list: async () => [] },
      economy: { hasClaimedStipend: async () => false },
      construction: { findActiveProject: async () => null },
      memberships: {
        findByCultivator: async () => null,
        countCompletedDailyTasks: async () => 0,
        hasCompletedTask: async () => false,
        loadState: async () => undefined,
        listMembers: async () => ({ rows: [], total: 0 }),
        promote: async () => true,
      },
    },
  };
}

describe('SectDomainEventDispatcher', () => {
  it('processes handlers in registration order and derived events in FIFO order', async () => {
    const calls: string[] = [];
    const handlers: SectDomainEventHandlerContribution[] = [
      {
        eventType: 'SectTaskProgressSignaled',
        handle: () => {
          calls.push('progress:first');
          return [{
            type: 'SectContributionGranted',
            membershipId: 'membership-1',
            amount: 1,
            reason: 'test',
            referenceId: 'event-1',
          }];
        },
      },
      {
        eventType: 'SectTaskProgressSignaled',
        handle: () => {
          calls.push('progress:second');
        },
      },
      {
        eventType: 'SectContributionGranted',
        handle: () => {
          calls.push('contribution');
        },
      },
    ];
    await new SectDomainEventDispatcher(handlers).dispatch(
      [{
        type: 'SectTaskProgressSignaled',
        membershipId: 'membership-1',
        source: 'test',
        amount: 1,
      }],
      dispatchContext(),
    );
    expect(calls).toEqual(['progress:first', 'progress:second', 'contribution']);
  });

  it('stops dispatch when a handler fails', async () => {
    const handlers: SectDomainEventHandlerContribution[] = [
      {
        eventType: 'SectContributionSpent',
        handle: () => {
          throw new Error('settlement failed');
        },
      },
      {
        eventType: 'SectContributionSpent',
        handle: () => {
          throw new Error('must not run');
        },
      },
    ];
    await expect(
      new SectDomainEventDispatcher(handlers).dispatch(
        [{
          type: 'SectContributionSpent',
          membershipId: 'membership-1',
          amount: 1,
          reason: 'test',
          referenceId: 'event-1',
        }],
        dispatchContext(),
      ),
    ).rejects.toThrow('settlement failed');
  });

  it('rejects recursive event chains beyond the transaction limit', async () => {
    const handler: SectDomainEventHandlerContribution = {
      eventType: 'SectContributionGranted',
      handle: (event) => [event],
    };
    await expect(
      new SectDomainEventDispatcher([handler], 3).dispatch(
        [{
          type: 'SectContributionGranted',
          membershipId: 'membership-1',
          amount: 1,
          reason: 'test',
          referenceId: 'event-1',
        }],
        dispatchContext(),
      ),
    ).rejects.toThrow('单次宗门事务事件超过 3 个');
  });
});

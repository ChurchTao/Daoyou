import { describe, expect, it } from 'vitest';
import {
  defineSectDomainEventHandler,
  SectDomainEventDispatcher,
  type SectDomainEventHandlerContribution,
} from './SectDomainEventDispatcher';

describe('SectDomainEventDispatcher', () => {
  it('rejects events without a registered handler', async () => {
    await expect(
      new SectDomainEventDispatcher([]).dispatch([{
          type: 'SectMembershipPromoted',
          membershipId: 'membership-1',
          rank: 'outer',
        }]),
    ).rejects.toThrow('SectMembershipPromoted');
  });

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
    await new SectDomainEventDispatcher(handlers).dispatch([{
        type: 'SectTaskProgressSignaled',
        membershipId: 'membership-1',
        source: 'test',
        amount: 1,
      }]);
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
      new SectDomainEventDispatcher(handlers).dispatch([{
          type: 'SectContributionSpent',
          membershipId: 'membership-1',
          amount: 1,
          reason: 'test',
          referenceId: 'event-1',
        }]),
    ).rejects.toThrow('settlement failed');
  });

  it('rejects recursive event chains beyond the transaction limit', async () => {
    const handler: SectDomainEventHandlerContribution =
      defineSectDomainEventHandler('SectContributionGranted', (event) => [event]);
    await expect(
      new SectDomainEventDispatcher([handler], 3).dispatch([{
          type: 'SectContributionGranted',
          membershipId: 'membership-1',
          amount: 1,
          reason: 'test',
          referenceId: 'event-1',
        }]),
    ).rejects.toThrow('单次宗门事务事件超过 3 个');
  });
});

import { describe, expect, it } from 'vitest';
import {
  SectTaskRecordPayloadSchema,
  createSectTaskOfferSnapshot,
  resolveSectTaskClaimReward,
} from './taskOffer';
import { calculateRealmSectTaskReward } from './taskRewards';

describe('sect task offer snapshot', () => {
  const build = (rulesVersion: number) =>
    createSectTaskOfferSnapshot({
      rulesVersion,
      anchorRealm: '金丹',
      anchorRealmStage: '中期',
      periodKey: '2026-07-23',
      executorKey: 'sect.delivery.pill',
      requirement: {
        kind: 'pill',
        quantity: 1,
        minQuality: '玄品',
        family: 'longevity',
        trait: 'increase_lifespan',
        appearance: { mode: 'at_least', grade: 'middle' },
      },
      difficulty: 'hard',
      reward: calculateRealmSectTaskReward({
        realm: '金丹',
        realmStage: '中期',
        difficulty: 'hard',
        cadence: 'daily',
        reward: { baseContribution: 35 },
      }),
    });

  it('creates a strict v2 snapshot without a pre-accept revision', () => {
    expect(build(1)).toEqual(build(1));
    expect(build(2).rulesVersion).not.toBe(build(1).rulesVersion);
    expect(build(1)).not.toHaveProperty('offerRevision');
  });

  it('strictly parses the current payload shape', () => {
    const offer = build(1);
    expect(
      SectTaskRecordPayloadSchema.parse({
        schemaVersion: 2,
        target: 1,
        offer,
        executorData: {},
      }).offer,
    ).toEqual(offer);
    expect(() =>
      SectTaskRecordPayloadSchema.parse({
        target: 1,
        offer,
        executorData: {},
      }),
    ).toThrow();
  });

  it('preserves reward and delivery archives after removing retired requirements', () => {
    const offer = build(1);
    const payload = {
      schemaVersion: 2,
      target: 1,
      executorData: {},
      offer: {
        ...offer,
        executorKey: 'sect.delivery.equipment',
        requirement: undefined,
      },
      completionData: {
        submittedItems: [
          {
            itemId: 'old-item',
            kind: 'artifact',
            name: '旧法宝',
            quality: '玄品',
            quantity: 1,
            matchedFacts: ['历史交付'],
          },
        ],
      },
    };
    const archive = SectTaskRecordPayloadSchema.parse(payload);
    expect(resolveSectTaskClaimReward(archive)).toEqual(offer.reward);
    expect(archive.completionData?.submittedItems?.[0].name).toBe('旧法宝');
    expect(() =>
      SectTaskRecordPayloadSchema.parse({
        ...payload,
        offer: {
          ...payload.offer,
          requirement: {
            kind: 'artifact',
            quantity: 1,
            minQuality: '玄品',
            slot: 'weapon',
            mustBeUnequipped: true,
          },
        },
      }),
    ).toThrow();
    const current = SectTaskRecordPayloadSchema.parse({
      ...payload,
      completionData: {
        submittedItems: [
          {
            itemId: 'new-item',
            kind: 'equipment',
            name: '青石甲',
            equipmentLevel: 10,
            quantity: 1,
            matchedFacts: ['10级法衣'],
          },
        ],
      },
    });
    expect(current.completionData?.submittedItems?.[0]).not.toHaveProperty(
      'quality',
    );
  });

  it('only parses the v2 batch completion snapshot', () => {
    const offer = build(1);
    const item = {
      itemId: 'material-1',
      kind: 'material' as const,
      name: '玄铁',
      quality: '玄品',
      quantity: 1,
      matchedFacts: ['玄品以上矿石'],
    };

    expect(() =>
      SectTaskRecordPayloadSchema.parse({
        schemaVersion: 2,
        target: 1,
        offer,
        executorData: {},
        completionData: { submittedItem: item },
      }),
    ).toThrow();
    expect(
      SectTaskRecordPayloadSchema.parse({
        schemaVersion: 2,
        target: 1,
        offer,
        executorData: {},
        completionData: {
          submittedItems: [
            item,
            { ...item, itemId: 'material-2', name: '赤铜', quantity: 2 },
          ],
        },
      }).completionData?.submittedItems,
    ).toHaveLength(2);
  });

  it('keeps old reward snapshots compatible and resolves frozen mining rewards', () => {
    const offer = build(1);
    const { grants: _grants, ...legacyReward } = offer.reward!;
    const legacyPayload = SectTaskRecordPayloadSchema.parse({
      schemaVersion: 2,
      target: 1,
      offer: { ...offer, reward: legacyReward },
      executorData: {},
    });
    expect(legacyPayload.offer.reward?.grants).toEqual([]);

    const miningReward = {
      ...offer.reward!,
      contribution: offer.reward!.contribution + 12,
      summary: [...offer.reward!.summary, '玄铁矿团（玄品）×2'],
      grants: [
        {
          quantity: 2,
          grant: {
            kind: 'sect.reward.material' as const,
            name: '玄铁矿团',
            quality: '玄品' as const,
            description: '地脉深处凝结的玄铁。',
            type: 'ore' as const,
            libraryItemId: 'ore-library-1',
          },
        },
      ],
    };
    const miningPayload = SectTaskRecordPayloadSchema.parse({
      schemaVersion: 2,
      target: 1,
      offer,
      executorData: {},
      completionData: {
        mining: {
          score: 2_100,
          maxScore: 2_910,
          tier: 'A',
          reward: miningReward,
        },
      },
    });
    expect(resolveSectTaskClaimReward(miningPayload)).toEqual(miningReward);
    expect(() =>
      SectTaskRecordPayloadSchema.parse({
        ...miningPayload,
        completionData: {
          ...miningPayload.completionData,
          submittedItems: [
            {
              itemId: 'material-1',
              kind: 'material',
              name: '玄铁',
              quality: '玄品',
              quantity: 1,
              matchedFacts: ['玄品矿石'],
            },
          ],
        },
      }),
    ).toThrow('必须且只能包含一种结果');
  });
});

import {
  DOMAIN_EVENT_DEFINITIONS,
  parseDomainEventEnvelope,
} from './domainEvents';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const CULTIVATOR_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '55555555-5555-4555-8555-555555555555';

describe('domain event contracts', () => {
  it('parses a versioned event envelope', () => {
    const definition = DOMAIN_EVENT_DEFINITIONS['alchemy.craft.completed'];
    const event = parseDomainEventEnvelope({
      id: EVENT_ID,
      type: 'alchemy.craft.completed',
      version: definition.version,
      subject: definition.subject,
      occurredAt: '2026-08-03T08:00:00.000Z',
      aggregate: { type: 'cultivator', id: CULTIVATOR_ID },
      data: {
        cultivatorId: CULTIVATOR_ID,
        actionInstanceId: '33333333-3333-4333-8333-333333333333',
        mode: 'formula',
      },
    });

    expect(event.type).toBe('alchemy.craft.completed');
    expect(event.data).toMatchObject({ mode: 'formula' });
  });

  it('rejects subject or version drift for a known event type', () => {
    expect(() =>
      parseDomainEventEnvelope({
        id: EVENT_ID,
        type: 'ranking.challenge.completed',
        version: 2,
        subject: 'daoyou.domain.activity.wrong.v2',
        occurredAt: '2026-08-03T08:00:00.000Z',
        aggregate: { type: 'cultivator', id: CULTIVATOR_ID },
        data: {},
      }),
    ).toThrow('领域事件定义不匹配');
  });

  it('rejects invalid event data', () => {
    const definition = DOMAIN_EVENT_DEFINITIONS['dungeon.run.settled'];
    expect(() =>
      parseDomainEventEnvelope({
        id: EVENT_ID,
        type: 'dungeon.run.settled',
        version: definition.version,
        subject: definition.subject,
        occurredAt: '2026-08-03T08:00:00.000Z',
        aggregate: {
          type: 'dungeon-run',
          id: '44444444-4444-4444-8444-444444444444',
        },
        data: {
          cultivatorId: CULTIVATOR_ID,
          runId: '44444444-4444-4444-8444-444444444444',
          mapNodeId: 'node-1',
          outcome: 'unknown',
        },
      }),
    ).toThrow();
  });

  it('preserves a dungeon root activity and accepts legacy events without it', () => {
    const definition = DOMAIN_EVENT_DEFINITIONS['dungeon.run.settled'];
    const base = {
      id: EVENT_ID,
      type: 'dungeon.run.settled' as const,
      version: definition.version,
      subject: definition.subject,
      occurredAt: '2026-08-03T08:00:00.000Z',
      aggregate: {
        type: 'dungeon-run',
        id: '44444444-4444-4444-8444-444444444444',
      },
      data: {
        cultivatorId: CULTIVATOR_ID,
        runId: '44444444-4444-4444-8444-444444444444',
        mapNodeId: 'node-1',
        outcome: 'completed' as const,
      },
    };

    expect(
      parseDomainEventEnvelope({
        ...base,
        data: {
          ...base.data,
          rootActivityId: 'travel:33333333-3333-4333-8333-333333333333',
        },
      }).data,
    ).toMatchObject({
      rootActivityId: 'travel:33333333-3333-4333-8333-333333333333',
    });
    expect(parseDomainEventEnvelope(base).data).not.toHaveProperty(
      'rootActivityId',
    );
  });

  it.each([
    {
      type: 'yield.claimed' as const,
      data: {
        cultivatorId: CULTIVATOR_ID,
        actionInstanceId: '33333333-3333-4333-8333-333333333333',
        realm: '筑基',
        materialCount: 2,
      },
    },
    {
      type: 'cultivator.realm.changed' as const,
      data: {
        userId: USER_ID,
        cultivatorId: CULTIVATOR_ID,
        actionInstanceId: '33333333-3333-4333-8333-333333333333',
        cultivatorName: '玄真',
        fromRealm: '炼气',
        fromStage: '圆满',
        toRealm: '筑基',
        toStage: '初期',
        major: true,
      },
    },
    {
      type: 'mail.created' as const,
      data: {
        mailId: '66666666-6666-4666-8666-666666666666',
        cultivatorId: CULTIVATOR_ID,
        mailType: 'reward',
        attachmentCount: 1,
      },
    },
    {
      type: 'craft.item.created' as const,
      data: {
        userId: USER_ID,
        cultivatorId: CULTIVATOR_ID,
        cultivatorName: '玄真',
        itemType: 'artifact',
        itemId: '77777777-7777-4777-8777-777777777777',
        itemName: '玄光剑',
        quality: '天品',
        snapshot: { id: '77777777-7777-4777-8777-777777777777' },
      },
    },
    {
      type: 'market.material.revealed' as const,
      data: {
        userId: USER_ID,
        cultivatorId: CULTIVATOR_ID,
        cultivatorName: '玄真',
        materialId: '77777777-7777-4777-8777-777777777777',
        materialName: '星辰砂',
        quality: '天品',
        snapshot: { id: '77777777-7777-4777-8777-777777777777' },
      },
    },
    {
      type: 'bet-battle.created' as const,
      data: {
        userId: USER_ID,
        cultivatorId: CULTIVATOR_ID,
        cultivatorName: '玄真',
        battleId: '88888888-8888-4888-8888-888888888888',
        taunt: '可敢一战',
      },
    },
    {
      type: 'bet-battle.settled' as const,
      data: {
        userId: USER_ID,
        cultivatorId: CULTIVATOR_ID,
        battleId: '88888888-8888-4888-8888-888888888888',
        rumor: '玄真于赌战台取胜。',
      },
    },
    {
      type: 'ranking.position.changed' as const,
      data: {
        userId: USER_ID,
        cultivatorId: CULTIVATOR_ID,
        challengerName: '玄真',
        targetName: '赤霄',
        realm: '筑基',
        rank: 3,
        changeType: 'challenge_win',
      },
    },
  ])('parses $type integration event data', ({ type, data }) => {
    const definition = DOMAIN_EVENT_DEFINITIONS[type];
    const event = parseDomainEventEnvelope({
      id: EVENT_ID,
      type,
      version: definition.version,
      subject: definition.subject,
      occurredAt: '2026-08-03T08:00:00.000Z',
      aggregate: { type: 'cultivator', id: CULTIVATOR_ID },
      data,
    });
    expect(event.type).toBe(type);
  });
});

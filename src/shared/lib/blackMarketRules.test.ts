import {
  blackMarketDayEnd,
  blackMarketDayKey,
  blackMarketEntryCost,
  blackMarketEntryId,
  blackMarketTurnsRemaining,
  blackMarketUnit,
  classifyBlackMarketReveal,
  BLACK_MARKET_QUALITIES,
} from './blackMarketRules';

describe('black market rules', () => {
  it('uses a stable unit value while separating labels', () => {
    const first = blackMarketUnit('seed', 'initial');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(first).toBe(blackMarketUnit('seed', 'initial'));
    expect(first).not.toBe(blackMarketUnit('seed', 'floor'));
  });

  it('grades both losses and windfalls from the server true value', () => {
    expect(classifyBlackMarketReveal(18_000, 10_000).rating).toBe('血亏');
    expect(classifyBlackMarketReveal(10_000, 10_000).rating).toBe('公允');
    expect(classifyBlackMarketReveal(5_000, 10_000).rating).toBe('天降横财');
  });

  it('uses the Asia/Shanghai natural day boundary', () => {
    const beforeMidnight = Date.parse('2026-08-15T15:59:59.999Z');
    const afterMidnight = Date.parse('2026-08-15T16:00:00.000Z');

    expect(blackMarketDayKey(beforeMidnight)).toBe('2026-08-15');
    expect(blackMarketDayKey(afterMidnight)).toBe('2026-08-16');
    expect(blackMarketDayEnd(beforeMidnight)).toBe(afterMidnight);
    expect(blackMarketDayEnd(afterMidnight)).toBe(
      Date.parse('2026-08-16T16:00:00.000Z'),
    );
  });

  it('makes only the first daily entry free', () => {
    expect(blackMarketEntryCost(0)).toBe(0);
    expect(blackMarketEntryCost(1)).toBe(5);
    expect(blackMarketEntryCost(99)).toBe(5);
  });

  it('uses a stable daily entry identity for each node and npc', () => {
    const entry = { dayKey: '2026-08-15', nodeId: 'node-a', npcId: 'npc-a' };
    expect(blackMarketEntryId(entry)).toBe(blackMarketEntryId(entry));
    expect(blackMarketEntryId(entry)).not.toBe(
      blackMarketEntryId({ ...entry, npcId: 'npc-b' }),
    );
    expect(blackMarketEntryId(entry)).not.toBe(
      blackMarketEntryId({ ...entry, nodeId: 'node-b' }),
    );
  });

  it('offers only earth through divine quality lots', () => {
    expect(BLACK_MARKET_QUALITIES).toEqual(['地品', '天品', '仙品', '神品']);
    expect(BLACK_MARKET_QUALITIES).not.toContain('真品');
  });

  it('caps a session at six LLM turns', () => {
    expect(blackMarketTurnsRemaining(0)).toBe(6);
    expect(blackMarketTurnsRemaining(5)).toBe(1);
    expect(blackMarketTurnsRemaining(6)).toBe(0);
    expect(blackMarketTurnsRemaining(7)).toBe(0);
  });
});

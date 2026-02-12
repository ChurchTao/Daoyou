import { getQueryConcurrency, resolveDbConfig } from './db';

describe('resolveDbConfig', () => {
  it('uses node defaults when DB_RUNTIME is not set', () => {
    const config = resolveDbConfig({});
    expect(config.runtime).toBe('node');
    expect(config.max).toBe(10);
    expect(config.prepare).toBe(false);
    expect(config.idle_timeout).toBe(20);
    expect(config.debug).toBe(false);
  });

  it('uses worker defaults when DB_RUNTIME=worker', () => {
    const config = resolveDbConfig({ DB_RUNTIME: 'worker' });
    expect(config.runtime).toBe('worker');
    expect(config.max).toBe(1);
    expect(config.prepare).toBe(false);
    expect(config.idle_timeout).toBe(5);
  });

  it('supports DB_POOL_MAX override', () => {
    const config = resolveDbConfig({
      DB_RUNTIME: 'worker',
      DB_POOL_MAX: '6',
    });
    expect(config.max).toBe(6);
  });

  it('parses booleans for prepare and debug', () => {
    const config = resolveDbConfig({
      DB_PREPARE: 'true',
      DB_DEBUG: '1',
    });
    expect(config.prepare).toBe(true);
    expect(config.debug).toBe(true);
  });
});

describe('getQueryConcurrency', () => {
  it('uses runtime defaults', () => {
    expect(getQueryConcurrency({ DB_RUNTIME: 'worker' })).toBe(1);
    expect(getQueryConcurrency({ DB_RUNTIME: 'node' })).toBe(4);
  });

  it('supports DB_QUERY_CONCURRENCY override', () => {
    expect(
      getQueryConcurrency({
        DB_RUNTIME: 'worker',
        DB_QUERY_CONCURRENCY: '3',
      }),
    ).toBe(3);
  });
});

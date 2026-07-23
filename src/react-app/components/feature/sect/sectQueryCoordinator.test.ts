import { describe, expect, it, vi } from 'vitest';
import { SectQueryCoordinator } from './sectQueryCoordinator';

const callbacks = () => ({
  onStart: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
});

describe('SectQueryCoordinator', () => {
  it('deduplicates the same resource request', async () => {
    const coordinator = new SectQueryCoordinator();
    const loader = vi.fn(async () => ({ value: 1 }));
    const first = coordinator.execute({ key: 'overview', loader, ...callbacks() });
    const second = coordinator.execute({ key: 'overview', loader, ...callbacks() });
    expect(await first).toEqual({ value: 1 });
    expect(await second).toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('aborts an obsolete request during exact invalidation', async () => {
    const coordinator = new SectQueryCoordinator();
    let firstSignal: AbortSignal | undefined;
    const first = coordinator.execute({
      key: 'tasks',
      loader: (signal) => {
        firstSignal = signal;
        return new Promise<string>(() => undefined);
      },
      ...callbacks(),
    });
    const second = coordinator.execute({
      key: 'tasks',
      force: true,
      loader: async () => 'fresh',
      ...callbacks(),
    });
    expect(firstSignal?.aborted).toBe(true);
    expect(await second).toBe('fresh');
    void first;
  });

  it('aborts all resources on provider disposal', () => {
    const coordinator = new SectQueryCoordinator();
    let signal: AbortSignal | undefined;
    void coordinator.execute({
      key: 'construction',
      loader: (nextSignal) => {
        signal = nextSignal;
        return new Promise(() => undefined);
      },
      ...callbacks(),
    });
    coordinator.dispose();
    expect(signal?.aborted).toBe(true);
  });
});

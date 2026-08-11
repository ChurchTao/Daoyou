export interface BattleClock {
  now(): number;
}

export class SystemBattleClock implements BattleClock {
  now(): number {
    return Date.now();
  }
}

/** Deterministic logical clock for replay, tests and restored matches. */
export class LogicalBattleClock implements BattleClock {
  constructor(private value = 0) {}

  now(): number {
    return this.value++;
  }

  exportState(): number {
    return this.value;
  }

  restoreState(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('Battle clock state must be a non-negative safe integer');
    }
    this.value = value;
  }
}

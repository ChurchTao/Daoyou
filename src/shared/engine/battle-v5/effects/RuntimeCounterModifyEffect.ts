import type { RuntimeCounterModifyParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import {
  readRuntimeCounter,
  writeRuntimeCounter,
} from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

function eventAmount(
  context: EffectContext,
  field: RuntimeCounterModifyParams['amountFromEvent'],
): number | undefined {
  if (!field || !context.triggerEvent || typeof context.triggerEvent !== 'object') {
    return undefined;
  }
  const value = (context.triggerEvent as unknown as Record<string, unknown>)[field];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export class RuntimeCounterModifyEffect extends GameplayEffect {
  constructor(private readonly params: RuntimeCounterModifyParams) {
    super();
  }

  execute(context: EffectContext): void {
    const unit = this.params.target === 'target' ? context.target : context.caster;
    const before = readRuntimeCounter(unit, this.params.key);
    const amount = eventAmount(context, this.params.amountFromEvent)
      ?? Math.max(0, Math.trunc(this.params.amount ?? 1));
    let requested: number;

    switch (this.params.operation) {
      case 'add':
        requested = before + amount;
        break;
      case 'subtract':
        requested = before - amount;
        break;
      case 'set':
        requested = amount;
        break;
      case 'reset':
        requested = 0;
        break;
    }

    const min = this.params.min ?? 0;
    const max = this.params.max ?? Number.POSITIVE_INFINITY;
    const after = writeRuntimeCounter(unit, this.params.key, Math.max(min, Math.min(max, requested)));
    const changed = this.params.operation === 'reset'
      ? Math.max(0, before)
      : Math.abs(after - before);
    const repeat = this.params.scaleEffectsByAmount ? changed : changed > 0 ? 1 : 0;

    for (let index = 0; index < repeat; index += 1) {
      executeEffectConfigs(this.params.effects ?? [], context);
    }
  }
}

EffectRegistry.getInstance().register(
  'runtime_counter_modify',
  (params) => new RuntimeCounterModifyEffect(params),
);

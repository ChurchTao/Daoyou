import type { EffectConfig } from './configs';
import type { EffectContext } from '../effects/Effect';
import { EffectRegistry } from '../factories/EffectRegistry';

export function executeEffectConfigs(
  effects: readonly EffectConfig[],
  context: EffectContext,
): void {
  for (const effectConfig of effects) {
    const effect = EffectRegistry.getInstance().create(effectConfig);
    effect?.execute(context);
  }
}

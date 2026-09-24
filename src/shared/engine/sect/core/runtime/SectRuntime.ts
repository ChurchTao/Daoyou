import type { CultivatorSectState } from '../domain';
import type { SectModule } from '../plugin';
import { SectRegistry } from './SectRegistry';

export interface SectRuntime {
  registry: SectRegistry;
  validateState(state: CultivatorSectState): void;
}

export function createSectRuntime(modules: readonly SectModule[]): SectRuntime {
  const registry = new SectRegistry(modules);
  return { registry, validateState: (state) => registry.validateState(state) };
}

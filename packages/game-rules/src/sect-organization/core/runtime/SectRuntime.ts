import type { CultivatorSectState } from '../domain/index.js';
import type { SectModule } from '../plugin/index.js';
import { SectRegistry } from './SectRegistry.js';

export interface SectRuntime {
  registry: SectRegistry;
  validateState(state: CultivatorSectState): void;
}

export function createSectRuntime(modules: readonly SectModule[]): SectRuntime {
  const registry = new SectRegistry(modules);
  return { registry, validateState: (state) => registry.validateState(state) };
}

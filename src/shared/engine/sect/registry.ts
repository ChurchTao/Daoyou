import type { CultivatorSectState, SectDefinition, SectModule } from './types';
import { assertSectModule } from './validation/SectModuleValidator';
import { SectStateValidator } from './validation/SectStateValidator';

/** Registry pattern: validates modules once, then dispatches only by stable sect ID. */
export class SectRegistry {
  private readonly modules = new Map<string, SectModule>();
  private readonly stateValidator = new SectStateValidator();

  constructor(modules: readonly SectModule[] = []) {
    for (const module of modules) this.register(module);
  }

  register(module: SectModule): void {
    assertSectModule(module);
    if (this.modules.has(module.definition.id))
      throw new Error(`宗门重复注册: ${module.definition.id}`);
    this.modules.set(module.definition.id, module);
  }

  get(sectId: string): SectModule | undefined {
    return this.modules.get(sectId);
  }

  require(sectId: string): SectModule {
    const module = this.get(sectId);
    if (!module) throw new Error(`未知宗门: ${sectId}`);
    return module;
  }

  listDefinitions(): SectDefinition[] {
    return Array.from(this.modules.values(), (module) => module.definition);
  }

  validateState(state: CultivatorSectState): void {
    this.stateValidator.validate(this.require(state.sectId), state);
  }
}

export function createSectRegistry(
  modules: readonly SectModule[],
): SectRegistry {
  return new SectRegistry(modules);
}

export { assertSectModule } from './validation/SectModuleValidator';

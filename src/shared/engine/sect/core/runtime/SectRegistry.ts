import type { CultivatorSectState, SectDefinition } from '../domain';
import type { SectModule } from '../plugin';
import { assertSectModule, SectStateValidator } from '../validation';

/** 注册时完成完整契约校验，运行期只按稳定宗门 ID 分派。 */
export class SectRegistry {
  private readonly modules = new Map<string, SectModule>();
  private readonly stateValidator = new SectStateValidator();

  constructor(modules: readonly SectModule[] = []) {
    for (const module of modules) this.register(module);
  }

  register(module: SectModule): void {
    assertSectModule(module);
    if (this.modules.has(module.definition.id)) {
      throw new Error(`宗门重复注册: ${module.definition.id}`);
    }
    for (const registered of this.modules.values()) {
      if (
        registered.definition.combatResource.id ===
        module.definition.combatResource.id
      ) {
        throw new Error(
          `宗门战斗资源ID重复: ${module.definition.combatResource.id}`,
        );
      }
    }
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

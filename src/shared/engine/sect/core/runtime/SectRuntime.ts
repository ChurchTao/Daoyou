import type { RealmType } from '@shared/types/constants';
import { SectCompiler } from '../compilation';
import type {
  CultivatorSectState,
  ResolvedSectAbility,
  SectCombatProjection,
} from '../domain';
import type { SectModule } from '../plugin';
import { SectRegistry } from './SectRegistry';

export interface SectRuntime {
  registry: SectRegistry;
  compiler: SectCompiler;
  projectCombat(args: {
    sect: CultivatorSectState;
    realm: RealmType;
  }): SectCombatProjection | null;
  resolveAbility(args: {
    sect: CultivatorSectState;
    realm: RealmType;
    abilityId: string;
  }): ResolvedSectAbility;
  validateState(state: CultivatorSectState): void;
}

/** 客户端与服务端共用的注册、校验和编译门面。 */
export class SectRuntimeFacade implements SectRuntime {
  readonly registry: SectRegistry;
  readonly compiler = new SectCompiler();

  constructor(modules: readonly SectModule[]) {
    this.registry = new SectRegistry(modules);
  }

  projectCombat(args: {
    sect: CultivatorSectState;
    realm: RealmType;
  }): SectCombatProjection | null {
    this.validateState(args.sect);
    return this.compiler.projectCombat(
      this.registry.require(args.sect.sectId),
      args,
    );
  }

  resolveAbility(args: {
    sect: CultivatorSectState;
    realm: RealmType;
    abilityId: string;
  }): ResolvedSectAbility {
    this.validateState(args.sect);
    return this.compiler.resolveAbility(
      this.registry.require(args.sect.sectId),
      args,
    );
  }

  validateState(state: CultivatorSectState): void {
    this.registry.validateState(state);
  }
}

export function createSectRuntime(modules: readonly SectModule[]): SectRuntime {
  return new SectRuntimeFacade(modules);
}

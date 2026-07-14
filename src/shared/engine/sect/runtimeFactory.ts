import type { RealmType } from '@shared/types/constants';
import { SectCompiler } from './compiler';
import { createSectRegistry, type SectRegistry } from './registry';
import type {
  CultivatorSectState,
  ResolvedSectAbility,
  SectCombatProjection,
  SectModule,
} from './types';

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

/** Facade over registry dispatch, validation and deterministic compilation. */
export class SectRuntimeFacade implements SectRuntime {
  readonly registry: SectRegistry;
  readonly compiler = new SectCompiler();

  constructor(modules: readonly SectModule[]) {
    this.registry = createSectRegistry(modules);
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

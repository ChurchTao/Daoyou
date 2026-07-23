import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { SectBuildBuilder } from '../compilation';
import type {
  SectAdmissionContext,
  SectAdmissionResult,
  SectDefinition,
  SectNodeApplyContext,
  SectPathCompileContext,
  SectPathDefinition,
  SectProjectionContext,
  SectProjectionInput,
  SectTacticId,
} from '../domain';
import type { SectOrganizationModule } from '../organization';

export interface SectNodePlugin {
  readonly definition: import('../domain').SectMeridianNodeDefinition;
  describe?(context: SectProjectionInput): string;
  apply(context: SectNodeApplyContext, builder: SectBuildBuilder): void;
}

export interface SectPathModule {
  readonly definition: SectPathDefinition;
  readonly nodes: ReadonlyMap<string, SectNodePlugin>;
  compile(context: SectPathCompileContext, builder: SectBuildBuilder): void;
  createSelectionStrategy(tacticId: SectTacticId): AbilitySelectionStrategy;
}

export interface SectAdmissionPolicy {
  check(context: SectAdmissionContext): SectAdmissionResult;
}

export interface SectModule {
  readonly definition: SectDefinition;
  readonly paths: ReadonlyMap<string, SectPathModule>;
  readonly progression: import('../progression').SectProgressionPolicy;
  readonly methodGrowth: import('../domain').SectMethodGrowthPolicy;
  readonly organization: SectOrganizationModule;
  createBaseSelectionStrategy(): AbilitySelectionStrategy;
  createBaseBuilder(context: SectProjectionContext): SectBuildBuilder;
  checkAdmission(context: SectAdmissionContext): SectAdmissionResult;
}

import { SectBuildBuilder } from '../compilation';
import type {
  SectAdmissionContext,
  SectAdmissionResult,
  SectDefinition,
  SectDefinitionWithoutPaths,
  SectProjectionContext,
  SectTrialContext,
  SectTrialScenario,
  SectMethodGrowthPolicy,
} from '../domain';
import type { SectProgressionPolicy } from '../progression';
import type { SectOrganizationModule } from '../organization';
import type {
  SectAdmissionPolicy,
  SectModule,
  SectPathModule,
  SectTrialScenarioFactory,
} from './contracts';

/** 宗门组合根基类：完整定义由基础定义和流派模块自动汇总。 */
export abstract class BaseSectModule implements SectModule {
  readonly definition: SectDefinition;
  readonly paths: ReadonlyMap<string, SectPathModule>;

  protected constructor(
    definition: SectDefinitionWithoutPaths,
    pathModules: readonly SectPathModule[],
    readonly progression: SectProgressionPolicy,
    readonly methodGrowth: SectMethodGrowthPolicy,
    readonly organization: SectOrganizationModule,
    private readonly admissionPolicy: SectAdmissionPolicy,
    private readonly trialScenarioFactory: SectTrialScenarioFactory,
  ) {
    this.paths = new Map(
      pathModules.map((module) => [module.definition.id, module]),
    );
    this.definition = {
      ...definition,
      paths: pathModules.map((module) => module.definition),
    };
  }

  createBaseBuilder(context: SectProjectionContext): SectBuildBuilder {
    const builder = SectBuildBuilder.from({
      abilities: {},
      resources: [],
    });
    this.compileBase(context, builder);
    return builder;
  }

  checkAdmission(context: SectAdmissionContext): SectAdmissionResult {
    return this.admissionPolicy.check(context);
  }

  createTrialScenario(context: SectTrialContext): SectTrialScenario {
    return this.trialScenarioFactory.create(context);
  }

  protected abstract compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ): void;
}

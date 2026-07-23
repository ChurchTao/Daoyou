import type { SectBuildBuilder } from '../compilation';
import type {
  SectMeridianNodeDefinition,
  SectNodeApplyContext,
  SectProjectionContext,
} from '../domain';
import type { SectNodePlugin } from './contracts';

/** 将节点定义与其唯一行为绑定，杜绝“有文案、无实现”的双表结构。 */
export class ConfiguredSectNodePlugin implements SectNodePlugin {
  constructor(
    readonly definition: SectMeridianNodeDefinition,
    private readonly behavior: (
      context: SectNodeApplyContext,
      builder: SectBuildBuilder,
    ) => void,
    private readonly descriptionResolver?: (
      context: SectProjectionContext,
    ) => string,
  ) {}

  describe(context: SectProjectionContext): string {
    return this.descriptionResolver?.(context) ?? this.definition.description;
  }

  apply(context: SectNodeApplyContext, builder: SectBuildBuilder): void {
    this.behavior(context, builder);
  }
}

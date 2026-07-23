import {
  ConfiguredSectNodePlugin,
  type SectBuildBuilder,
  type SectMeridianNodeDefinition,
  type SectNodeApplyContext,
  type SectProjectionContext,
} from '../../../core';

export function createLingxiaoNode(
  definition: SectMeridianNodeDefinition,
  apply: (context: SectNodeApplyContext, builder: SectBuildBuilder) => void,
  describe?: (context: SectProjectionContext) => string,
): ConfiguredSectNodePlugin {
  return new ConfiguredSectNodePlugin(definition, apply, describe);
}

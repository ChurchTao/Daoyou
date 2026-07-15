import {
  ConfiguredSectNodePlugin,
  type SectBuildBuilder,
  type SectMeridianNodeDefinition,
  type SectNodeApplyContext,
} from '../../../core';

export function createLingxiaoNode(
  definition: SectMeridianNodeDefinition,
  apply: (context: SectNodeApplyContext, builder: SectBuildBuilder) => void,
): ConfiguredSectNodePlugin {
  return new ConfiguredSectNodePlugin(definition, apply);
}

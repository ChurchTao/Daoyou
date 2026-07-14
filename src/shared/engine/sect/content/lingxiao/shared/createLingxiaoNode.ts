import {
  ConfiguredSectNodePlugin,
  standardSectProgression,
  type SectBuildBuilder,
  type SectMeridianNodeDefinition,
  type SectNodeApplyContext,
} from '../../../core';

export function createLingxiaoNode(
  definition: Omit<
    SectMeridianNodeDefinition,
    'minRealm' | 'minRealmStage' | 'minPathLevel'
  >,
  apply: (context: SectNodeApplyContext, builder: SectBuildBuilder) => void,
): ConfiguredSectNodePlugin {
  return new ConfiguredSectNodePlugin(
    standardSectProgression.defineNode(definition),
    apply,
  );
}

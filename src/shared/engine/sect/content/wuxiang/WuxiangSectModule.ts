import { StandardSectModule, type SectBuildBuilder, type SectProjectionContext } from '../../core';
import { compileWuxiangBase } from './shared/compiler';
import { WUXIANG_BASE_DEFINITION } from './definition';
import { WUXIANG_ORGANIZATION_THEME } from './organization';
import { WUXIANG_DEMON_PATH_MODULE, WUXIANG_MIRROR_PATH_MODULE } from './paths';

const trial = {
  methods: { 'wuxiang-canon': 10, 'blood-lotus': 10, 'white-bone': 10, 'wrathful-ming': 10, 'six-senses': 10, 'reed-crossing-method': 10 },
  abilityLoadout: ['turn-form', 'blood-tide', 'three-knocks', 'observe-calamity'] as const,
};

export class WuxiangSectModule extends StandardSectModule {
  constructor() {
    super(WUXIANG_BASE_DEFINITION, [WUXIANG_MIRROR_PATH_MODULE, WUXIANG_DEMON_PATH_MODULE], {
      organizationTheme: WUXIANG_ORGANIZATION_THEME,
      trialMethods: trial.methods,
      trialAbilityLoadout: [...trial.abilityLoadout],
      trialOpponentName: '无相照身木人',
    });
  }

  protected compileBase(context: SectProjectionContext, builder: SectBuildBuilder): void {
    compileWuxiangBase(context, builder);
  }
}

export const WUXIANG_MODULE = new WuxiangSectModule();
export const WUXIANG_SECT = WUXIANG_MODULE.definition;

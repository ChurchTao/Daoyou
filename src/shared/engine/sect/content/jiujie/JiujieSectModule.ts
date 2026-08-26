import { StandardSectModule, type SectBuildBuilder, type SectProjectionContext } from '../../core';
import { compileJiujieBase } from './base/JiujieBaseCompiler';
import { JIUJIE_BASE_DEFINITION } from './definition';
import { JIUJIE_ORGANIZATION_THEME } from './organization';
import { JIUJIE_CONDEMNATION_PATH_MODULE, JIUJIE_EYE_PATH_MODULE } from './paths';
import { JiujieBaseSelectionStrategy } from './strategy';
import { createJiujieBuildSettings } from './shared/buildFacade';
export class JiujieSectModule extends StandardSectModule {
  constructor() { super(JIUJIE_BASE_DEFINITION, [JIUJIE_EYE_PATH_MODULE, JIUJIE_CONDEMNATION_PATH_MODULE], { organizationTheme: JIUJIE_ORGANIZATION_THEME }); }
  protected compileBase(context: SectProjectionContext, builder: SectBuildBuilder): void {
    const settings = createJiujieBuildSettings();
    settings.receiveDuration = 2;
    settings.receiveReduction = 0.80;
    settings.memoryCap = 0.50;
    settings.borrowShieldRatio = 0.10;
    compileJiujieBase(context, builder, settings);
  }
  createBaseSelectionStrategy() { return new JiujieBaseSelectionStrategy(); }
}
export const JIUJIE_MODULE = new JiujieSectModule();

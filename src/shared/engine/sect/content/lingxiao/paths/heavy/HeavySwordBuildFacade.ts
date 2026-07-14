import type {
  SectBuildBuilder,
  SectCompiledBuild,
  SectPathCompileContext,
} from '../../../../core';
import { LINGXIAO_HEAVY_POSTURE } from '../../shared/LingxiaoMechanics';
import {
  buildHeavyAbilities,
  EMPTY_HEAVY_FEATURES,
  type HeavySwordFeatures,
} from './variants';

const HEAVY_BUILD_FACADE = Symbol('heavy-sword-build-facade');

/** 重剑内容私有构建门面，集中维护会互相组合的神通变体。 */
export class HeavySwordBuildFacade {
  private readonly features: HeavySwordFeatures = {
    ...EMPTY_HEAVY_FEATURES,
  };

  constructor(
    private readonly context: SectPathCompileContext,
    private readonly builder: SectBuildBuilder,
    private readonly baseBuild: SectCompiledBuild,
  ) {
    this.refresh();
  }

  enable(feature: keyof HeavySwordFeatures): void {
    this.features[feature] = true;
    this.refresh();
  }

  private refresh(): void {
    this.builder.replaceAbilities(
      buildHeavyAbilities(
        this.baseBuild,
        this.context.realm,
        this.context.path,
        this.features,
      ),
    );
    this.builder.clearResources().setResource({
      id: LINGXIAO_HEAVY_POSTURE,
      name: '剑架',
      initial: this.features.opening ? 2 : 0,
      max: 6,
    });
  }
}

export function initializeHeavySwordBuild(
  context: SectPathCompileContext,
  builder: SectBuildBuilder,
): void {
  const facade = new HeavySwordBuildFacade(context, builder, builder.build());
  builder.setExtension(HEAVY_BUILD_FACADE, facade);
}

export function heavySwordBuild(
  builder: SectBuildBuilder,
): HeavySwordBuildFacade {
  return builder.requireExtension<HeavySwordBuildFacade>(
    HEAVY_BUILD_FACADE,
    '重剑构建门面',
  );
}

import type {
  SectBuildBuilder,
  SectCompiledBuild,
  SectPathCompileContext,
} from '../../../../core';
import { SWIFT_IDLE_ACTIONS } from '../../shared/LingxiaoMechanics';
import {
  buildSwiftAbilities,
  EMPTY_SWIFT_FEATURES,
  type SwiftSwordFeatures,
} from './variants';

const SWIFT_BUILD_FACADE = Symbol('swift-sword-build-facade');

/**
 * 节点只开启一个语义特征，门面负责重建受影响的神通和资源，
 * 因而节点无需了解 AbilityConfig 的深层结构。
 */
export class SwiftSwordBuildFacade {
  private readonly features: SwiftSwordFeatures = {
    ...EMPTY_SWIFT_FEATURES,
  };

  constructor(
    private readonly context: SectPathCompileContext,
    private readonly builder: SectBuildBuilder,
    private readonly baseBuild: SectCompiledBuild,
  ) {
    this.refresh();
  }

  enable(feature: keyof SwiftSwordFeatures): void {
    this.features[feature] = true;
    this.refresh();
  }

  private refresh(): void {
    this.builder.replaceAbilities(
      buildSwiftAbilities(
        this.baseBuild,
        this.context.path,
        this.features,
      ),
    );
    const resource = this.baseBuild.resources[0];
    if (!resource) throw new Error('快剑构筑缺少宗门战斗资源');
    this.builder.clearResources().setResource({
      ...resource,
      initial: this.features.opening ? 2 : 0,
      decayOnNoDirectDamage: 1,
      noDirectDamageActionsPerDecay: 2,
      decayOnControlledSkip: this.features.guardedEdge ? 0 : 1,
      pauseDecayWhenCounterAtLeast: this.features.stillTide
        ? { key: SWIFT_IDLE_ACTIONS, value: 2 }
        : undefined,
    });
  }
}

export function initializeSwiftSwordBuild(
  context: SectPathCompileContext,
  builder: SectBuildBuilder,
): void {
  const facade = new SwiftSwordBuildFacade(context, builder, builder.build());
  builder.setExtension(SWIFT_BUILD_FACADE, facade);
}

export function swiftSwordBuild(
  builder: SectBuildBuilder,
): SwiftSwordBuildFacade {
  return builder.requireExtension<SwiftSwordBuildFacade>(
    SWIFT_BUILD_FACADE,
    '快剑构建门面',
  );
}

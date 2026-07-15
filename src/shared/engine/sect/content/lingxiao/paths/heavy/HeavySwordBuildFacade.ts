import type {
  SectBuildBuilder,
  SectCompiledBuild,
  SectPathCompileContext,
} from '../../../../core';
import { SectAbilityFactory, sectEffects } from '../../../../core';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DamageSource } from '@shared/engine/battle-v5/core/types';
import { LINGXIAO_SECT_ID } from '../../ids';
import { LINGXIAO_SWORD_MOMENTUM } from '../../shared/LingxiaoMechanics';
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
    const resource = this.baseBuild.resources[0];
    if (!resource) throw new Error('重剑构筑缺少宗门战斗资源');
    this.builder.clearResources().setResource({
      ...resource,
      initial: this.features.opening ? 2 : 0,
    });
  }
}

export function initializeHeavySwordBuild(
  context: SectPathCompileContext,
  builder: SectBuildBuilder,
): void {
  const facade = new HeavySwordBuildFacade(context, builder, builder.build());
  builder.setExtension(HEAVY_BUILD_FACADE, facade);
  const factory = new SectAbilityFactory(LINGXIAO_SECT_ID, context.realm);
  builder.addPassive(factory.passive({
    id: 'heavy-shield-momentum',
    name: '大巧不工',
    pathId: context.path.pathId,
    listeners: [{
      id: 'sect.lingxiao.heavy.shield-momentum',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'round' },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { type: 'shield_absorbed_at_least', params: { value: 1 } },
      ],
      effects: [sectEffects.modifyResource(LINGXIAO_SWORD_MOMENTUM, 1)],
    }],
  }));
}

export function heavySwordBuild(
  builder: SectBuildBuilder,
): HeavySwordBuildFacade {
  return builder.requireExtension<HeavySwordBuildFacade>(
    HEAVY_BUILD_FACADE,
    '重剑构建门面',
  );
}

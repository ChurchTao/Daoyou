import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  growthMagnitude,
  nodePercent,
} from '../../../shared/LingxiaoNodeDescription';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';
import { SWIFT_SPLIT_LIGHT_HIT_COEFFICIENT } from '../variants';

export const SWIFT_LAYER_2_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-split-light',
      layerId: '2',
      name: '分光',
      description:
        '《剑荡山河》变为7段攻击并获得3点剑势；每段伤害随《剑气凌霄》成长。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('splitLight'),
    (context) =>
      `《剑荡山河》变为7段攻击，每段造成相当于${nodePercent(growthMagnitude(context, 'sword-guidance', SWIFT_SPLIT_LIGHT_HIT_COEFFICIENT))}物攻的伤害，并获得3点剑势。`,
  ),
  createLingxiaoNode(
    {
      id: 'swift-stacking-waves',
      layerId: '2',
      name: '叠浪',
      description: '施展《剑荡山河》后，其当前冷却减少1回合。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('stackingWaves'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-retained-force',
      layerId: '2',
      name: '留痕',
      description: '《剑荡山河》额外施加1层剑痕，共施加2层。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('retainedForce'),
  ),
] as const;

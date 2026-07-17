import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_2_NODES = [
  createLingxiaoNode(
    { id: 'swift-split-light', layerId: '2', name: '分光', description: '《剑荡山河》变为7段攻击，每段造成相当于23%物攻的伤害，并获得3点剑势。' },
    (_context, builder) => swiftSwordBuild(builder).enable('splitLight'),
  ),
  createLingxiaoNode(
    { id: 'swift-stacking-waves', layerId: '2', name: '叠浪', description: '施展《剑荡山河》后，其当前冷却减少1回合。' },
    (_context, builder) => swiftSwordBuild(builder).enable('stackingWaves'),
  ),
  createLingxiaoNode(
    { id: 'swift-retained-force', layerId: '2', name: '留痕', description: '《剑荡山河》额外施加1层剑痕，共施加2层。' },
    (_context, builder) => swiftSwordBuild(builder).enable('retainedForce'),
  ),
] as const;

import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_2_NODES = [
  createLingxiaoNode(
    { id: 'swift-split-light', layerId: '2', name: '分光', description: '流光五叠改为七段，每段0.27物攻并获得3点剑势。' },
    (_context, builder) => swiftSwordBuild(builder).enable('splitLight'),
  ),
  createLingxiaoNode(
    { id: 'swift-stacking-waves', layerId: '2', name: '叠浪', description: '流光五叠完整命中后减少自身冷却1回合。' },
    (_context, builder) => swiftSwordBuild(builder).enable('stackingWaves'),
  ),
  createLingxiaoNode(
    { id: 'swift-retained-force', layerId: '2', name: '留痕', description: '流光五叠改为施加2层剑痕。' },
    (_context, builder) => swiftSwordBuild(builder).enable('retainedForce'),
  ),
] as const;

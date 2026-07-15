import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_2_NODES = [
  createLingxiaoNode(
    { id: 'heavy-triple-ridge', layerId: '2', name: '蓄岳', description: '不动藏锋的直接减伤由30%提高至40%。' },
    (_context, builder) => heavySwordBuild(builder).enable('chargedReduction'),
  ),
  createLingxiaoNode(
    { id: 'heavy-shattering-armor', layerId: '2', name: '听雷', description: '后发重击由2.60提高至3.10物攻。' },
    (_context, builder) => heavySwordBuild(builder).enable('chargedStrike'),
  ),
  createLingxiaoNode(
    { id: 'heavy-retained-frame', layerId: '2', name: '守心', description: '蓄力被控制取消时获得0.60物攻护盾。' },
    (_context, builder) => heavySwordBuild(builder).enable('chargedFailShield'),
  ),
] as const;

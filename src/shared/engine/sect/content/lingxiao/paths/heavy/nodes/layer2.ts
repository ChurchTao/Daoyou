import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_2_NODES = [
  createLingxiaoNode(
    { id: 'heavy-triple-ridge', layerId: '2', name: '蓄岳', description: '《藏锋听雷》的直接伤害减免由30%提高至40%。' },
    (_context, builder) => heavySwordBuild(builder).enable('chargedReduction'),
  ),
  createLingxiaoNode(
    { id: 'heavy-shattering-armor', layerId: '2', name: '听雷', description: '《藏锋听雷》的后发攻击由220%物攻提高至270%物攻。' },
    (_context, builder) => heavySwordBuild(builder).enable('chargedStrike'),
  ),
  createLingxiaoNode(
    { id: 'heavy-retained-frame', layerId: '2', name: '守心', description: '施展《藏锋听雷》开始蓄势时，获得相当于60%物攻的护盾。' },
    (_context, builder) => heavySwordBuild(builder).enable('chargedGuardShield'),
  ),
] as const;

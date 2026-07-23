import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  growthMagnitude,
  growthStatusMagnitude,
  nodePercent,
} from '../../../shared/LingxiaoNodeDescription';
import { heavySwordBuild } from '../HeavySwordBuildFacade';
import {
  HEAVY_CHARGED_GUARD_SHIELD_COEFFICIENT,
  HEAVY_CHARGED_REDUCTION,
  HEAVY_CHARGED_STRIKE_COEFFICIENT,
} from '../variants';

export const HEAVY_LAYER_2_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-triple-ridge',
      layerId: '2',
      name: '蓄岳',
      description: '提高《藏锋听雷》蓄势期间随《凌虚步》成长的直接伤害减免。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('chargedReduction'),
    (context) =>
      `《藏锋听雷》蓄势期间受到的直接伤害降低${nodePercent(growthStatusMagnitude(context, 'void-step', HEAVY_CHARGED_REDUCTION))}。`,
  ),
  createLingxiaoNode(
    {
      id: 'heavy-shattering-armor',
      layerId: '2',
      name: '听雷',
      description: '提高《藏锋听雷》的后发攻击，并使其共施加2层裂甲。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('chargedStrike'),
    (context) =>
      `《藏锋听雷》的后发《听雷》造成相当于${nodePercent(growthMagnitude(context, 'void-step', HEAVY_CHARGED_STRIKE_COEFFICIENT))}物攻的伤害，并共施加2层裂甲。`,
  ),
  createLingxiaoNode(
    {
      id: 'heavy-retained-frame',
      layerId: '2',
      name: '守心',
      description: '施展《藏锋听雷》开始蓄势时，获得随《凌虚步》成长的护盾。',
    },
    (_context, builder) =>
      heavySwordBuild(builder).enable('chargedGuardShield'),
    (context) =>
      `施展《藏锋听雷》开始蓄势时，获得相当于${nodePercent(growthMagnitude(context, 'void-step', HEAVY_CHARGED_GUARD_SHIELD_COEFFICIENT))}物攻的护盾。`,
  ),
] as const;

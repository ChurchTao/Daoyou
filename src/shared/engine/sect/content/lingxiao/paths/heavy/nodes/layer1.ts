import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  LINGXIAO_HEAVY_POSTURE,
  createArmorRend,
} from '../../../shared/LingxiaoMechanics';
import {
  addHiddenNodePassive,
  addProbingNodePassive,
} from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_1_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-opening',
      layer: 1,
      name: '开山',
      description: '开场获得2点剑架。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('opening'),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-hidden-weight',
      layer: 1,
      name: '藏重',
      description: '首次受到直接伤害降低10%，并获得3点剑架。',
    },
    (context, builder) =>
      addHiddenNodePassive(context, builder, {
        id: 'heavy-hidden-weight',
        name: '藏重',
        resourceId: LINGXIAO_HEAVY_POSTURE,
      }),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-testing-frame',
      layer: 1,
      name: '试架',
      description: '沉锋式每两次命中额外获得1点剑架并施加1层裂甲。',
    },
    (context, builder) =>
      addProbingNodePassive(context, builder, {
        id: 'heavy-testing-frame',
        name: '试架',
        resourceId: LINGXIAO_HEAVY_POSTURE,
        basicAbilityId: 'plain-sword',
        statusEffect: createArmorRend(),
      }),
  ),
] as const;

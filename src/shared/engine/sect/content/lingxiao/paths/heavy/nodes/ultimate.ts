import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { HEAVY_ECHO_COOLDOWN } from '../../../shared/LingxiaoMechanics';
import {
  growthDuration,
  growthMagnitude,
  nodePercent,
} from '../../../shared/LingxiaoNodeDescription';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';
import {
  HEAVY_ECHO_HEAL_RATIO,
  HEAVY_ECHO_SHIELD_COEFFICIENT,
  HEAVY_HEAVEN_CLEAVING_TOTAL_COEFFICIENT,
  HEAVY_IMMOVABLE_COUNTER_COEFFICIENT,
  HEAVY_IMMOVABLE_SHIELD_COEFFICIENT,
} from '../variants';

export const HEAVY_ULTIMATE_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-heaven-cleaving',
      layerId: 'ultimate',
      name: '开天',
      description:
        '《此剑平生》改为仅可在6点剑意时施展，提高随《红尘剑录》成长的总倍率并获得20%穿防；冷却增加1回合。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('heavenCleaving'),
    (context) =>
      `《此剑平生》仅可在6点剑意时施展，当前总倍率为${nodePercent(growthMagnitude(context, 'lingxiao-canon', HEAVY_HEAVEN_CLEAVING_TOTAL_COEFFICIENT))}物攻，并获得20%穿防；冷却增加1回合。`,
  ),
  createLingxiaoNode(
    {
      id: 'heavy-immovable-mountain',
      layerId: 'ultimate',
      name: '不动如山',
      description:
        '《剑心通明》额外提供随《万法不侵》成长的护盾；持续期间每回合可反击一次，造成随该心法成长的伤害。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('immovableMountain'),
    (context) =>
      `《剑心通明》额外提供相当于${nodePercent(growthMagnitude(context, 'origin-returning', HEAVY_IMMOVABLE_SHIELD_COEFFICIENT))}物攻的护盾；未来${growthDuration(context, 'origin-returning', 3)}次自身行动内，每回合首次受到直接伤害时反击，造成相当于${nodePercent(growthMagnitude(context, 'origin-returning', HEAVY_IMMOVABLE_COUNTER_COEFFICIENT))}物攻的伤害。`,
  ),
  createLingxiaoNode(
    {
      id: 'heavy-mountain-river-echo',
      layerId: 'ultimate',
      name: '山河回响',
      description:
        '施展《此剑平生》后恢复气血并获得随《红尘剑录》成长的护盾，每3回合最多触发一次。',
    },
    (context, builder) => {
      heavySwordBuild(builder).enable('mountainRiverEcho');
      addLingxiaoPassive(context, builder, {
        id: 'heavy-mountain-river-echo',
        name: '山河回响',
        listeners: [
          {
            id: 'sect.lingxiao.heavy.echo.tick',
            eventType: GameplayTags.EVENT.ROUND_START,
            scope: GameplayTags.SCOPE.GLOBAL,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(HEAVY_ECHO_COOLDOWN, 'subtract', {
                amount: 1,
              }),
            ],
          },
        ],
        presentationModifiers: [
          {
            abilityId: 'sect-ultimate',
            factRows: ['参悟·山河回响：每3回合最多触发一次'],
          },
        ],
      });
    },
    (context) =>
      `施展《此剑平生》后恢复${nodePercent(growthMagnitude(context, 'lingxiao-canon', HEAVY_ECHO_HEAL_RATIO))}最大气血，并获得相当于${nodePercent(growthMagnitude(context, 'lingxiao-canon', HEAVY_ECHO_SHIELD_COEFFICIENT))}物攻的护盾，每3回合最多触发一次。`,
  ),
] as const;

import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { HEAVY_ECHO_COOLDOWN } from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_ULTIMATE_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-heaven-cleaving',
      layer: 'ultimate',
      name: '开天',
      description: '开天断岳提高至3.5物攻、无视防御且冷却增加1回合。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('heavenCleaving'),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-immovable-mountain',
      layer: 'ultimate',
      name: '不动如山',
      description: '镇山剑罡护盾提高50%，护盾存在时每次姿态可反击一次。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('immovableMountain'),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-mountain-river-echo',
      layer: 'ultimate',
      name: '山河回响',
      description: '收束后恢复气血并获得护盾，每3回合一次。',
    },
    (context, builder) => {
      heavySwordBuild(builder).enable('mountainRiverEcho');
      addLingxiaoPassive(context, builder, {
        id: 'heavy-mountain-river-echo-round',
        name: '山河回响',
        listeners: [
          {
            id: 'sect.lingxiao.heavy-mountain-river-echo-round.tick',
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
      });
    },
  ),
] as const;

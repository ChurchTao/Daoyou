import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { HEAVY_ECHO_COOLDOWN } from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_ULTIMATE_NODES = [
  createLingxiaoNode(
    { id: 'heavy-heaven-cleaving', layerId: 'ultimate', name: '开天', description: '6势时总倍率提高至4.00，30%穿防，冷却增加1回合。' },
    (_context, builder) => heavySwordBuild(builder).enable('heavenCleaving'),
  ),
  createLingxiaoNode(
    { id: 'heavy-immovable-mountain', layerId: 'ultimate', name: '不动如山', description: '山河守心额外给予1.00物攻护盾，持续期间每回合可反击0.60物攻一次。' },
    (_context, builder) => heavySwordBuild(builder).enable('immovableMountain'),
  ),
  createLingxiaoNode(
    { id: 'heavy-mountain-river-echo', layerId: 'ultimate', name: '山河回响', description: '收束后恢复5%最大气血并获得0.80物攻护盾，每3回合一次。' },
    (context, builder) => {
      heavySwordBuild(builder).enable('mountainRiverEcho');
      addLingxiaoPassive(context, builder, {
        id: 'heavy-mountain-river-echo', name: '山河回响', listeners: [{
          id: 'sect.lingxiao.heavy.echo.tick', eventType: GameplayTags.EVENT.ROUND_START,
          scope: GameplayTags.SCOPE.GLOBAL, priority: 0,
          mapping: { caster: 'owner', target: 'owner' },
          effects: [sectEffects.modifyCounter(HEAVY_ECHO_COOLDOWN, 'subtract', { amount: 1 })],
        }],
        presentationModifiers: [{
          abilityId: 'sect-ultimate',
          factRows: ['经脉·山河回响：收束后恢复5%最大气血并获得0.80物攻护盾，每3回合一次'],
        }],
      });
    },
  ),
] as const;

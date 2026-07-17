import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { HEAVY_ECHO_COOLDOWN } from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_ULTIMATE_NODES = [
  createLingxiaoNode(
    { id: 'heavy-heaven-cleaving', layerId: 'ultimate', name: '开天', description: '《剑破万法》在6点剑势时的基础总倍率提高至400%物攻，并获得30%穿防；冷却增加1回合。其他伤害修正仍照常叠加。' },
    (_context, builder) => heavySwordBuild(builder).enable('heavenCleaving'),
  ),
  createLingxiaoNode(
    { id: 'heavy-immovable-mountain', layerId: 'ultimate', name: '不动如山', description: '《剑心通明》额外提供相当于100%物攻的护盾；持续期间每回合可反击一次，造成相当于60%物攻的伤害。' },
    (_context, builder) => heavySwordBuild(builder).enable('immovableMountain'),
  ),
  createLingxiaoNode(
    { id: 'heavy-mountain-river-echo', layerId: 'ultimate', name: '山河回响', description: '施展《剑破万法》后恢复5%最大气血，并获得相当于80%物攻的护盾，每3回合最多触发一次。' },
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
          factRows: ['参悟·山河回响：施展《剑破万法》后恢复5%最大气血，并获得相当于80%物攻的护盾，每3回合最多触发一次'],
        }],
      });
    },
  ),
] as const;

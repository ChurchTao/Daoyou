import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import {
  AttributeType,
  BuffType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  LINGXIAO_SWORD_MOMENTUM,
  createSwordMark,
} from '../../../shared/LingxiaoMechanics';
import {
  addHiddenNodePassive,
  addLingxiaoPassive,
  addProbingNodePassive,
} from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_1_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-opening',
      layerId: '1',
      name: '风起',
      description: '战斗开始时获得2点剑势；首回合身法提高8%。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('opening');
      addLingxiaoPassive(context, builder, {
        id: 'swift-opening',
        name: '风起',
        listeners: [
          {
            id: 'sect.lingxiao.swift-opening.speed',
            eventType: 'BattleInitEvent',
            scope: GameplayTags.SCOPE.GLOBAL,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            budget: { maxTriggers: 1, reset: 'battle' },
            effects: [
              {
                type: 'apply_buff',
                params: {
                  target: 'caster',
                  buffConfig: {
                    id: 'sect.lingxiao.swift-opening-speed',
                    name: '风起',
                    type: BuffType.BUFF,
                    duration: 1,
                    stackRule: StackRule.REFRESH_DURATION,
                    tags: [GameplayTags.BUFF.TYPE.BUFF],
                    modifiers: [
                      {
                        attrType: AttributeType.SPEED,
                        type: ModifierType.ADD,
                        value: 0.08,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      });
    },
  ),
  createLingxiaoNode(
    {
      id: 'swift-hidden-edge',
      layerId: '1',
      name: '敛锋',
      description: '本场战斗首次受到直接伤害时，该次伤害降低10%，并获得3点剑势。',
    },
    (context, builder) =>
      addHiddenNodePassive(context, builder, {
        id: 'swift-hidden-edge',
        name: '敛锋',
        resourceId: LINGXIAO_SWORD_MOMENTUM,
      }),
  ),
  createLingxiaoNode(
    {
      id: 'swift-probing-edge',
      layerId: '1',
      name: '探虚',
      description: '《基础剑式》每累计命中2次，额外获得1点剑势，并施加1层剑痕。',
    },
    (context, builder) =>
      addProbingNodePassive(context, builder, {
        id: 'swift-probing-edge',
        name: '探虚',
        resourceId: LINGXIAO_SWORD_MOMENTUM,
        basicAbilityId: 'plain-sword',
        statusEffect: createSwordMark(),
      }),
  ),
] as const;

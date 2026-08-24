import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  TIANYAN_SECT_ID,
  type TianyanLandingAbilityId,
} from '../ids';

export const TIANYAN_ELEMENTS = [
  'wood',
  'fire',
  'earth',
  'metal',
  'water',
] as const;

export type TianyanElement = (typeof TIANYAN_ELEMENTS)[number];
export type TianyanReactionKind =
  | 'none'
  | 'refresh'
  | 'generation'
  | 'overcoming';

export interface TianyanReactionDefinition {
  oldSeal: TianyanElement;
  incoming: TianyanElement;
  kind: TianyanReactionKind;
  id?:
    | 'wildfire'
    | 'lava'
    | 'forge-edge'
    | 'cold-spring'
    | 'flourish'
    | 'vaporize'
    | 'quagmire'
    | 'root-collapse'
    | 'sever-meridian'
    | 'melt-metal';
  name?: string;
  description?: string;
  mainDamageBonus?: number;
  followUpRatio?: number;
}

export const TIANYAN_ELEMENT_NAMES: Record<TianyanElement, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
};

export const TIANYAN_ELEMENT_ABILITY_TAGS: Record<TianyanElement, string> = {
  wood: GameplayTags.ABILITY.ELEMENT.WOOD,
  fire: GameplayTags.ABILITY.ELEMENT.FIRE,
  earth: GameplayTags.ABILITY.ELEMENT.EARTH,
  metal: GameplayTags.ABILITY.ELEMENT.METAL,
  water: GameplayTags.ABILITY.ELEMENT.WATER,
};

export const TIANYAN_REACTION_ELEMENT_BUFF_TAG =
  GameplayTags.BUFF.SECT.namespace(TIANYAN_SECT_ID, 'element-history');

export const tianyanReactionElementMarkerTag = (
  element: TianyanElement,
): string => GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  `ReactionElement.${element}`,
);

export const TIANYAN_LANDING_BASE_DAMAGE: Record<
  TianyanLandingAbilityId,
  number
> = {
  'verdant-pulse': 0.68,
  'flowing-flame': 0.82,
  'earth-bearing-seal': 0.62,
  'metal-cloud-cutter': 0.88,
  'white-star-breaker': 0.50,
  'dark-water-return': 0.72,
};

export const TIANYAN_ELEMENT_BUFF_TAGS: Record<TianyanElement, string> = {
  wood: GameplayTags.BUFF.ELEMENT.WOOD,
  fire: GameplayTags.BUFF.ELEMENT.FIRE,
  earth: GameplayTags.BUFF.ELEMENT.EARTH,
  metal: GameplayTags.BUFF.ELEMENT.METAL,
  water: GameplayTags.BUFF.ELEMENT.WATER,
};

export const TIANYAN_SEAL_STATE_TAGS: Record<TianyanElement, string> = {
  wood: GameplayTags.STATUS.SECT.state(TIANYAN_SECT_ID, 'ElementSeal.Wood'),
  fire: GameplayTags.STATUS.SECT.state(TIANYAN_SECT_ID, 'ElementSeal.Fire'),
  earth: GameplayTags.STATUS.SECT.state(TIANYAN_SECT_ID, 'ElementSeal.Earth'),
  metal: GameplayTags.STATUS.SECT.state(TIANYAN_SECT_ID, 'ElementSeal.Metal'),
  water: GameplayTags.STATUS.SECT.state(TIANYAN_SECT_ID, 'ElementSeal.Water'),
};

export const TIANYAN_ANY_SEAL_STATE_TAG = GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  'ElementSeal',
);

const GENERATION: Record<TianyanElement, TianyanElement> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
};

const OVERCOMING: Record<TianyanElement, TianyanElement> = {
  wood: 'metal',
  fire: 'water',
  earth: 'wood',
  metal: 'fire',
  water: 'earth',
};

const REACTION_DETAILS = {
  'wood:fire': {
    id: 'wildfire',
    name: '燎原',
    description:
      '木印遇火术时触发：提高本次主伤害，并追加一段火系持续伤害；随后木印转为火印。',
    mainDamageBonus: 0.5,
  },
  'fire:earth': {
    id: 'lava',
    name: '熔岩',
    description:
      '火印遇土术时触发：提高本次主伤害，并施加持续造成火系伤害的「熔岩」；随后火印转为土印。',
    mainDamageBonus: 0.4,
  },
  'earth:metal': {
    id: 'forge-edge',
    name: '锻锋',
    description:
      '土印遇金术时触发：提高本次主伤害，并使本次伤害获得额外穿防；随后土印转为金印。',
    mainDamageBonus: 0.4,
  },
  'metal:water': {
    id: 'cold-spring',
    name: '寒泉',
    description:
      '金印遇水术时触发：提高本次主伤害，并强化本次水术施加的迟滞；随后金印转为水印。',
    mainDamageBonus: 0.4,
  },
  'water:wood': {
    id: 'flourish',
    name: '滋荣',
    description:
      '水印遇木术时触发：提高本次主伤害，并恢复自身气血；随后水印转为木印。',
    mainDamageBonus: 0.4,
  },
  'fire:water': {
    id: 'vaporize',
    name: '蒸发',
    description:
      '火印遇水术时触发：按本次记录伤害追加追击，并清除目标灼烧以追加伤害；随后火印转为水印。',
    followUpRatio: 0.8,
  },
  'water:earth': {
    id: 'quagmire',
    name: '泥沼',
    description:
      '水印遇土术时触发：按本次记录伤害追加土系追击，并尝试使目标定身1回合；随后水印转为土印。',
    followUpRatio: 0.4,
  },
  'earth:wood': {
    id: 'root-collapse',
    name: '崩根',
    description:
      '土印遇木术时触发：按本次记录伤害追加木系追击，并施加2回合「崩根」以降低目标法防；随后土印转为木印。',
    followUpRatio: 0.5,
  },
  'wood:metal': {
    id: 'sever-meridian',
    name: '断脉',
    description:
      '木印遇金术时触发：按本次记录伤害追加金系追击，并尝试使目标禁法1回合；随后木印转为金印。',
    followUpRatio: 0.4,
  },
  'metal:fire': {
    id: 'melt-metal',
    name: '熔金',
    description:
      '金印遇火术时触发：按本次记录伤害追加火系追击，并施加2回合「熔金」以降低目标物攻与法攻；随后金印转为火印。',
    followUpRatio: 0.5,
  },
} as const;

export const TIANYAN_REACTION_MATRIX: readonly TianyanReactionDefinition[] =
  TIANYAN_ELEMENTS.flatMap((oldSeal) =>
    TIANYAN_ELEMENTS.map((incoming): TianyanReactionDefinition => {
      if (oldSeal === incoming) {
        return { oldSeal, incoming, kind: 'refresh' };
      }
      const kind: TianyanReactionKind =
        GENERATION[oldSeal] === incoming
          ? 'generation'
          : OVERCOMING[oldSeal] === incoming
            ? 'overcoming'
            : 'none';
      const detail =
        REACTION_DETAILS[
          `${oldSeal}:${incoming}` as keyof typeof REACTION_DETAILS
        ];
      return { oldSeal, incoming, kind, ...detail };
    }),
  );

export function getTianyanReaction(
  oldSeal: TianyanElement,
  incoming: TianyanElement,
): TianyanReactionDefinition {
  const reaction = TIANYAN_REACTION_MATRIX.find(
    (entry) => entry.oldSeal === oldSeal && entry.incoming === incoming,
  );
  if (!reaction) {
    throw new Error(`天衍反应矩阵缺少 ${oldSeal} → ${incoming}`);
  }
  return reaction;
}

export function nextGeneratingElement(
  element: TianyanElement,
  steps = 1,
): TianyanElement {
  let current = element;
  for (let index = 0; index < steps; index += 1) {
    current = GENERATION[current];
  }
  return current;
}

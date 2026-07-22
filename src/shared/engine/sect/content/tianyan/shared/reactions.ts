import { GameplayTags } from '@shared/engine/shared/tag-domain';

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

export const TIANYAN_ELEMENT_BUFF_TAGS: Record<TianyanElement, string> = {
  wood: GameplayTags.BUFF.ELEMENT.WOOD,
  fire: GameplayTags.BUFF.ELEMENT.FIRE,
  earth: GameplayTags.BUFF.ELEMENT.EARTH,
  metal: GameplayTags.BUFF.ELEMENT.METAL,
  water: GameplayTags.BUFF.ELEMENT.WATER,
};

export const TIANYAN_SEAL_STATE_TAGS: Record<TianyanElement, string> = {
  wood: GameplayTags.STATUS.SECT.state('tianyan', 'ElementSeal.Wood'),
  fire: GameplayTags.STATUS.SECT.state('tianyan', 'ElementSeal.Fire'),
  earth: GameplayTags.STATUS.SECT.state('tianyan', 'ElementSeal.Earth'),
  metal: GameplayTags.STATUS.SECT.state('tianyan', 'ElementSeal.Metal'),
  water: GameplayTags.STATUS.SECT.state('tianyan', 'ElementSeal.Water'),
};

export const TIANYAN_ANY_SEAL_STATE_TAG = GameplayTags.STATUS.SECT.state(
  'tianyan',
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
    id: 'wildfire', name: '燎原', mainDamageBonus: 0.5,
  },
  'fire:earth': {
    id: 'lava', name: '熔岩', mainDamageBonus: 0.4,
  },
  'earth:metal': {
    id: 'forge-edge', name: '锻锋', mainDamageBonus: 0.4,
  },
  'metal:water': {
    id: 'cold-spring', name: '寒泉', mainDamageBonus: 0.4,
  },
  'water:wood': {
    id: 'flourish', name: '滋荣', mainDamageBonus: 0.4,
  },
  'fire:water': {
    id: 'vaporize', name: '蒸发', followUpRatio: 0.8,
  },
  'water:earth': {
    id: 'quagmire', name: '泥沼', followUpRatio: 0.4,
  },
  'earth:wood': {
    id: 'root-collapse', name: '崩根', followUpRatio: 0.5,
  },
  'wood:metal': {
    id: 'sever-meridian', name: '断脉', followUpRatio: 0.4,
  },
  'metal:fire': {
    id: 'melt-metal', name: '熔金', followUpRatio: 0.5,
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

import type { CreationCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';

export type PendingCreationCraftType = Extract<
  CreationCraftType,
  'create_gongfa' | 'create_skill'
>;

export const PENDING_CREATION_CRAFT_TYPES = [
  'create_gongfa',
  'create_skill',
] as const satisfies readonly PendingCreationCraftType[];

export type PendingCreationRouteResolution =
  | { mode: 'invalid_type' }
  | { mode: 'empty' }
  | { mode: 'multiple'; pendingTypes: PendingCreationCraftType[] }
  | { mode: 'typed'; craftType: PendingCreationCraftType }
  | { mode: 'single'; craftType: PendingCreationCraftType };

type PendingCreationConfig = {
  craftType: PendingCreationCraftType;
  label: string;
  creationVerb: string;
  replaceHref: string;
  ownerHref: string;
  ownerLabel: string;
};

export const PENDING_CREATION_CONFIG = {
  create_gongfa: {
    craftType: 'create_gongfa',
    label: '功法',
    creationVerb: '参悟',
    replaceHref: '/game/enlightenment/replace?type=create_gongfa',
    ownerHref: '/game/techniques',
    ownerLabel: '所修功法',
  },
  create_skill: {
    craftType: 'create_skill',
    label: '神通',
    creationVerb: '推演',
    replaceHref: '/game/enlightenment/replace?type=create_skill',
    ownerHref: '/game/skills',
    ownerLabel: '所修神通',
  },
} as const satisfies Record<PendingCreationCraftType, PendingCreationConfig>;

export function isPendingCreationCraftType(
  value: string | null | undefined,
): value is PendingCreationCraftType {
  return PENDING_CREATION_CRAFT_TYPES.includes(
    value as PendingCreationCraftType,
  );
}

export function getPendingCreationConfig(craftType: PendingCreationCraftType) {
  return PENDING_CREATION_CONFIG[craftType];
}

export function getPendingCreationReplaceHref(
  craftType: PendingCreationCraftType,
) {
  return getPendingCreationConfig(craftType).replaceHref;
}

export function getPendingCreationNoticeText(
  craftType: PendingCreationCraftType,
) {
  const config = getPendingCreationConfig(craftType);
  return `已有一门待纳入道基的新${config.label}，请先处理取舍，再继续${config.creationVerb}。`;
}

export function resolvePendingCreationRoute(args: {
  requestedType: string | null | undefined;
  pendingTypes: PendingCreationCraftType[];
}): PendingCreationRouteResolution {
  if (args.requestedType) {
    if (!isPendingCreationCraftType(args.requestedType)) {
      return { mode: 'invalid_type' };
    }
    return { mode: 'typed', craftType: args.requestedType };
  }

  if (args.pendingTypes.length === 0) {
    return { mode: 'empty' };
  }

  if (args.pendingTypes.length === 1) {
    return { mode: 'single', craftType: args.pendingTypes[0]! };
  }

  return { mode: 'multiple', pendingTypes: args.pendingTypes };
}

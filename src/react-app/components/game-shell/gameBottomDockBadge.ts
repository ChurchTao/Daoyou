export type GameDockBadge = boolean | number | null | undefined;

export function shouldShowGameDockBadge(badge: GameDockBadge): boolean {
  return badge === true || (typeof badge === 'number' && badge > 0);
}

export function getCoreDockItemBadge(
  itemId: string,
  input: {
    unreadMailCount: number;
    hasUnallocatedAttributePoints: boolean;
  },
): GameDockBadge {
  if (itemId === 'mail') {
    return input.unreadMailCount;
  }
  if (itemId === 'cultivator') {
    return input.hasUnallocatedAttributePoints;
  }
  return undefined;
}

export type GameDockBadge = boolean | number | null | undefined;

export function shouldShowGameDockBadge(badge: GameDockBadge): boolean {
  return badge === true || (typeof badge === 'number' && badge > 0);
}

export function getCoreDockItemBadge(
  itemId: string,
  input: {
    unreadMailCount: number;
    unreadDirectMessages?: number;
    pendingFriendRequests?: number;
    hasUnallocatedAttributePoints: boolean;
  },
): GameDockBadge {
  if (itemId === 'friends') {
    return (
      input.unreadMailCount ||
      input.unreadDirectMessages ||
      Boolean(input.pendingFriendRequests)
    );
  }
  if (itemId === 'cultivator') {
    return input.hasUnallocatedAttributePoints;
  }
  return undefined;
}

export const SECT_ROOM_NPC_QUERY_KEY = 'npc';

export function createSectRoomNpcHref(href: string, roleKey: string): string {
  const [pathAndQuery, hash = ''] = href.split('#', 2);
  const [path, query = ''] = pathAndQuery.split('?', 2);
  const search = new URLSearchParams(query);
  search.set(SECT_ROOM_NPC_QUERY_KEY, roleKey);
  const suffix = search.size ? `?${search.toString()}` : '';
  return `${path}${suffix}${hash ? `#${hash}` : ''}`;
}

type SectStoryEntry = {
  kind: 'npc' | 'facility';
  id: string;
  name: string;
  cast?: 'receptionist' | 'instructor';
};

const entries: Readonly<Record<string, readonly SectStoryEntry[]>> = {
  gate: [
    { kind: 'facility', id: 'cave-path', name: '回洞府的路' },
    {
      kind: 'npc',
      id: 'register-keeper',
      name: '管名册的执事',
      cast: 'receptionist',
    },
  ],
  arena: [
    { kind: 'npc', id: 'instructor', name: '教习', cast: 'instructor' },
    { kind: 'npc', id: 'neighbor', name: '隔壁同门' },
    { kind: 'facility', id: 'sparring-yard', name: '木人试手场' },
  ],
  archive: [{ kind: 'npc', id: 'keeper', name: '守阁长老' }],
  alchemy: [
    { kind: 'npc', id: 'dispensary-steward', name: '丹房值事' },
    { kind: 'facility', id: 'furnace', name: '宗门丹炉' },
  ],
  cave: [
    { kind: 'facility', id: 'home-door', name: '自己的洞府' },
    { kind: 'npc', id: 'neighbor', name: '隔壁同门' },
  ],
};

export function getSectStoryEntry(
  spotId: string,
  entry: Pick<SectStoryEntry, 'kind' | 'id'>,
): SectStoryEntry | undefined {
  return Object.hasOwn(entries, spotId)
    ? entries[spotId]?.find(
        ({ kind, id }) => entry.kind === kind && entry.id === id,
      )
    : undefined;
}

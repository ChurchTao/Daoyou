import type {
  CultivatorSectPathState,
  SectPathDefinition,
} from '@shared/engine/sect';

export type MeridianSlot = 1 | 2 | 3;
export type MeridianDrafts = Record<MeridianSlot, string[]>;
export type MeridianFooterAction =
  'save' | 'resolve-dirty' | 'activate' | 'current';

const SLOTS: MeridianSlot[] = [1, 2, 3];

export function createMeridianDrafts(
  state?: CultivatorSectPathState,
): MeridianDrafts {
  return Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      [
        ...(state?.meridianLoadouts.find((loadout) => loadout.slot === slot)
          ?.nodeIds ?? []),
      ],
    ]),
  ) as unknown as MeridianDrafts;
}

export function sameNodeIds(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

export function isMeridianDraftDirty(
  drafts: MeridianDrafts,
  saved: MeridianDrafts,
  slot: MeridianSlot,
): boolean {
  return !sameNodeIds(drafts[slot], saved[slot]);
}

export function hasDirtyMeridianDraft(
  drafts: MeridianDrafts,
  saved: MeridianDrafts,
): boolean {
  return SLOTS.some((slot) => isMeridianDraftDirty(drafts, saved, slot));
}

export function getMeridianFooterAction(args: {
  drafts: MeridianDrafts;
  saved: MeridianDrafts;
  slot: MeridianSlot;
  activeSlot: MeridianSlot;
}): MeridianFooterAction {
  if (isMeridianDraftDirty(args.drafts, args.saved, args.slot)) return 'save';
  if (hasDirtyMeridianDraft(args.drafts, args.saved)) return 'resolve-dirty';
  return args.slot === args.activeSlot ? 'current' : 'activate';
}

export function mergeFreshMeridianState(
  drafts: MeridianDrafts,
  saved: MeridianDrafts,
  fresh: MeridianDrafts,
): MeridianDrafts {
  return Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      isMeridianDraftDirty(drafts, saved, slot) ? drafts[slot] : fresh[slot],
    ]),
  ) as unknown as MeridianDrafts;
}

export function toggleMeridianNode(args: {
  path: SectPathDefinition;
  selected: string[];
  nodeId: string;
}): string[] {
  const node = args.path.nodes.find((entry) => entry.id === args.nodeId);
  if (!node) return args.selected;
  if (args.selected.includes(node.id)) {
    return args.selected.filter((id) => id !== node.id);
  }
  return [
    ...args.selected.filter(
      (id) =>
        args.path.nodes.find((candidate) => candidate.id === id)?.layerId !==
        node.layerId,
    ),
    node.id,
  ];
}

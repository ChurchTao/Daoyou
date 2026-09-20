import type { InkButton } from '@app/components/ui/InkButton';
import { getMapNode } from '@shared/lib/game/mapSystem';
import type { ComponentProps } from 'react';

export interface MapNodeAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: ComponentProps<typeof InkButton>['variant'];
}

export type MapIntent = 'world' | 'market' | 'dungeon' | 'sect';

export interface NodeActionContext {
  selectedNodeId: string;
  isMainNode: boolean;
  marketEnabled: boolean;
}

export function resolveMapIntent(value: string | null): MapIntent {
  if (value === 'market' || value === 'sect' || value === 'dungeon')
    return value;
  return 'world';
}

export function buildNodeActions(
  ctx: NodeActionContext,
  navigate: (path: string) => void,
): MapNodeAction[] {
  const node = getMapNode(ctx.selectedNodeId);
  const hasDungeon = !!node?.dungeon_config;
  const actions: MapNodeAction[] = [];
  if (node?.wild_encounter_id)
    actions.push({
      key: 'wild-explore',
      label: '进入野外',
      variant: 'primary',
      onClick: () => navigate(`/game/wild?nodeId=${ctx.selectedNodeId}`),
    });
  if (!ctx.isMainNode && hasDungeon) {
    actions.push({
      key: 'enter-dungeon',
      label: '前往历练',
      variant: 'secondary',
      onClick: () => navigate(`/game/dungeon?nodeId=${ctx.selectedNodeId}`),
    });
  }
  if (ctx.isMainNode && ctx.marketEnabled) {
    actions.unshift({
      key: 'enter-market',
      label: '进入坊市',
      variant: 'primary',
      onClick: () =>
        navigate(`/game/market?nodeId=${ctx.selectedNodeId}&layer=common`),
    });
  }
  return actions;
}

export function buildSectLandmarkActions(
  sectId: string,
  activeSectId: string | null,
  navigate: (path: string) => void,
): MapNodeAction[] {
  if (sectId === activeSectId) {
    return [
      {
        key: 'enter-sect',
        label: '进入宗门',
        variant: 'primary',
        onClick: () => navigate('/game/sect'),
      },
    ];
  }

  return [
    {
      key: 'visit-sect-gate',
      label: '拜访山门',
      variant: 'primary',
      onClick: () => navigate(`/game/sect/${encodeURIComponent(sectId)}/visit`),
    },
  ];
}

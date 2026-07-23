import type { MapNodeDetailAction } from '@app/components/feature/map';

export type MapIntent = 'market' | 'dungeon' | 'sect';

export interface NodeActionContext {
  selectedNodeId: string;
  isMainNode: boolean;
  marketEnabled: boolean;
}

export function resolveMapIntent(value: string | null): MapIntent {
  if (value === 'market' || value === 'sect') return value;
  return 'dungeon';
}

export function buildNodeActions(
  intent: MapIntent,
  ctx: NodeActionContext,
  navigate: (path: string) => void,
): MapNodeDetailAction[] {
  if (intent === 'sect') return [];

  if (intent === 'dungeon') {
    if (ctx.isMainNode) return [];
    return [
      {
        key: 'enter-dungeon',
        label: '前往历练',
        variant: 'primary',
        onClick: () => navigate(`/game/dungeon?nodeId=${ctx.selectedNodeId}`),
      },
    ];
  }

  const actions: MapNodeDetailAction[] = [];
  if (!ctx.isMainNode) {
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
): MapNodeDetailAction[] {
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
      key: 'view-sect-introduction',
      label: '查看介绍',
      variant: 'secondary',
      onClick: () =>
        navigate(`/game/sect/onboarding?sectId=${encodeURIComponent(sectId)}`),
    },
    {
      key: 'visit-sect-gate',
      label: '拜访山门',
      variant: 'primary',
      onClick: () => navigate(`/game/sect/${encodeURIComponent(sectId)}/visit`),
    },
  ];
}

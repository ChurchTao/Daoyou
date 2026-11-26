import { INVASION_NODE_ID, INVASION_PATH } from '@daoyou/game-domain/invasion';
import type { InkButton } from '@app/components/ui/InkButton';
import { BAIXIAO_NODE_ID } from '@daoyou/game-domain/baixiao/meet';
import { CONTEST_NODE_ID } from '@daoyou/game-domain/alchemy/contest';
import type { WorldMapLocation } from '@daoyou/game-domain/world/map';
import type { ComponentProps } from 'react';

export interface MapNodeAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: ComponentProps<typeof InkButton>['variant'];
  gate?: 'dungeon' | 'market';
}

export type MapIntent = 'world' | 'market' | 'dungeon' | 'sect';

export function resolveMapIntent(value: string | null): MapIntent {
  if (value === 'market' || value === 'sect' || value === 'dungeon')
    return value;
  return 'world';
}

export function buildMapLocationActions(
  location: WorldMapLocation,
  activeSectId: string | null,
  navigate: (path: string) => void,
): MapNodeAction[] {
  if ('sect_id' in location)
    return buildSectLandmarkActions(location.sect_id, activeSectId, navigate);

  const nodeId = encodeURIComponent(location.id);
  const actions: MapNodeAction[] = [];
  if (location.id === INVASION_NODE_ID) {
    actions.push({
      key: 'enter-ancient-demon-invasion', label: '进入镇魔营地',
      variant: 'primary', onClick: () => navigate(INVASION_PATH),
    });
  }
  if (location.id === CONTEST_NODE_ID) {
    actions.push({
      key: 'enter-alchemy-contest',
      label: '查看炼丹大会',
      variant: 'primary',
      onClick: () => navigate('/game/alchemy-contest'),
    });
  }
  if (location.id === BAIXIAO_NODE_ID) {
    actions.push({
      key: 'enter-baixiao-meet',
      label: '查看百晓盛会',
      variant: 'primary',
      onClick: () => navigate('/game/baixiao-meet'),
    });
  }
  if (location.wild_encounter_id)
    actions.push({
      key: 'wild-explore',
      label: '进入野外',
      variant: 'primary',
      onClick: () => navigate(`/game/wild?nodeId=${nodeId}`),
    });
  if ('parent_id' in location && location.dungeon_config) {
    actions.push({
      key: 'enter-dungeon',
      label: '前往历练',
      variant: actions.length ? 'secondary' : 'primary',
      gate: 'dungeon',
      onClick: () => navigate(`/game/dungeon?nodeId=${nodeId}`),
    });
  }
  if ('market_config' in location && location.market_config?.enabled) {
    actions.unshift({
      key: 'enter-market',
      label: '进入坊市',
      variant: 'primary',
      gate: 'market',
      onClick: () => navigate(`/game/market?nodeId=${nodeId}&layer=common`),
    });
  }
  return actions;
}

function buildSectLandmarkActions(
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

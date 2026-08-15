import { RoomView } from '@app/components/feature/room';
import type {
  BlackMarketNpcId,
  BlackMarketOverview,
} from '@shared/types/blackMarket';
import type { ReactNode } from 'react';

export function BlackMarketRoom({
  overview,
  selectedNpcId,
  busy,
  detail,
  onSelect,
}: {
  overview: BlackMarketOverview;
  selectedNpcId?: BlackMarketNpcId;
  busy: boolean;
  detail?: ReactNode;
  onSelect(npcId: BlackMarketNpcId): void;
}) {
  return (
    <RoomView
      eyebrow="灯影之外 · 私货无凭"
      description={overview.scene.description}
      actors={overview.npcs.map((npc) => ({
        id: npc.id,
        sigil: npc.sigil,
        name: npc.name,
        identity: npc.identity,
        responsibility: npc.responsibility,
        status: {
          label:
            npc.status === 'completed'
              ? '今日已成交'
              : npc.status === 'in_progress'
                ? '交谈未完'
                : npc.status === 'granted'
                  ? '入场凭证已留'
                : '货物尚在',
          tone:
            npc.status === 'completed'
              ? 'muted'
              : npc.status === 'in_progress'
                ? 'attention'
                : npc.status === 'granted'
                  ? 'attention'
                : 'active',
        },
        disabled: busy,
      }))}
      selectedId={selectedNpcId}
      onSelect={(npcId) => onSelect(npcId as BlackMarketNpcId)}
      detail={detail}
      prompt="选一名摊主，看看他藏着什么"
      promptDetail="点选摊主只会先看清来人；确认走近后，才会揭开货物。"
    />
  );
}

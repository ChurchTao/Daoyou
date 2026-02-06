'use client';

import {
  InkBadge,
  InkButton,
  InkList,
  InkNotice,
} from '@/components/ui';
import { EffectCard } from '@/components/ui/EffectCard';
import type { Artifact } from '@/types/cultivator';
import { getEquipmentSlotInfo } from '@/types/dictionaries';

interface ArtifactsTabProps {
  artifacts: Artifact[];
  equipped: {
    weapon?: string | null;
    armor?: string | null;
    accessory?: string | null;
  };
  pendingId: string | null;
  onShowDetails: (item: Artifact) => void;
  onEquipToggle: (item: Artifact) => void;
  onDiscard: (item: Artifact) => void;
}

/**
 * 法宝 Tab 组件
 */
export function ArtifactsTab({
  artifacts,
  equipped,
  pendingId,
  onShowDetails,
  onEquipToggle,
  onDiscard,
}: ArtifactsTabProps) {
  if (artifacts.length === 0) {
    return <InkNotice>空空如也，道友快去寻宝吧！</InkNotice>;
  }

  return (
    <InkList>
      {artifacts.map((item) => {
        const equippedNow = Boolean(
          item.id &&
          (equipped.weapon === item.id ||
            equipped.armor === item.id ||
            equipped.accessory === item.id),
        );

        const slotInfo = getEquipmentSlotInfo(item.slot);
        return (
          <EffectCard
            key={item.id ?? item.name}
            icon={slotInfo.icon}
            name={item.name}
            quality={item.quality}
            badgeExtra={
              <>
                <InkBadge tone="default">{item.element}</InkBadge>
                <InkBadge tone="default">{slotInfo.label}</InkBadge>
              </>
            }
            meta={
              <div className="flex flex-wrap gap-2 text-xs text-ink-secondary">
                {item.required_realm && (
                  <span>境界要求：{item.required_realm}</span>
                )}
                {equippedNow && (
                  <span className="text-ink font-bold">已装备</span>
                )}
              </div>
            }
            effects={item.effects}
            description={item.description}
            actions={
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  onClick={() => onShowDetails(item)}
                >
                  详情
                </InkButton>
                <InkButton
                  disabled={pendingId === item.id}
                  onClick={() => onEquipToggle(item)}
                >
                  {pendingId === item.id
                    ? '操作中…'
                    : equippedNow
                      ? '卸下'
                      : '装备'}
                </InkButton>
                {!equippedNow && (
                  <InkButton
                    variant="primary"
                    className="px-2"
                    onClick={() => onDiscard(item)}
                  >
                    丢弃
                  </InkButton>
                )}
              </div>
            }
            layout="col"
          />
        );
      })}
    </InkList>
  );
}

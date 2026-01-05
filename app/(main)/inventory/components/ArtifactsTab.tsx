'use client';

import {
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/ui';
import {
  formatStatBonuses,
  getArtifactDisplayInfo,
} from '@/lib/utils/effectDisplay';
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
        const displayInfo = getArtifactDisplayInfo(item);
        const bonusText = formatStatBonuses(displayInfo.statBonuses);
        const effectText = displayInfo.effects.join('\n') || '';

        return (
          <InkListItem
            key={item.id ?? item.name}
            layout="col"
            title={
              <>
                {slotInfo.icon} {item.name} · {item.element}
                <InkBadge tier={item.quality}>{slotInfo.label}</InkBadge>
              </>
            }
            meta={
              <>
                {item.required_realm && (
                  <span className="text-xs text-ink-secondary">
                    境界要求：{item.required_realm}
                  </span>
                )}
                {equippedNow && (
                  <span className="ml-2 text-xs text-ink font-bold">
                    ← 已装备
                  </span>
                )}
              </>
            }
            description={
              <>
                {bonusText}
                {effectText ? `\n${effectText}` : null}
              </>
            }
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
          />
        );
      })}
    </InkList>
  );
}

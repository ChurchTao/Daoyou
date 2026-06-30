import {
  AttributeAllocationControl,
} from '@app/components/feature/cultivator/AttributeAllocationControl';
import { CultivatorAttributeOverview } from '@app/components/feature/cultivator/CultivatorAttributeOverview';
import {
  canSubmitAttributeAllocation,
  createEmptyAttributeDraft,
} from '@app/components/feature/cultivator/attributeAllocationControlLogic';
import { GameSceneFrame, GameSceneSection } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type { Attributes } from '@shared/types/cultivator';
import { useState } from 'react';

export default function CultivatorAttributesPage() {
  const { cultivator, isLoading } = usePlayerStateView();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const [attributeDraft, setAttributeDraft] = useState<Attributes>(
    createEmptyAttributeDraft(),
  );
  const [isAllocatingAttributes, setIsAllocatingAttributes] = useState(false);

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">正在读取根基属性……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚无角色资料，先去觉醒灵根，再来查看根基。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            觉醒灵根
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  const unallocatedAttributePoints =
    cultivator.unallocated_attribute_points ?? 0;

  const handleAllocateAttributes = async () => {
    if (
      !canSubmitAttributeAllocation({
        draft: attributeDraft,
        unallocatedPoints: unallocatedAttributePoints,
        loading: isAllocatingAttributes,
      })
    ) {
      return;
    }

    try {
      setIsAllocatingAttributes(true);
      await mutate(
        fetch('/api/cultivator/attributes/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attributeDraft),
        }),
      );
      setAttributeDraft(createEmptyAttributeDraft());
      pushToast({ message: '根基属性已分配', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '属性分配失败',
        tone: 'danger',
      });
    } finally {
      setIsAllocatingAttributes(false);
    }
  };

  return (
    <GameSceneFrame
      title="根基属性"
      description="五维根基会随境界自然增长，额外获得的可分配点可在此处落定。"
    >
      <GameSceneSection title="分配根基">
        <AttributeAllocationControl
          currentAttributes={cultivator.attributes}
          unallocatedPoints={unallocatedAttributePoints}
          draft={attributeDraft}
          loading={isAllocatingAttributes}
          onChange={setAttributeDraft}
          onSubmit={() => void handleAllocateAttributes()}
        />
      </GameSceneSection>

      <GameSceneSection title="属性详情">
        <CultivatorAttributeOverview
          cultivator={cultivator}
          defaultExpanded
          expandable={false}
        />
      </GameSceneSection>
    </GameSceneFrame>
  );
}

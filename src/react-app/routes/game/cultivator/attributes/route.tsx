import { AttributeAllocationControl } from '@app/components/feature/cultivator/AttributeAllocationControl';
import {
  canSubmitAttributeAllocation,
  createEmptyAttributeDraft,
} from '@app/components/feature/cultivator/attributeAllocationControlLogic';
import { CultivatorAttributeOverview } from '@app/components/feature/cultivator/CultivatorAttributeOverview';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneSection,
} from '@app/components/game-shell';
import { InkModal } from '@app/components/layout/InkModal';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { ATTRIBUTE_RESET_TALISMAN_NAME } from '@shared/config/attributeResetTalisman';
import { CHARACTER_ATTRIBUTE_LABELS } from '@shared/lib/cultivatorDisplay';
import type { Attributes } from '@shared/types/cultivator';
import { useRef, useState } from 'react';

export default function CultivatorAttributesPage() {
  const projection = useCultivatorDisplayProjection();
  const cultivator = projection.data?.cultivator ?? null;
  const isLoading = projection.loading;
  const { mutate } = useResourceMutation();
  const { pushToast, openDialog } = useInkUI();
  const [attributeDraft, setAttributeDraft] = useState<Attributes>(
    createEmptyAttributeDraft(),
  );
  const [isAllocatingAttributes, setIsAllocatingAttributes] = useState(false);
  const [isResettingAttributes, setIsResettingAttributes] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = useRef(false);

  if (isLoading && !cultivator) {
    return <GameSceneLoading message="正在读取根基属性……" />;
  }

  if (projection.error) {
    return <InkNotice>{projection.error}</InkNotice>;
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
    if (busy.current) return;
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
      busy.current = true;
      setIsAllocatingAttributes(true);
      await mutate(
        fetch('/api/cultivator/attributes/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attribute_model_version: 2,
            ...attributeDraft,
          }),
        }),
      );
      setAttributeDraft(createEmptyAttributeDraft());
      setConfirming(false);
      pushToast({ message: '根基属性已分配', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '属性分配失败',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setIsAllocatingAttributes(false);
    }
  };

  const handleResetAttributes = async () => {
    if (busy.current) return;

    try {
      busy.current = true;
      setIsResettingAttributes(true);
      const result = await mutate<{
        refunded_attribute_points: number;
        consumed_talisman_name: string;
      }>(
        fetch('/api/cultivator/attributes/reset', {
          method: 'POST',
        }),
      );
      setAttributeDraft(createEmptyAttributeDraft());
      pushToast({
        message: `已启封${result.consumed_talisman_name}，返还 ${result.refunded_attribute_points} 点可分配属性点`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '属性重置失败',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setIsResettingAttributes(false);
    }
  };

  const openResetConfirm = () => {
    openDialog({
      title: `启封${ATTRIBUTE_RESET_TALISMAN_NAME}`,
      content: (
        <div className="space-y-2 py-2 text-center text-sm leading-7">
          <p>
            将消耗 1 张{ATTRIBUTE_RESET_TALISMAN_NAME}
            ，六维回到当前境界自然成长值。
          </p>
          <p className="text-ink-secondary">
            已投入的自由属性会返还为未分配属性点。
          </p>
        </div>
      ),
      confirmLabel: '确认重置',
      cancelLabel: '再想想',
      loadingLabel: '重置中……',
      onConfirm: handleResetAttributes,
    });
  };

  return (
    <GameSceneFrame
      title="根基属性"
      description="六维根基会随境界自然增长，额外获得的可分配点可在此处落定。"
    >
      <AttributeAllocationControl
        currentAttributes={cultivator.attributes}
        unallocatedPoints={unallocatedAttributePoints}
        draft={attributeDraft}
        loading={isAllocatingAttributes || isResettingAttributes || confirming}
        onChange={setAttributeDraft}
        onSubmit={() => setConfirming(true)}
      />
      <GameSceneSection
        title="当前属性详情"
        actions={
          <InkButton
            variant="primary"
            disabled={
              isResettingAttributes || isAllocatingAttributes || confirming
            }
            onClick={openResetConfirm}
          >
            重置属性点
          </InkButton>
        }
      >
        <CultivatorAttributeOverview
          cultivator={cultivator}
          defaultExpanded
          expandable={false}
        />
      </GameSceneSection>
      <InkModal
        isOpen={confirming}
        title="确认分配根基"
        onClose={() => {
          if (!busy.current) setConfirming(false);
        }}
        footer={
          <div className="flex justify-end gap-3">
            <InkButton
              disabled={isAllocatingAttributes}
              onClick={() => setConfirming(false)}
            >
              返回调整
            </InkButton>
            <InkButton
              pending={isAllocatingAttributes}
              onClick={() => void handleAllocateAttributes()}
            >
              确认分配
            </InkButton>
          </div>
        }
      >
        <p className="text-sm">
          本次消耗{' '}
          <span className="font-mono">
            {Object.values(attributeDraft).reduce(
              (sum, value) => sum + value,
              0,
            )}
          </span>{' '}
          点。确认后如需重新分配，需消耗{ATTRIBUTE_RESET_TALISMAN_NAME}。
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          {(Object.keys(CHARACTER_ATTRIBUTE_LABELS) as (keyof Attributes)[])
            .filter((key) => attributeDraft[key] > 0)
            .map((key) => (
              <div key={key} className="flex justify-between gap-3">
                <dt>{CHARACTER_ATTRIBUTE_LABELS[key]}</dt>
                <dd className="font-mono">
                  {cultivator.attributes[key]} →{' '}
                  <span className="text-teal">
                    {cultivator.attributes[key] + attributeDraft[key]}
                  </span>
                </dd>
              </div>
            ))}
        </dl>
      </InkModal>
    </GameSceneFrame>
  );
}

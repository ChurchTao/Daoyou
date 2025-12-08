'use client';

import { InkBadge, InkButton } from '@/components/InkComponents';
import type { Attributes, Cultivator, EquippedItems } from '@/types/cultivator';
import type { FinalAttributesResult } from '@/utils/cultivatorUtils';
import { GongFaMini, LingGenMini, ShenTongMini } from './';

export type ProbeResultData = {
  cultivator: Cultivator;
  finalAttributes: Attributes;
  attributeBreakdown: FinalAttributesResult['breakdown'];
};

interface ProbeResultModalProps {
  probeResult: ProbeResultData | null;
  onClose: () => void;
}

/**
 * 神识查探结果弹窗组件
 */
export function ProbeResultModal({
  probeResult,
  onClose,
}: ProbeResultModalProps) {
  if (!probeResult) return null;

  const target = probeResult.cultivator;
  const finalAttrs = probeResult.finalAttributes;

  const formatAttrs = (attrs: Attributes) =>
    `体魄${attrs.vitality} / 灵力${attrs.spirit} / 悟性${attrs.wisdom} / 速度${attrs.speed} / 神识${attrs.willpower}`;

  const formatEquipped = (equipped: EquippedItems) =>
    [
      equipped.weapon ? `武器：${equipped.weapon}` : null,
      equipped.armor ? `防具：${equipped.armor}` : null,
      equipped.accessory ? `饰品：${equipped.accessory}` : null,
    ]
      .filter(Boolean)
      .join('；') || '未佩戴法宝';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
      <div className="w-full max-w-3xl bg-paper p-4 shadow max-h-[80vh] overflow-y-auto relative">
        <InkButton
          className="absolute top-4 right-4"
          variant="secondary"
          onClick={onClose}
        >
          关闭
        </InkButton>
        <div className="text-lg font-semibold">
          神识查探：{target.name}{' '}
          <InkBadge tier={target.realm}>{target.realm_stage}</InkBadge>
        </div>
        <div className="text-sm text-ink-secondary">
          基础属性：{formatAttrs(target.attributes)}
        </div>
        <div className="text-sm text-ink-secondary">
          最终属性：{formatAttrs(finalAttrs)}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <LingGenMini
              spiritualRoots={target.spiritual_roots || []}
              title="灵根"
            />
            <div className="space-y-2">
              <div className="text-sm font-semibold">先天命格</div>
              {target.pre_heaven_fates && target.pre_heaven_fates.length > 0 ? (
                <div className="flex flex-col gap-2 text-sm">
                  {target.pre_heaven_fates.map((fate, idx) => (
                    <div
                      key={fate.name + idx}
                      className="flex items-center gap-2"
                    >
                      <span>
                        {fate.type === '吉' ? '🍀' : '😈'} {fate.name}
                      </span>
                      {fate.quality && (
                        <InkBadge tier={fate.quality}>气运</InkBadge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-ink-secondary">无命格信息</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <GongFaMini cultivations={target.cultivations || []} />
            <ShenTongMini skills={target.skills || []} />
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {/* <div>神通上限：{target.max_skills}</div> */}
          <div>佩戴：{formatEquipped(target.equipped)}</div>
        </div>
      </div>
    </div>
  );
}

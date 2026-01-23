'use client';

import { InkModal } from '@/components/layout';
import { InkBadge } from '@/components/ui/InkBadge';
import type { Attributes, Cultivator } from '@/types/cultivator';
import { getEquipmentSlotInfo } from '@/types/dictionaries';
import { GongFaMini, LingGenMini, ShenTongMini } from './';

export type ProbeResultData = {
  cultivator: Cultivator;
  finalAttributes: Attributes;
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

  // 格式化单个属性：基础 → 最终
  const formatAttr = (label: string, base: number, final: number) => {
    if (base === final) {
      return (
        <div className="flex justify-between items-center text-sm p-2 bg-ink/5 rounded">
          <span className="opacity-70">{label}</span>
          <span>{base}</span>
        </div>
      );
    }
    return (
      <div className="flex justify-between items-center text-sm p-2 bg-ink/5 rounded">
        <span className="opacity-70">{label}</span>
        <span>
          {base} <span className="opacity-50">→</span>{' '}
          <span className="text-crimson font-bold">{final}</span>
        </span>
      </div>
    );
  };

  const getEquippedArtifact = (id: string | null) => {
    if (!id || !target.inventory?.artifacts) return null;
    return target.inventory.artifacts.find((a) => a.id === id);
  };

  const weapon = getEquippedArtifact(target.equipped.weapon);
  const armor = getEquippedArtifact(target.equipped.armor);
  const accessory = getEquippedArtifact(target.equipped.accessory);

  const renderEquipmentItem = (
    type: 'weapon' | 'armor' | 'accessory',
    item: ReturnType<typeof getEquippedArtifact>,
  ) => {
    const slotInfo = getEquipmentSlotInfo(type);
    if (!item) {
      return (
        <div className="flex items-center gap-2 text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10">
          <span className="w-4">{slotInfo.icon}</span>
          <span className="opacity-50 ml-2">未佩戴{slotInfo.label}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10">
        <span className="w-4">{slotInfo.icon}</span>
        <InkBadge tier={item.quality}>{item.name}</InkBadge>
      </div>
    );
  };

  return (
    <InkModal
      isOpen={!!probeResult}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>神识查探：{target.name}</span>
          <InkBadge tier={target.realm}>{target.realm_stage}</InkBadge>
        </div>
      }
    >
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 mt-4">
        {/* 属性面板 */}
        <div>
          <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
            基础属性
          </div>
          <div className="grid grid-cols-2 gap-2">
            {formatAttr(
              '体魄',
              target.attributes.vitality,
              finalAttrs.vitality,
            )}
            {formatAttr('灵力', target.attributes.spirit, finalAttrs.spirit)}
            {formatAttr('悟性', target.attributes.wisdom, finalAttrs.wisdom)}
            {formatAttr('速度', target.attributes.speed, finalAttrs.speed)}
            {formatAttr(
              '神识',
              target.attributes.willpower,
              finalAttrs.willpower,
            )}
          </div>
        </div>

        {/* 装备 */}
        <div>
          <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
            佩戴法宝
          </div>
          <div className="space-y-1">
            {renderEquipmentItem('weapon', weapon)}
            {renderEquipmentItem('armor', armor)}
            {renderEquipmentItem('accessory', accessory)}
          </div>
        </div>

        {/* 灵根与命格 */}
        <div className="grid gap-4 md:grid-cols-1">
          <div className="space-y-2">
            <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
              灵根天赋
            </div>
            <LingGenMini
              spiritualRoots={target.spiritual_roots || []}
              title=""
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
              先天命格
            </div>
            {target.pre_heaven_fates && target.pre_heaven_fates.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {target.pre_heaven_fates.map((fate, idx) => (
                  <div
                    key={fate.name + idx}
                    className="bg-ink/5 rounded border border-ink/10"
                  >
                    <InkBadge tier={fate.quality}>{fate.name}</InkBadge>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-ink-secondary">无命格信息</span>
            )}
          </div>
        </div>

        {/* 功法与神通 */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
              所修神通
            </h4>
            <ShenTongMini skills={target.skills || []} title="" />
          </div>
          <div>
            <h4 className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
              修炼功法
            </h4>
            <GongFaMini cultivations={target.cultivations || []} />
          </div>
        </div>
      </div>
    </InkModal>
  );
}

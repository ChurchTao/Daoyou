'use client';

import { useState } from 'react';
import { InkModal, InkSection } from '@/components/layout';
import { InkBadge } from '@/components/ui/InkBadge';
import { InkButton } from '@/components/ui/InkButton';
import { InkList, InkListItem } from '@/components/ui/InkList';
import { InkNotice } from '@/components/ui/InkNotice';
import { formatAllEffects, formatEffectsText } from '@/lib/utils/effectDisplay';
import type { CultivationTechnique } from '@/types/cultivator';

interface GongFaProps {
  cultivations: CultivationTechnique[];
  /** 是否显示在 Section 中，默认 true */
  showSection?: boolean;
  /** 自定义标题，默认 "【所修功法】" */
  title?: string;
}

/**
 * 功法展示组件
 */
export function GongFa({
  cultivations,
  showSection = true,
  title = '【所修功法】',
}: GongFaProps) {
  const [selectedGongFa, setSelectedGongFa] = useState<CultivationTechnique | null>(null);

  if (!cultivations || cultivations.length === 0) {
    if (showSection) {
      return (
        <InkSection title={title}>
          <InkNotice>暂无功法，待闭关参悟。</InkNotice>
        </InkSection>
      );
    }
    return null;
  }

  const content = (
    <InkList>
      {cultivations.map((cult, index) => {
        const effectText = formatEffectsText(cult.effects);
        return (
          <InkListItem
            key={cult.name + index}
            title={
              <div className="flex items-center">
                <span>📜 {cult.name} </span>
                {cult.grade && <InkBadge tier={cult.grade} />}
              </div>
            }
            meta={`需求境界：${cult.required_realm}`}
            description={
              <>
                {effectText}
                {cult.description && (
                  <div className="mt-2 text-sm text-ink-secondary opacity-80 line-clamp-2">
                    {cult.description}
                  </div>
                )}
              </>
            }
            actions={
              <InkButton
                variant="outline"
                onClick={() => setSelectedGongFa(cult)}
              >
                详情
              </InkButton>
            }
          />
        );
      })}
    </InkList>
  );

  if (showSection) {
    return (
      <>
        <InkSection title={title}>{content}</InkSection>
        {selectedGongFa && (
          <GongFaDetailModal
            isOpen={!!selectedGongFa}
            onClose={() => setSelectedGongFa(null)}
            cultivation={selectedGongFa}
          />
        )}
      </>
    );
  }

  return (
    <>
      {content}
      {selectedGongFa && (
        <GongFaDetailModal
          isOpen={!!selectedGongFa}
          onClose={() => setSelectedGongFa(null)}
          cultivation={selectedGongFa}
        />
      )}
    </>
  );
}

export function GongFaMini({
  cultivations,
  title = '功法',
}: Pick<GongFaProps, 'cultivations' | 'title'>) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      {cultivations && cultivations.length > 0 ? (
        <div className="flex flex-col gap-2 text-sm">
          {cultivations.map((cult, index) => (
            <div key={cult.name + index} className="flex items-center gap-2">
              <span>📜 {cult.name}</span>
              {cult.grade && <InkBadge tier={cult.grade} />}
              <span className="text-xs text-ink-secondary">
                需求：{cult.required_realm}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-xs text-ink-secondary">暂无功法</span>
      )}
    </div>
  );
}

interface GongFaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cultivation: CultivationTechnique;
}

/**
 * 功法详情弹窗
 */
export function GongFaDetailModal({
  isOpen,
  onClose,
  cultivation,
}: GongFaDetailModalProps) {
  const effectInfos = formatAllEffects(cultivation.effects);

  return (
    <InkModal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
          <div className="text-4xl mb-2">📜</div>
          <h4 className="text-lg font-bold">{cultivation.name}</h4>
          <div className="flex gap-2 mt-2">
            {cultivation.grade && <InkBadge tier={cultivation.grade} />}
            <InkBadge tone="default">{cultivation.required_realm}</InkBadge>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          {cultivation.description && (
            <div className="pt-2">
              <span className="block opacity-70 mb-1">功法说明</span>
              <p className="indent-4 leading-relaxed opacity-90 p-2 bg-ink/5 rounded-lg border border-ink/10">
                {cultivation.description}
              </p>
            </div>
          )}

          {effectInfos.length > 0 && (
            <div className="pt-2">
              <span className="block opacity-70 mb-1">修炼效果</span>
              <div className="space-y-2">
                {effectInfos.map((info, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 bg-ink/5 rounded-lg border border-ink/10"
                  >
                    {info.icon && (
                      <span className="text-lg flex-shrink-0">{info.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{info.label}</div>
                      <div className="text-xs text-ink-secondary opacity-80">
                        {info.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 flex justify-end">
          <InkButton onClick={onClose} className="w-full">
            关闭
          </InkButton>
        </div>
      </div>
    </InkModal>
  );
}

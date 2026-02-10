'use client';

import { InkSection } from '@/components/layout';
import { EffectCard } from '@/components/ui/EffectCard';
import { InkBadge } from '@/components/ui/InkBadge';
import { InkList } from '@/components/ui/InkList';
import { InkNotice } from '@/components/ui/InkNotice';
import type { CultivationTechnique } from '@/types/cultivator';

interface GongFaProps {
  cultivations: CultivationTechnique[];
  /** 是否显示在 Section 中，默认 true */
  showSection?: boolean;
  /** 自定义标题，默认 "【所修功法】" */
  title?: string;
  /** 是否显示操作按钮，默认 false */
  showActions?: boolean;
  /** 自定义渲染每个功法项的操作按钮 */
  renderAction?: (
    cultivation: CultivationTechnique,
    index: number,
  ) => React.ReactNode;
}

/**
 * 功法展示组件
 */
export function GongFa({
  cultivations,
  showSection = true,
  title = '【所修功法】',
  showActions = false,
  renderAction,
}: GongFaProps) {
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
      {cultivations.map((cult, index) => (
        <EffectCard
          key={cult.id || cult.name + index}
          icon="📜"
          name={cult.name}
          quality={cult.grade}
          badgeExtra={<InkBadge tone="default">{cult.required_realm}</InkBadge>}
          effects={cult.effects}
          description={cult.description}
          actions={
            showActions
              ? renderAction
                ? renderAction?.(cult, index)
                : undefined
              : undefined
          }
          layout={showActions ? 'col' : 'row'}
        />
      ))}
    </InkList>
  );

  if (showSection) {
    return <InkSection title={title}>{content}</InkSection>;
  }

  return content;
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
              <span className="text-ink-secondary text-xs">
                需求：{cult.required_realm}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-ink-secondary text-xs">暂无功法</span>
      )}
    </div>
  );
}

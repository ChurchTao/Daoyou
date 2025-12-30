'use client';

import {
  InkBadge,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/ui';
import { InkSection } from '@/components/layout';
import type { CultivationTechnique } from '@/types/cultivator';
import { formatAttributeBonusMap } from '@/types/dictionaries';

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
        const bonusText = formatAttributeBonusMap(cult.bonus) || '无属性加成';
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
            description={bonusText}
          />
        );
      })}
    </InkList>
  );

  if (showSection) {
    return <InkSection title={title}>{content}</InkSection>;
  }

  return <>{content}</>;
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

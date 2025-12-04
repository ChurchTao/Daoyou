'use client';

import { InkBadge, InkList, InkListItem } from '@/components/InkComponents';
import { InkSection } from '@/components/InkLayout';
import type { SpiritualRoot } from '@/types/cultivator';
import { getElementInfo } from '@/types/dictionaries';

interface LingGenProps {
  spiritualRoots: SpiritualRoot[];
  /** 是否显示在 Section 中，默认 true */
  showSection?: boolean;
  /** 是否使用简化显示（仅显示badge），默认 false */
  compact?: boolean;
  /** 自定义标题，默认 "【灵根】" */
  title?: string;
}

/**
 * 灵根展示组件
 */
export function LingGen({
  spiritualRoots,
  showSection = true,
  compact = false,
  title = '【灵根】',
}: LingGenProps) {
  if (!spiritualRoots || spiritualRoots.length === 0) {
    return null;
  }

  const content = compact ? (
    <div className="flex flex-wrap">
      {spiritualRoots.map((root, idx) => (
        <InkBadge
          tier={root.grade}
          key={`${root.element}-${root.grade}-${idx}`}
        >
          {root.element}
        </InkBadge>
      ))}
    </div>
  ) : (
    <InkList>
      {spiritualRoots.map((root, idx) => (
        <InkListItem
          key={root.element + idx}
          title={
            <div className="flex items-center">
              <span>
                {getElementInfo(root.element).icon} {root.element}
              </span>
              <InkBadge tier={root.grade} />
            </div>
          }
          meta={`强度：${root.strength}`}
        />
      ))}
    </InkList>
  );

  if (showSection) {
    return <InkSection title={title}>{content}</InkSection>;
  }

  return <>{content}</>;
}

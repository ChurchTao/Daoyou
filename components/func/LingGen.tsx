'use client';

import { InkSection } from '@/components/layout';
import { InkBadge, InkButton, InkList, InkListItem } from '@/components/ui';
import { ELEMENT_VALUES } from '@/types/constants';
import type { SpiritualRoot } from '@/types/cultivator';
import { getElementInfo } from '@/types/dictionaries';
import { ReactNode } from 'react';
import { useInkUI } from '../providers/InkUIProvider';

interface LingGenProps {
  spiritualRoots: SpiritualRoot[];
  /** 是否显示在 Section 中，默认 true */
  showSection?: boolean;
  /** 是否使用简化显示（仅显示badge），默认 false */
  compact?: boolean;
  /** 自定义标题，默认 "【灵根】" */
  title?: ReactNode;
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
  const { openDialog } = useInkUI();
  if (!spiritualRoots || spiritualRoots.length === 0) {
    return null;
  }

  const showRootHelp = () => {
    openDialog({
      title: '灵根说明',
      content: (
        <div className="flex flex-col gap-2 text-ink-secondary text-sm">
          <p>灵根是修仙者感应天地灵气的根本。</p>
          <p>
            <span className="text-ink font-bold">属性：</span>
            决定了可修炼的功法属性与法术威力加成（如同属性法术伤害提升）。
          </p>
          <p>
            <span className="text-ink font-bold">强度：</span>
            灵根越纯净（强度越高），修炼速度越快，感应灵气越容易。
          </p>
          <p>单一属性的天灵根修炼速度最快，多属性杂灵根则较慢。</p>
          <p>
            灵根有共有 {ELEMENT_VALUES.join('、')}, 其中 风、雷、冰为变异灵根
          </p>
        </div>
      ),
      confirmLabel: '明悟',
    });
  };

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
    return (
      <InkSection title={title}>
        {content}
        <InkButton onClick={showRootHelp}>💡 灵根说明</InkButton>
      </InkSection>
    );
  }

  return <>{content}</>;
}

export function LingGenMini({
  spiritualRoots,
  title = '灵根',
}: Pick<LingGenProps, 'spiritualRoots' | 'title'>) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <div className="flex flex-wrap gap-2">
        {spiritualRoots && spiritualRoots.length > 0 ? (
          spiritualRoots.map((root, idx) => (
            <InkBadge tier={root.grade} key={`${root.element}-${idx}`}>
              {`${root.element} · ${root.strength}`}
            </InkBadge>
          ))
        ) : (
          <span className="text-xs text-ink-secondary">无灵根信息</span>
        )}
      </div>
    </div>
  );
}

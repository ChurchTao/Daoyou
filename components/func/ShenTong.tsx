'use client';

import { InkSection } from '@/components/layout';
import { EffectCard } from '@/components/ui/EffectCard';
import { InkBadge } from '@/components/ui/InkBadge';
import { InkList } from '@/components/ui/InkList';
import { InkNotice } from '@/components/ui/InkNotice';
import {
  getSkillDisplayInfo,
  getSkillElementInfo,
} from '@/lib/utils/effectDisplay';
import type { Skill } from '@/types/cultivator';

interface ShenTongProps {
  skills: Skill[];
  /** 是否显示在 Section 中，默认 true */
  showSection?: boolean;
  /** 自定义标题，默认 "【所修神通】" */
  title?: string;
  /** 是否显示操作按钮（如替换），默认 false */
  showActions?: boolean;
  /** 是否高亮最后一项，默认 false */
  highlightLast?: boolean;
  /** 是否标记最后一项为新，默认 false */
  markLastAsNew?: boolean;
  /** 自定义渲染每个技能项的操作按钮 */
  renderAction?: (skill: Skill, index: number) => React.ReactNode;
  /** Section 底部的额外内容（如按钮） */
  footer?: React.ReactNode;
}

/**
 * 神通展示组件
 */
export function ShenTong({
  skills,
  showSection = true,
  title = '【所修神通】',
  showActions = false,
  highlightLast = false,
  markLastAsNew = false,
  renderAction,
  footer,
}: ShenTongProps) {
  if (!skills || skills.length === 0) {
    if (showSection) {
      return (
        <InkSection title={title}>
          <InkNotice>暂无神通，待闭关顿悟。</InkNotice>
        </InkSection>
      );
    }
    return null;
  }

  const content = (
    <InkList>
      {skills.map((skill, index) => {
        const { icon: typeIcon, typeName } = getSkillElementInfo(skill);
        const isLast = index === skills.length - 1;
        const displayInfo = getSkillDisplayInfo(skill);

        return (
          <EffectCard
            key={skill.id || skill.name}
            icon={typeIcon}
            name={`${skill.name}`}
            quality={skill.grade}
            badgeExtra={<InkBadge>{typeName}</InkBadge>}
            effects={skill.effects}
            meta={`威力：${displayInfo.power}｜冷却：${skill.cooldown}回合${
              skill.cost ? `｜消耗：${skill.cost} 灵力` : ''
            }`}
            actions={
              showActions
                ? renderAction
                  ? renderAction?.(skill, index)
                  : undefined
                : undefined
            }
            highlight={highlightLast && isLast}
            newMark={markLastAsNew && isLast}
            layout={showActions ? 'col' : 'row'}
          />
        );
      })}
    </InkList>
  );

  if (showSection) {
    return (
      <InkSection title={title}>
        {content}
        {footer}
      </InkSection>
    );
  }

  return (
    <>
      {content}
      {footer}
    </>
  );
}

export function ShenTongMini({
  skills,
  title = '神通',
}: Pick<ShenTongProps, 'skills' | 'title'>) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      {skills && skills.length > 0 ? (
        <div className="flex flex-col gap-2 text-sm">
          {skills.map((skill, idx) => {
            const { icon: typeIcon, typeName } = getSkillElementInfo(skill);
            const displayInfo = getSkillDisplayInfo(skill);
            return (
              <div
                key={skill.id || skill.name + idx}
                className="flex items-center gap-2"
              >
                <span>
                  {typeIcon} {skill.name}·{skill.element}
                </span>
                <InkBadge tier={skill.grade}>{typeName}</InkBadge>
                <span className="text-ink-secondary text-xs">
                  威力{displayInfo.power} 冷却{skill.cooldown}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="text-ink-secondary text-xs">暂无神通</span>
      )}
    </div>
  );
}

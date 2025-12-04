'use client';

import {
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/InkComponents';
import { InkSection } from '@/components/InkLayout';
import type { Skill } from '@/types/cultivator';
import { getSkillTypeInfo, getStatusLabel } from '@/types/dictionaries';

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
        const skillInfo = getSkillTypeInfo(skill.type);
        const typeIcon = skillInfo.icon;
        const typeName = skillInfo.label;
        const isLast = index === skills.length - 1;

        return (
          <InkListItem
            key={skill.id || skill.name}
            title={
              <div className="flex items-center">
                <span>
                  {typeIcon} {skill.name}·{skill.element}
                </span>
                <InkBadge tier={skill.grade}>{typeName}</InkBadge>
              </div>
            }
            description={`威力：${skill.power}｜冷却：${skill.cooldown}回合${
              skill.cost ? `｜消耗：${skill.cost} 灵力` : ''
            }${
              skill.effect
                ? `｜效果：${getStatusLabel(skill.effect)}${
                    skill.duration ? `（${skill.duration}回合）` : ''
                  }`
                : ''
            }`}
            highlight={highlightLast && isLast}
            newMark={markLastAsNew && isLast}
            actions={
              showActions ? (
                renderAction ? (
                  renderAction(skill, index)
                ) : (
                  <InkButton disabled className="text-sm">
                    替换
                  </InkButton>
                )
              ) : undefined
            }
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

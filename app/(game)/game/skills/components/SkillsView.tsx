'use client';

import { InkPageShell } from '@/components/layout';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkDialog,
  InkNotice,
} from '@/components/ui';
import { usePathname } from 'next/navigation';

import { useSkillsViewModel, type V2Skill } from '../hooks/useSkillsViewModel';
import { SkillDetailModal } from './SkillDetailModal';

function SkillCard({
  skill,
  onDetail,
  onForget,
}: {
  skill: V2Skill;
  onDetail: (skill: V2Skill) => void;
  onForget: (skill: V2Skill) => void;
}) {
  return (
    <div className="border-ink/10 space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{skill.name}</span>
        <div className="flex shrink-0 gap-1">
          <InkButton
            variant="secondary"
            className="text-sm"
            onClick={() => onDetail(skill)}
          >
            详情
          </InkButton>
          <InkButton
            className="px-2 text-sm"
            onClick={() => onForget(skill)}
          >
            遗忘
          </InkButton>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {skill.quality && (
          <InkBadge tier={skill.quality as never}>{skill.quality}</InkBadge>
        )}
        {skill.element && (
          <InkBadge tone="default">{skill.element}</InkBadge>
        )}
        <InkBadge tone="default">{`评分 ${skill.score}`}</InkBadge>
      </div>
      {skill.affixes.length > 0 && (
        <ul className="text-ink-secondary space-y-0.5 text-xs">
          {skill.affixes.map((a) => (
            <li key={a.id} className="flex items-center gap-1">
              <span>{a.isPerfect ? '✦' : '◆'}</span>
              <span>{a.name}</span>
              {a.isPerfect && <span className="text-amber-500">（完美）</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 神通主视图组件
 */
export function SkillsView() {
  const pathname = usePathname();
  const {
    cultivator,
    skills,
    isLoading,
    note,
    maxSkills,
    dialog,
    closeDialog,
    selectedSkill,
    isModalOpen,
    openSkillDetail,
    closeSkillDetail,
    openForgetConfirm,
  } = useSkillsViewModel();

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">神通卷轴徐徐展开……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【所修神通】"
      subtitle={`共 ${skills.length}/${maxSkills}`}
      backHref="/game"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回</InkButton>
          <InkButton href="/game/enlightenment" variant="primary">
            藏经阁 →
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈神通？先去首页觉醒吧。</InkNotice>
      ) : skills.length === 0 ? (
        <InkNotice>尚未领悟任何神通，前往藏经阁参悟吧。</InkNotice>
      ) : (
        <>
          <div className="space-y-3">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onDetail={openSkillDetail}
                onForget={openForgetConfirm}
              />
            ))}
          </div>

          <InkDialog dialog={dialog} onClose={closeDialog} />

          <SkillDetailModal
            isOpen={isModalOpen}
            onClose={closeSkillDetail}
            skill={selectedSkill}
          />
        </>
      )}
    </InkPageShell>
  );
}

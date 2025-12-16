'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkDialog,
  InkDialogState,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { InkModal } from '@/components/InkModal';
import { useInkUI } from '@/components/InkUIProvider';
import { ShenTong } from '@/components/func';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { StatusEffect } from '@/types/constants';
import { Skill } from '@/types/cultivator';
import { getSkillTypeInfo, getStatusEffectInfo } from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function SkillsPage() {
  const { cultivator, skills, isLoading, note, refresh } =
    useCultivatorBundle();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { pushToast, openDialog } = useInkUI();
  const pathname = usePathname();

  const handleForget = async (skill: Skill) => {
    if (!cultivator) return;

    try {
      setDialog((prev) => ({
        ...prev!,
        loading: true,
      }));

      const response = await fetch('/api/cultivators/skills/forget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          skillId: skill.id,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '遗忘失败');
      }

      pushToast({ message: `已将【${skill.name}】遗忘`, tone: 'default' });
      await refresh();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '操作失败',
        tone: 'danger',
      });
    } finally {
      setDialog((prev) => ({
        ...prev!,
        loading: false,
      }));
    }
  };

  const showEffectHelp = (effect: StatusEffect) => {
    openDialog({
      title: '神通效果说明',
      content: (
        <div className="text-center py-4 space-y-2">
          <p>{getStatusEffectInfo(effect).description}</p>
        </div>
      ),
      confirmLabel: '了然',
    });
  };

  const openForgetConfirm = (skill: Skill) => {
    setDialog({
      id: 'forget-confirm',
      title: '遗忘神通',
      content: (
        <div className="text-center py-4 space-y-2">
          <p>
            确定要自废{' '}
            <span className="font-bold text-ink-primary">{skill.name}</span>{' '}
            吗？
          </p>
          <p className="text-xs text-ink-secondary">
            此乃逆天之举，遗忘后将无法找回该神通的感悟。
          </p>
        </div>
      ),
      confirmLabel: '自废神通',
      cancelLabel: '不可',
      loadingLabel: '遗忘中...',
      onConfirm: async () => await handleForget(skill),
    });
  };

  const handleShowDetails = (skill: Skill) => {
    setSelectedSkill(skill);
    setIsModalOpen(true);
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">神通卷轴徐徐展开……</p>
      </div>
    );
  }

  const maxSkills = cultivator?.max_skills ?? 3;

  return (
    <InkPageShell
      title="【所修神通】"
      subtitle={`共 ${skills.length}/${maxSkills}`}
      backHref="/"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回</InkButton>
          <InkButton href="/enlightenment" variant="primary">
            藏经阁 →
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈神通？先去首页觉醒吧。</InkNotice>
      ) : (
        <>
          <ShenTong
            skills={skills}
            showSection={false}
            highlightLast={true}
            markLastAsNew={true}
            showActions={true}
            renderAction={(skill) => (
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  className="text-xs"
                  onClick={() => handleShowDetails(skill)}
                >
                  详情
                </InkButton>
                <InkButton
                  className="text-xs px-2"
                  onClick={() => openForgetConfirm(skill)}
                >
                  遗忘
                </InkButton>
              </div>
            )}
          />
          <InkDialog dialog={dialog} onClose={() => setDialog(null)} />

          <InkModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            {selectedSkill && (
              <div className="space-y-2">
                {/* Header */}
                <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
                  <div className="text-4xl mb-2">
                    {getSkillTypeInfo(selectedSkill.type).icon}
                  </div>
                  <h4 className="text-lg font-bold">{selectedSkill.name}</h4>
                  <div className="flex gap-2 mt-2">
                    <InkBadge tier={selectedSkill.grade}>
                      {getSkillTypeInfo(selectedSkill.type).label}
                    </InkBadge>
                    <InkBadge tone="default">{selectedSkill.element}</InkBadge>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="pt-2">
                    <span className="block opacity-70 mb-1">神通威能</span>
                    <div className="grid grid-cols-2! gap-2">
                      <div className="px-2 py-1 bg-ink/5 rounded">
                        威力：{selectedSkill.power}
                      </div>
                      <div className="px-2 py-1 bg-ink/5 rounded">
                        冷却：{selectedSkill.cooldown} 回合
                      </div>
                      <div className="px-2 py-1 bg-ink/5 rounded">
                        消耗：{selectedSkill.cost || 0} 灵力
                      </div>
                      <div className="px-2 py-1 bg-ink/5 rounded">
                        目标：
                        {selectedSkill.target_self ? '自身' : '敌方'}
                      </div>
                    </div>
                  </div>

                  {selectedSkill.effect && (
                    <div className="pt-2">
                      <span className="block opacity-70 mb-1 font-bold text-ink-primary">
                        特殊效果 (点击可了解详情)
                      </span>
                      <div
                        className="flex items-center gap-2 bg-paper-2 p-2 rounded"
                        onClick={() => {
                          showEffectHelp(selectedSkill.effect!);
                        }}
                      >
                        <span>
                          {getStatusEffectInfo(selectedSkill.effect).icon}
                        </span>
                        <span className="font-bold">
                          {getStatusEffectInfo(selectedSkill.effect).label}
                        </span>
                        {selectedSkill.duration && (
                          <span className="text-xs text-ink-secondary">
                            （持续 {selectedSkill.duration} 回合）
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="block opacity-70 mb-1">神通说明</span>
                    <p className="indent-4 leading-relaxed opacity-90 p-2 bg-ink/5 rounded-lg border border-ink/10">
                      {selectedSkill.description ||
                        '此神通玄妙异常，无可奉告。'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <InkButton
                    onClick={() => setIsModalOpen(false)}
                    className="w-full"
                  >
                    关闭
                  </InkButton>
                </div>
              </div>
            )}
          </InkModal>
        </>
      )}
    </InkPageShell>
  );
}

'use client';

import {
  InkActionGroup,
  InkButton,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { ShenTong } from '@/components/func';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { usePathname } from 'next/navigation';

export default function SkillsPage() {
  const { cultivator, skills, isLoading, note } = useCultivatorBundle();
  const pathname = usePathname();

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
          <InkButton href="/ritual" variant="primary">
            闭关顿悟新神通 →
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈神通？先去首页觉醒吧。</InkNotice>
      ) : (
        <ShenTong
          skills={skills}
          showSection={false}
          highlightLast={true}
          markLastAsNew={true}
          showActions={true}
        />
      )}
    </InkPageShell>
  );
}

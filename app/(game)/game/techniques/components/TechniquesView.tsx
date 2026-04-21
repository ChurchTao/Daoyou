'use client';

import { InkPageShell } from '@/components/layout';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkNotice,
} from '@/components/ui';
import { usePathname } from 'next/navigation';

import {
  useTechniquesViewModel,
  type V2Technique,
} from '../hooks/useTechniquesViewModel';
import { TechniqueDetailModal } from './TechniqueDetailModal';

function TechniqueCard({
  technique,
  onDetail,
  onForget,
}: {
  technique: V2Technique;
  onDetail: (t: V2Technique) => void;
  onForget: (t: V2Technique) => void;
}) {
  return (
    <div className="border-ink/10 space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{technique.name}</span>
        <div className="flex shrink-0 gap-1">
          <InkButton
            variant="secondary"
            className="text-sm"
            onClick={() => onDetail(technique)}
          >
            详情
          </InkButton>
          <InkButton className="px-2 text-sm" onClick={() => onForget(technique)}>
            废除
          </InkButton>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {technique.quality && (
          <InkBadge tier={technique.quality as never}>{technique.quality}</InkBadge>
        )}
        {technique.element && (
          <InkBadge tone="default">{technique.element}</InkBadge>
        )}
        <InkBadge tone="default">{`评分 ${technique.score}`}</InkBadge>
      </div>
      {technique.affixes.length > 0 && (
        <ul className="text-ink-secondary space-y-0.5 text-xs">
          {technique.affixes.map((a) => (
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

export function TechniquesView() {
  const pathname = usePathname();
  const {
    cultivator,
    techniques,
    isLoading,
    note,
    selectedTechnique,
    isModalOpen,
    openTechniqueDetail,
    closeTechniqueDetail,
    openForgetConfirm,
  } = useTechniquesViewModel();

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">功法卷轴徐徐展开……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【所修功法】"
      subtitle={`共 ${techniques.length} 部`}
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
        <InkNotice>还未觉醒道身，何谈功法？先去首页觉醒吧。</InkNotice>
      ) : techniques.length === 0 ? (
        <InkNotice>尚未参悟任何功法，前往藏经阁修行吧。</InkNotice>
      ) : (
        <>
          <div className="space-y-3">
            {techniques.map((t) => (
              <TechniqueCard
                key={t.id}
                technique={t}
                onDetail={openTechniqueDetail}
                onForget={openForgetConfirm}
              />
            ))}
          </div>
          <TechniqueDetailModal
            isOpen={isModalOpen}
            onClose={closeTechniqueDetail}
            technique={selectedTechnique}
          />
        </>
      )}
    </InkPageShell>
  );
}

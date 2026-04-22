'use client';

import { InkPageShell } from '@/components/layout';
import { InkActionGroup, InkBadge, InkButton, InkNotice } from '@/components/ui';
import { ItemCard } from '@/components/ui/ItemCard';
import { usePathname } from 'next/navigation';

import {
  useTechniquesViewModel,
  type V2Technique,
} from '../hooks/useTechniquesViewModel';
import { TechniqueDetailModal } from './TechniqueDetailModal';
import { Quality } from '@/types/constants';

function affixToneStyle(rarityTone: string) {
  if (rarityTone === 'legendary') return { color: 'var(--color-tier-shen)' };
  if (rarityTone === 'rare') return { color: 'var(--color-tier-xian)' };
  if (rarityTone === 'info') return { color: 'var(--color-tier-zhen)' };
  return { color: 'var(--color-tier-ling)' };
}

function TechniqueCard({
  technique,
  onDetail,
  onForget,
}: {
  technique: V2Technique;
  onDetail: (t: V2Technique) => void;
  onForget: (t: V2Technique) => void;
}) {
  const affixLine =
    technique.affixes.length > 0
      ? technique.affixes.map((affix) => affix.name).join('、')
      : null;

  return (
    <ItemCard
      icon="📘"
      name={technique.name}
      quality={technique.quality as Quality}
      badgeExtra={
        <div className="flex flex-wrap gap-1">
          {technique.element && (
            <InkBadge tone="default">{technique.element}</InkBadge>
          )}
        </div>
      }
      meta={
        affixLine ? (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-ink-secondary">词缀：</span>
            {technique.affixes.map((affix) => (
              <span key={affix.id} style={affixToneStyle(affix.rarityTone)}>
                {affix.isPerfect ? `极${affix.name}` : affix.name}
              </span>
            ))}
          </div>
        ) : undefined
      }
      description={technique.description}
      actions={
        <div className="flex gap-2">
          <InkButton variant="secondary" onClick={() => onDetail(technique)}>
            详情
          </InkButton>
          <InkButton className="px-2" onClick={() => onForget(technique)}>
            废除
          </InkButton>
        </div>
      }
      layout="col"
    />
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

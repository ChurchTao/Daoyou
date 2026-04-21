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
  useArtifactsViewModel,
  type V2Artifact,
} from '../hooks/useArtifactsViewModel';
import { ArtifactDetailModal } from './ArtifactDetailModal';

const SLOT_LABELS: Record<string, string> = {
  weapon: '武器',
  armor: '防具',
  accessory: '饰品',
};

function ArtifactCard({
  artifact,
  onDetail,
  onToggleEquip,
  onDestroy,
}: {
  artifact: V2Artifact;
  onDetail: (a: V2Artifact) => void;
  onToggleEquip: (a: V2Artifact) => void;
  onDestroy: (a: V2Artifact) => void;
}) {
  return (
    <div className="border-ink/10 space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <span className="font-medium">{artifact.name}</span>
          {artifact.isEquipped && (
            <span className="text-ink-secondary ml-2 text-xs">（已装备）</span>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <InkButton
            variant="secondary"
            className="text-sm"
            onClick={() => onDetail(artifact)}
          >
            详情
          </InkButton>
          <InkButton
            variant={artifact.isEquipped ? 'secondary' : 'primary'}
            className="text-sm"
            onClick={() => onToggleEquip(artifact)}
          >
            {artifact.isEquipped ? '卸下' : '装备'}
          </InkButton>
          <InkButton className="px-2 text-sm" onClick={() => onDestroy(artifact)}>
            销毁
          </InkButton>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {artifact.quality && (
          <InkBadge tier={artifact.quality as never}>{artifact.quality}</InkBadge>
        )}
        {artifact.slot && (
          <InkBadge tone="default">{SLOT_LABELS[artifact.slot] ?? artifact.slot}</InkBadge>
        )}
        {artifact.element && (
          <InkBadge tone="default">{artifact.element}</InkBadge>
        )}
        <InkBadge tone="default">{`评分 ${artifact.score}`}</InkBadge>
      </div>
      {artifact.affixes.length > 0 && (
        <ul className="text-ink-secondary space-y-0.5 text-xs">
          {artifact.affixes.map((a) => (
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

export function ArtifactsView() {
  const pathname = usePathname();
  const {
    cultivator,
    artifacts,
    isLoading,
    note,
    selectedArtifact,
    isModalOpen,
    openArtifactDetail,
    closeArtifactDetail,
    toggleEquip,
    openDestroyConfirm,
  } = useArtifactsViewModel();

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">法宝灵光徐徐显现……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【所炼法宝】"
      subtitle={`共 ${artifacts.length} 件`}
      backHref="/game"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回</InkButton>
          <InkButton href="/game/craft/refine" variant="primary">
            炼器台 →
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何来法宝？先去首页觉醒吧。</InkNotice>
      ) : artifacts.length === 0 ? (
        <InkNotice>尚未炼制任何法宝，前往炼器台一展身手吧。</InkNotice>
      ) : (
        <>
          <div className="space-y-3">
            {artifacts.map((a) => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                onDetail={openArtifactDetail}
                onToggleEquip={toggleEquip}
                onDestroy={openDestroyConfirm}
              />
            ))}
          </div>
          <ArtifactDetailModal
            isOpen={isModalOpen}
            onClose={closeArtifactDetail}
            artifact={selectedArtifact}
          />
        </>
      )}
    </InkPageShell>
  );
}

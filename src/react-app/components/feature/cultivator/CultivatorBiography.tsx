import { TitleEditorModal } from '@app/components/feature/cultivator/TitleEditorModal';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import { FateDetailModal } from '@app/components/feature/fates/FateDetailModal';
import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import { FateEffectInlineList } from '@app/components/feature/fates/FateEffectInlineList';
import { LingGen } from '@app/components/func/LingGen';
import { GameSceneSection } from '@app/components/game-shell/GameSceneSection';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkButton,
  InkDialog,
  InkList,
  InkNotice,
  type InkDialogState,
} from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { cn } from '@shared/lib/cn';
import type { Cultivator } from '@shared/types/cultivator';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

function OverviewDetailItem({
  icon,
  label,
  value,
  action,
  className,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 text-sm leading-7',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="shrink-0 text-base leading-7" aria-hidden="true">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5">
          <span className="text-battle-muted shrink-0">{label}</span>
          <span className="text-ink min-w-0 flex-1">{value}</span>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CultivatorBiography() {
  const projection = useCultivatorDisplayProjection();
  const cultivator = projection.data?.cultivator ?? null;
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [detailFate, setDetailFate] = useState<
    Cultivator['pre_heaven_fates'][number] | null
  >(null);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  if (projection.error) return <InkNotice>{projection.error}</InkNotice>;
  if (projection.loading && !cultivator)
    return <InkNotice>正在读取角色属性……</InkNotice>;

  if (!cultivator) {
    return <InkNotice>尚无角色资料，先去觉醒灵根，再来凝视真形。</InkNotice>;
  }

  const handleReincarnate = async () => {
    try {
      await mutate(
        fetch('/api/cultivator/active-reincarnate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      navigate('/game/reincarnate');
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : '兵解失败',
        tone: 'danger',
      });
    }
  };

  const handleSaveTitle = async () => {
    if (
      editingTitle.length > 0 &&
      (editingTitle.length < 2 || editingTitle.length > 8)
    ) {
      pushToast({ message: '称号长度需在2-8字之间', tone: 'warning' });
      return;
    }

    try {
      setIsSavingTitle(true);
      await mutate(
        fetch('/api/cultivator/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editingTitle || null,
          }),
        }),
      );

      pushToast({ message: '名号已定，威震八方！', tone: 'success' });
      setIsTitleModalOpen(false);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存失败',
        tone: 'danger',
      });
    } finally {
      setIsSavingTitle(false);
    }
  };

  const openTitleEditor = () => {
    setEditingTitle(cultivator.title || '');
    setIsTitleModalOpen(true);
  };

  const openReincarnateDialog = () => {
    setDialog({
      id: 'reincarnate-confirm',
      title: '轮回重修',
      content: (
        <div className="space-y-2">
          <p className="text-crimson text-lg font-bold">道友当真要轮回重修？</p>
          <p>
            轮回后，当前修为将尽数散去，
            <span className="text-crimson">角色状态变为「已陨落」</span>。
          </p>
          <p>但可保留部分前世记忆（名字、故事）进入轮回，开启新的一世。</p>
          <p className="text-sm opacity-60">此操作不可撤销。</p>
        </div>
      ),
      confirmLabel: '轮回',
      cancelLabel: '不可',
      onConfirm: handleReincarnate,
    });
  };

  return (
    <div className="space-y-5">
      <GameSceneSection title="生平" contentClassName="space-y-2.5">
        <div className="space-y-1">
          <OverviewDetailItem
            icon="👤"
            label="出身"
            value={`${cultivator.gender} · ${cultivator.origin || '散修'}`}
          />
          <OverviewDetailItem
            icon="🏮"
            label="名号"
            value={
              cultivator.title ? (
                <span className="text-crimson">「{cultivator.title}」</span>
              ) : (
                '暂无'
              )
            }
            action={
              <InkButton onClick={openTitleEditor} className="text-sm">
                修改
              </InkButton>
            }
          />
          <OverviewDetailItem
            icon="🫧"
            label="性情"
            value={cultivator.personality || '未明'}
          />
          <OverviewDetailItem
            icon="📜"
            label="背景"
            value={cultivator.background || '未录'}
          />
          {cultivator.balance_notes ? (
            <OverviewDetailItem
              icon="🪶"
              label="天道评语"
              value={cultivator.balance_notes}
            />
          ) : null}
        </div>
      </GameSceneSection>

      <LingGen
        spiritualRoots={cultivator.spiritual_roots || []}
        title="灵根"
        sectionVariant="scene"
      />

      {cultivator.pre_heaven_fates?.length > 0 ? (
        <GameSceneSection title="先天命格">
          <InkList>
            {cultivator.pre_heaven_fates.map((fate, idx) => {
              const fateDisplay = toFateDisplayModel(fate);
              return (
                <ItemCard
                  key={fate.name + idx}
                  name={fate.name}
                  quality={fate.quality}
                  meta={
                    <FateEffectInlineList lines={fateDisplay.previewLines} />
                  }
                  description={fate.description}
                  actions={
                    <InkButton
                      variant="secondary"
                      onClick={() => setDetailFate(fate)}
                    >
                      详情
                    </InkButton>
                  }
                  layout="col"
                />
              );
            })}
          </InkList>
        </GameSceneSection>
      ) : null}

      <div className="bg-ink/5 rounded-sm p-2 text-right">
        <p className="text-ink-secondary text-sm leading-7">
          若此身道途已尽，可舍去此生，重入轮回。
        </p>
        <InkButton className="text-sm" onClick={openReincarnateDialog}>
          转世重修
        </InkButton>
      </div>
      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
      <FateDetailModal
        isOpen={detailFate !== null}
        onClose={() => setDetailFate(null)}
        fate={detailFate}
      />
      <TitleEditorModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        isSaving={isSavingTitle}
        onSave={() => void handleSaveTitle()}
      />
    </div>
  );
}

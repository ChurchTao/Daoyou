import { getSectIdentityLabels } from '@app/components/feature/sect/sectIdentityDisplay';
import { useActiveSectContextQuery } from '@app/components/feature/sect/sectResources';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useState } from 'react';
import { TitleEditorModal } from './TitleEditorModal';
import type { CultivatorDisplayProjection } from './useCultivatorDisplayProjection';

export function CultivatorIdentity({
  cultivator,
}: Pick<CultivatorDisplayProjection, 'cultivator'>) {
  const sect = useActiveSectContextQuery();
  const identity = sect.data ? getSectIdentityLabels(sect.data) : null;
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

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
          body: JSON.stringify({ title: editingTitle || null }),
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

  return (
    <>
      <section
        aria-label="人物身份"
        className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-4 md:grid-cols-[7.5rem_minmax(0,1fr)] md:gap-5"
      >
        <GameIcon
          value={
            cultivator.gender === '女'
              ? 'icon:cultivator-female-avatar'
              : 'icon:cultivator-male-avatar'
          }
          label={`${cultivator.name}的墨像`}
          className="h-[6.75rem] w-[5.25rem] md:h-[8.75rem] md:w-[7.5rem]"
        />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold break-words">
            {cultivator.name}
          </h2>
          <div className="text-ink-secondary flex flex-wrap items-center gap-x-3">
            <span className="break-words">
              {cultivator.title || '暂无名号'}
            </span>
            <InkButton
              className="min-h-11 p-0 text-sm"
              onClick={() => {
                setEditingTitle(cultivator.title || '');
                setIsTitleModalOpen(true);
              }}
            >
              修改名号
            </InkButton>
          </div>
          <dl className="space-y-1">
            <div className="flex gap-3">
              <dt className="text-ink-secondary shrink-0">境界</dt>
              <dd>
                {cultivator.realm} · {cultivator.realm_stage}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-ink-secondary shrink-0">宗门</dt>
              <dd>
                {sect.error
                  ? '宗门信息暂不可用'
                  : sect.loading && !sect.data
                    ? '读取中……'
                    : identity
                      ? `${identity.sectName} · ${identity.rankLabel}`
                      : '散修'}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-ink-secondary shrink-0">寿元</dt>
              <dd>
                <span className="font-mono">
                  {cultivator.age} / {cultivator.lifespan}
                </span>{' '}
                年
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <TitleEditorModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        isSaving={isSavingTitle}
        onSave={() => void handleSaveTitle()}
      />
    </>
  );
}

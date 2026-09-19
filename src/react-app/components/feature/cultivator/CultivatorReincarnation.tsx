import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkDialog, type InkDialogState } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function CultivatorReincarnation() {
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
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
    <>
      <div className="bg-ink/3 flex flex-wrap items-center justify-between gap-3 rounded-sm p-4">
        <p className="text-ink-secondary text-sm leading-7">
          若此身道途已尽，可舍去此生，重入轮回。
        </p>
        <InkButton className="text-sm" onClick={openReincarnateDialog}>
          转世重修
        </InkButton>
      </div>
      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

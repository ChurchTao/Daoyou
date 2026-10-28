import { InkModal } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { ApiSuccess } from '@daoyou/contracts/http';
import type { CharacterCard } from '@daoyou/contracts/player/card';
import { useEffect, useState, type ReactNode } from 'react';
import { CharacterCardView } from './CharacterCardView';

export function CharacterCardTrigger({
  id,
  name,
  children,
  onSelectFriend,
}: {
  id: string;
  name: string;
  children: ReactNode;
  onSelectFriend?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [card, setCard] = useState<CharacterCard | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const close = () => {
    setOpen(false);
    setDetailOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchJsonCached<ApiSuccess<CharacterCard>>(`/api/cultivator/${id}/card`, {
      key: `character-card:${id}`,
      ttlMs: 5000,
    })
      .then((response) => {
        if (!cancelled) {
          setCard(response.data);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : '名片读取失败');
      });
    return () => {
      cancelled = true;
    };
  }, [id, open, attempt]);

  return (
    <>
      <button
        type="button"
        aria-label={`查看${name}的名片`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="focus-visible:outline-crimson min-w-0 cursor-pointer p-0 text-left underline-offset-2 hover:underline"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <InkModal isOpen={open} onClose={close} className="max-w-sm">
        <div className="bg-bgpaper sticky top-0 z-10 mb-2 flex items-center justify-between text-xs">
          <span className="text-ink-secondary">道友名片</span>
          <button
            type="button"
            aria-label="关闭名片"
            className="-mt-2 flex size-9 items-center justify-center text-lg"
            onClick={close}
          >
            ×
          </button>
        </div>
        {error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>{error}</p>
            <InkButton
              onClick={() => {
                setError('');
                setAttempt((value) => value + 1);
              }}
            >
              重试
            </InkButton>
          </div>
        ) : card ? (
          <CharacterCardView card={card} onDetailChange={setDetailOpen} />
        ) : (
          <p className="text-ink-secondary py-4 text-sm">正在展开名片……</p>
        )}
        {card && onSelectFriend && !detailOpen ? (
          <div className="border-ink/15 mt-3 border-t pt-2">
            <InkButton
              onClick={() => {
                close();
                onSelectFriend(id);
              }}
            >
              收录道友
            </InkButton>
          </div>
        ) : null}
      </InkModal>
    </>
  );
}

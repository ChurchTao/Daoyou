import { InkButton } from '@app/components/ui/InkButton';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { ApiSuccess } from '@daoyou/contracts/http';
import type { CharacterCard } from '@daoyou/contracts/player/card';
import { useEffect, useState, type ReactNode } from 'react';
import { CharacterCardView } from './CharacterCardView';

export function CharacterCardContent({
  id,
  fallback,
  onDetailChange,
  actions,
}: {
  id: string;
  fallback?: ReactNode;
  onDetailChange?: (open: boolean) => void;
  actions?: ReactNode;
}) {
  const [card, setCard] = useState<CharacterCard | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchJsonCached<ApiSuccess<CharacterCard>>(`/api/cultivator/${id}/card`, {
      key: `character-card:${id}`,
      ttlMs: 5000,
    })
      .then((response) => {
        if (!cancelled) setCard(response.data);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : '名片读取失败');
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (card) {
    return (
      <>
        <CharacterCardView card={card} onDetailChange={onDetailChange} />
        {actions}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {fallback}
      {error ? (
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <p role="alert" className="text-ink-secondary">
            {error}
          </p>
          <InkButton
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}
          >
            重试
          </InkButton>
        </div>
      ) : (
        <p role="status" className="text-ink-secondary py-2 text-sm">
          正在展开名片……
        </p>
      )}
    </div>
  );
}

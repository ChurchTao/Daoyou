import { InkButton } from '@app/components/ui/InkButton';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { ApiSuccess } from '@daoyou/contracts/http';
import type { CharacterCard } from '@daoyou/contracts/player/card';
import { useEffect, useState, type ReactNode } from 'react';
import { CharacterCardView } from './CharacterCardView';

export function CharacterCardContent({
  id,
  path,
  fallback,
  actions,
}: {
  id: string;
  path?: string;
  fallback?: ReactNode;
  actions?: ReactNode;
}) {
  const [card, setCard] = useState<CharacterCard | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const request = path ? new AbortController() : undefined;
    fetchJsonCached<ApiSuccess<CharacterCard>>(
      path ?? `/api/cultivator/${id}/card`,
      {
        key: path ?? `character-card:${id}`,
        ttlMs: path ? 0 : 5000,
        signal: request?.signal,
      },
    )
      .then((response) => {
        if (!cancelled) setCard(response.data);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : '名片读取失败');
      });
    return () => {
      cancelled = true;
      request?.abort();
    };
  }, [id, path, attempt]);

  if (card) {
    return (
      <>
        <CharacterCardView card={card} />
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

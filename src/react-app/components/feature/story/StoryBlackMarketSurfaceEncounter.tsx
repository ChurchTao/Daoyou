import { InkBadge, InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useStorySurface } from '@app/lib/hooks/useStorySurface';
import type { StorySurfaceBlackMarketEntry } from '@shared/types/story';
import { useState } from 'react';

export function StoryBlackMarketSurfaceEncounter({
  entry,
  onResolved,
}: {
  entry: StorySurfaceBlackMarketEntry;
  onResolved(): void;
}) {
  const { interact } = useStorySurface('black-market.room');
  const [probe, setProbe] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const selectedProbe = entry.probes?.find((item) => item.id === probe);

  const resolve = async (interactionId: string) => {
    if (busy) return;
    setBusy(interactionId);
    try {
      await interact(interactionId);
      onResolved();
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="min-h-[32rem] space-y-5 px-5 py-7 sm:px-8 md:px-10">
      <div>
        <p className="text-ink-secondary text-xs tracking-[0.2em]">{entry.eyebrow}</p>
        <h3 className="mt-1 text-xl font-semibold">{entry.title}</h3>
        <p className="text-ink-secondary mt-2 text-sm leading-7">{entry.intro}</p>
      </div>

      {entry.objectName ? (
        <InkCard className="space-y-3 border border-current/15 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{entry.objectName}</span>
            <InkBadge tone="warning">剧情异物</InkBadge>
          </div>
          {entry.objectDescription ? (
            <p className="text-sm leading-7">{entry.objectDescription}</p>
          ) : null}
          {!probe && entry.probes?.length ? (
            <div className="flex flex-wrap gap-2">
              {entry.probes.map((item) => (
                <InkButton key={item.id} variant="secondary" onClick={() => setProbe(item.id)}>
                  {item.label}
                </InkButton>
              ))}
            </div>
          ) : null}
        </InkCard>
      ) : null}

      {selectedProbe ? (
        <div className="space-y-2 text-sm leading-8">
          {selectedProbe.dialogue.map((line) => <p key={line}>{line}</p>)}
        </div>
      ) : null}

      {(selectedProbe || !entry.probes?.length) && entry.interjection?.length ? (
        <>
          {entry.objectName ? <InkNotice tone="warning">摊前的气氛忽然变了。</InkNotice> : null}
          <div className="space-y-2 border-l-2 border-current/20 pl-4 text-sm leading-8">
            {entry.interjection.map((line) => <p key={line}>{line}</p>)}
          </div>
        </>
      ) : null}

      {(selectedProbe || !entry.probes?.length) ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {entry.actions.map((action) => (
            <InkButton
              key={action.id}
              variant={action.variant ?? 'secondary'}
              pending={busy === action.id}
              disabled={Boolean(busy)}
              onClick={() => void resolve(action.id)}
            >
              {action.label}
            </InkButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}

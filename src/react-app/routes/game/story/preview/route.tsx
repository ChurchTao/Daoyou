import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton, InkInput } from '@app/components/ui';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { listPerformanceScripts, getPerformanceScript } from '@shared/performance/catalog';
import { fillPerformanceScript, type PerformanceContext } from '@shared/performance/schema';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

function readScript(scriptId: string) {
  try {
    return getPerformanceScript(scriptId);
  } catch {
    return null;
  }
}

function watchContext(
  requires: string[],
  cultivator: { name: string; background?: string | null },
): PerformanceContext {
  const context: PerformanceContext = {
    name: cultivator.name,
    background: cultivator.background?.trim() || '尚无来处',
  };
  for (const key of requires) {
    if (!context[key]?.trim()) {
      throw new Error(`这场演出还要填上「${key}」`);
    }
  }
  return context;
}

function PreviewShelf({
  scriptId,
  note,
}: {
  scriptId: string;
  note?: string;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(scriptId);
  const scripts = listPerformanceScripts();

  const open = (id: string) => {
    const next = id.trim();
    if (!next) return;
    navigate(`/game/story/preview/${encodeURIComponent(next)}`);
  };

  return (
    <div className="app-safe-area-page mx-auto flex min-h-[100svh] w-full max-w-xl flex-col bg-paper px-6 py-8 text-ink">
      <h1 className="font-heading text-4xl">看演出</h1>
      <p className="mt-3 text-sm leading-7 text-ink-secondary">只看这一遍，不记进度。</p>
      {note ? <p className="mt-4 text-sm leading-7 text-crimson">{note}</p> : null}
      <form
        className="mt-8 flex items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          open(draft);
        }}
      >
        <div className="min-w-0 flex-1">
          <InkInput
            label="演出编号"
            value={draft}
            placeholder="arrival-fall"
            onChange={setDraft}
          />
        </div>
        <InkButton type="submit" variant="primary">
          去看
        </InkButton>
      </form>
      <ul className="mt-8 space-y-4">
        {scripts.length === 0 ? (
          <li className="text-sm leading-7 text-ink-secondary">还没有可看的演出。</li>
        ) : (
          scripts.map((script) => (
            <li key={script.id}>
              <InkButton href={`/game/story/preview/${encodeURIComponent(script.id)}`}>
                {script.title}
              </InkButton>
              <p className="mt-1 text-sm text-ink-secondary">{script.id}</p>
            </li>
          ))
        )}
      </ul>
      <InkButton href="/game" className="mt-10 self-start" variant="secondary">
        回洞府
      </InkButton>
    </div>
  );
}

export default function StoryPreviewRoute() {
  const navigate = useNavigate();
  const scriptId = useParams().scriptId ?? '';
  const profile = useCultivatorIdentity();
  const [replay, setReplay] = useState(0);
  const script = scriptId ? readScript(scriptId) : null;

  if (!scriptId || !script) {
    return (
      <PreviewShelf
        scriptId={scriptId}
        note={scriptId ? `没有「${scriptId}」这场演出。` : undefined}
      />
    );
  }

  if (profile.loading) {
    return <GameLoadingState variant="fullscreen" message="玉简还在显字……" />;
  }

  const cultivator = profile.data?.cultivator;
  if (profile.error || !cultivator) {
    return (
      <PreviewShelf scriptId={scriptId} note="玉简暂时读不清。" />
    );
  }

  let filled: ReturnType<typeof fillPerformanceScript>;
  let context: PerformanceContext;
  try {
    context = watchContext(script.requires, cultivator);
    filled = fillPerformanceScript(script, context);
  } catch (reason) {
    return (
      <PreviewShelf
        scriptId={scriptId}
        note={reason instanceof Error ? reason.message : '这场演出读不开。'}
      />
    );
  }

  return (
    <PerformancePlayer
      key={`${filled.id}:${replay}`}
      script={filled}
      context={context}
      finalLabel="再看一遍"
      exitLabel="返回"
      onExit={() => navigate('/game/story/preview')}
      onFinish={() => setReplay((count) => count + 1)}
    />
  );
}

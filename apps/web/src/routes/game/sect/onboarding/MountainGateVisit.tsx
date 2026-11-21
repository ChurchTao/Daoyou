import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { fillStoryScript } from '@app/lib/story/performanceContext';
import {
  createMountainGateArrival,
  getMineGateStudy,
} from '@daoyou/game-content/performance/catalog';
import type { PerformanceContext } from '@daoyou/game-domain/performance';
import type { StoryView } from '@daoyou/game-domain/story';
import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import {
  beginSectJoinAttempt,
  createSectJoinAttemptState,
  finishSectJoinAttempt,
} from './sectJoinAttempt';

export function MountainGateVisit({
  sectId,
  sectName,
  activeSectId,
  admissionBlock,
  portrait,
  context,
  origin,
  storyEntry,
  checkpoint,
  chapterVisit,
}: {
  sectId: string;
  sectName: string;
  activeSectId: string | null;
  admissionBlock?: string;
  portrait: string;
  context: PerformanceContext;
  origin: string;
  storyEntry: boolean;
  checkpoint?: StoryView;
  chapterVisit: boolean;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const joinAttempt = useRef(createSectJoinAttemptState());
  const back = () => navigate(origin, { replace: true });
  const [admission] = useState<'join' | 'member' | 'visit'>(() =>
    activeSectId === sectId
      ? 'member'
      : activeSectId || admissionBlock
        ? 'visit'
        : 'join',
  );
  const backLabel =
    checkpoint?.chapterId === 'mine-gate' ? '回接引亭' : '再看看别家';

  if (storyEntry && !chapterVisit && !saving) {
    return <Navigate to={checkpoint?.href ?? '/game'} replace />;
  }
  if (!storyEntry && !chapterVisit && activeSectId === sectId && !saving) {
    return <Navigate to="/game/sect" replace />;
  }

  async function finish(outcome: string) {
    if (outcome === 'back') return back();
    if (outcome !== 'enter' || admission === 'visit') return;
    if (activeSectId && activeSectId !== sectId) {
      setError('你的师承已有变动，请重选去处。');
      return;
    }
    const attempt = beginSectJoinAttempt(joinAttempt.current, () =>
      crypto.randomUUID(),
    );
    joinAttempt.current = attempt.state;
    if (!attempt.key) return;
    setSaving(true);
    setError(undefined);
    try {
      if (!activeSectId) {
        await consumeResourceMutation(
          await apiFetch('/api/sects/' + encodeURIComponent(sectId) + '/join', {
            method: 'POST',
            headers: { 'Idempotency-Key': attempt.key },
          }),
        );
      }
      if (chapterVisit && checkpoint?.scriptId) {
        const next = await consumeResourceMutation<StoryView>(
          await apiFetch(
            '/api/story/performances/' +
              encodeURIComponent(checkpoint.scriptId) +
              '/complete',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ outcome: 'done', chosen: [] }),
            },
          ),
        );
        navigate(next.href, { replace: true });
      } else {
        navigate(
          chapterVisit ? '/game/story' : '/game/sect/onboarding?entry=path',
          { replace: true },
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '这里没能记下，再试一次。',
      );
    } finally {
      joinAttempt.current = finishSectJoinAttempt(joinAttempt.current);
      setSaving(false);
    }
  }

  const script = fillStoryScript(
    createMountainGateArrival(sectId, admission, backLabel, {
      study:
        checkpoint?.chapterId === 'mine-gate'
          ? getMineGateStudy(sectId)
          : undefined,
      admissionBlock,
    }),
    context,
    sectId,
  );
  return (
    <PerformancePlayer
      key={script.id}
      script={script}
      context={context}
      playerPortrait={portrait}
      backdropStyle="wash"
      finalLabel={admission === 'join' ? '拜入' + sectName : '继续'}
      busy={saving}
      error={error}
      exitLabel={backLabel}
      onExit={back}
      onFinish={(outcome) => void finish(outcome)}
    />
  );
}

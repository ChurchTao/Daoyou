import { InkButton } from '@app/components/ui';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import { useStory } from '@app/lib/story/useStory';
import { getGuideLesson } from '@shared/guide/catalog';
import {
  advanceGuide,
  createGuideState,
  currentGuideStep,
  restoreGuideState,
  type GuideState,
} from '@shared/guide/interpreter';
import type { GuideStep } from '@shared/guide/schema';
import { useCallback, useEffect, useRef, useState } from 'react';

type ShownStep = Extract<GuideStep, { type: 'look' | 'press' }>;
import { useSearchParams } from 'react-router';

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useAnchorHole(anchor: string | null) {
  const [measured, setMeasured] = useState<{
    anchor: string;
    hole: Hole | null;
  } | null>(null);

  useEffect(() => {
    if (!anchor) return;
    let scrolled = false;
    const tick = () => {
      const node = document.querySelector(`[data-guide="${anchor}"]`);
      if (node instanceof HTMLElement && !scrolled) {
        const rect = node.getBoundingClientRect();
        const visibleBottom = Math.min(rect.bottom, window.innerHeight - 140);
        const visible = Math.max(0, visibleBottom - Math.max(rect.top, 72));
        if (rect.height > 1 && visible < Math.min(rect.height, 160) * 0.6) {
          node.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        scrolled = true;
      }
      const next =
        node instanceof HTMLElement && node.getBoundingClientRect().width > 1
          ? (() => {
              const rect = node.getBoundingClientRect();
              const pad = 6;
              return {
                top: Math.max(8, rect.top - pad),
                left: Math.max(8, rect.left - pad),
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
              };
            })()
          : null;
      setMeasured((current) => {
        const previous = current?.anchor === anchor ? current.hole : null;
        if (
          next &&
          previous &&
          next.top === previous.top &&
          next.left === previous.left &&
          next.width === previous.width &&
          next.height === previous.height
        ) {
          return current;
        }
        if (!next && !previous && current?.anchor === anchor) return current;
        return { anchor, hole: next };
      });
    };
    const start = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 250);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [anchor]);

  return measured?.anchor === anchor ? measured.hole : null;
}

const GUIDE_RUNTIME_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function guideStorageKey(cultivatorId: string, lessonId: string): string {
  return `daoyou:guide:v2:${cultivatorId}:${lessonId}`;
}

function readStoredGuideCursor(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as {
      runtimeId?: unknown;
      cursor?: unknown;
    };
    return parsed.runtimeId === GUIDE_RUNTIME_ID &&
      Number.isInteger(parsed.cursor) &&
      Number(parsed.cursor) >= 0
      ? Number(parsed.cursor)
      : 0;
  } catch {
    return 0;
  }
}

function writeStoredGuideCursor(key: string, cursor: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ runtimeId: GUIDE_RUNTIME_ID, cursor }),
    );
  } catch {
    // Current-run guide recovery is optional when storage is unavailable.
  }
}

function clearStoredGuideCursor(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage denial.
  }
}

export function GuideOverlay() {
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonId = searchParams.get('guide');
  const story = useStory(Boolean(lessonId));
  const player = usePlayerSession(Boolean(lessonId));
  const cultivatorId = player.data?.activeCultivator?.id ?? null;
  const lesson = lessonId ? getGuideLesson(lessonId) : null;
  const allowed = Boolean(
    lesson &&
      cultivatorId &&
      !story.loading &&
      !player.loading &&
      story.story?.guideLesson === lessonId,
  );
  const storageKey =
    lessonId && cultivatorId ? guideStorageKey(cultivatorId, lessonId) : null;

  useEffect(() => {
    if (!lessonId || story.loading || player.loading || allowed) return;
    if (storageKey) clearStoredGuideCursor(storageKey);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (next.get('guide') !== lessonId) return current;
        next.delete('guide');
        next.delete('guideStep');
        return next;
      },
      { replace: true },
    );
  }, [
    allowed,
    lessonId,
    player.loading,
    setSearchParams,
    storageKey,
    story.loading,
  ]);

  if (!allowed || !lessonId || !storageKey) return null;
  return (
    <GuideSession
      key={`${cultivatorId}:${lessonId}`}
      lessonId={lessonId}
      storageKey={storageKey}
    />
  );
}

function GuideSession({
  lessonId,
  storageKey,
}: {
  lessonId: string;
  storageKey: string;
}) {
  const [, setSearchParams] = useSearchParams();
  const lesson = getGuideLesson(lessonId);
  const [state, setState] = useState<GuideState>(() =>
    lesson
      ? restoreGuideState(lesson, readStoredGuideCursor(storageKey))
      : createGuideState(),
  );
  const [noting, setNoting] = useState(false);
  const [noteError, setNoteError] = useState<string>();
  const [remembered, setRemembered] = useState<ShownStep | null>(null);
  const notingRef = useRef(false);
  const step = lesson ? currentGuideStep(lesson, state) : null;
  const anchor = step && step.type !== 'end' ? step.anchor : null;
  const hole = useAnchorHole(anchor);
  const totalSteps =
    lesson?.steps.filter((entry) => entry.type !== 'end').length ?? 0;
  const currentStepNumber = Math.min(state.cursor + 1, totalSteps);

  const close = useCallback(() => {
    clearStoredGuideCursor(storageKey);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('guide');
        next.delete('guideStep');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, storageKey]);

  const finishLesson = useCallback(() => {
    if (notingRef.current) return;
    notingRef.current = true;
    setNoting(true);
    setNoteError(undefined);
    void fetch(`/api/story/guides/${encodeURIComponent(lessonId)}/complete`, {
      method: 'POST',
    })
      .then((response) => consumeResourceMutation(response))
      .then(() => {
        clearStoredGuideCursor(storageKey);
        close();
      })
      .catch((reason: unknown) => {
        notingRef.current = false;
        setNoting(false);
        setNoteError(
          reason instanceof Error ? reason.message : '这课没能记下，再试一次。',
        );
      });
  }, [close, lessonId, storageKey]);

  useEffect(() => {
    if (state.finished) finishLesson();
  }, [finishLesson, state.finished]);

  const advance = useCallback(() => {
    if (!lesson || notingRef.current || state.finished) return;
    const active = currentGuideStep(lesson, state);
    if (!active || active.type === 'end') return;
    const next = advanceGuide(lesson, state);
    writeStoredGuideCursor(storageKey, next.cursor);
    if (next.finished) setRemembered(active);
    setState(next);
  }, [lesson, state, storageKey]);

  useEffect(() => {
    if (!lesson || step?.type !== 'press') return;
    const expectedAnchor = step.anchor;
    const onClick = (event: MouseEvent) => {
      if (notingRef.current) return;
      const hit = event
        .composedPath()
        .some(
          (entry) =>
            entry instanceof HTMLElement &&
            entry.dataset.guide === expectedAnchor,
        );
      if (!hit) return;
      advance();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [advance, lesson, step]);

  const visible = step && step.type !== 'end' ? step : remembered;
  if (!lesson || !visible || (!step && !state.finished)) return null;

  const calloutWidth = Math.min(288, window.innerWidth - 32);
  const calloutHeight = 168;
  const bottomReserve = 120;
  const below = hole ? hole.top + hole.height + 12 : 0;
  const above = hole ? hole.top - 12 - calloutHeight : 0;
  const calloutTop = !hole
    ? Math.max(96, window.innerHeight / 2 - 84)
    : below + calloutHeight < window.innerHeight - bottomReserve
      ? below
      : above > 72
        ? above
        : Math.max(72, window.innerHeight - bottomReserve - calloutHeight);
  const calloutLeft = Math.min(
    Math.max(16, hole?.left ?? 16),
    window.innerWidth - calloutWidth - 16,
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {hole ? (
        <>
          <div
            className="pointer-events-auto absolute inset-x-0 top-0 bg-[#1c1712]/72"
            style={{ height: hole.top }}
          />
          <div
            className="pointer-events-auto absolute left-0 bg-[#1c1712]/72"
            style={{
              top: hole.top,
              width: hole.left,
              height: hole.height,
            }}
          />
          <div
            className="pointer-events-auto absolute right-0 bg-[#1c1712]/72"
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              height: hole.height,
            }}
          />
          <div
            className="pointer-events-auto absolute inset-x-0 bottom-0 bg-[#1c1712]/72"
            style={{ top: hole.top + hole.height }}
          />
          <div
            className="pointer-events-none absolute border border-[#f6f1e6]/80"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
          {step?.type === 'look' && !state.finished ? (
            <button
              type="button"
              aria-label="继续教学"
              onClick={advance}
              className="pointer-events-auto absolute cursor-pointer bg-transparent"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
              }}
            />
          ) : null}
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[#1c1712]/55" />
      )}

      <div
        role="dialog"
        aria-modal={Boolean(hole)}
        aria-label={lesson.title}
        className="pointer-events-auto absolute bg-paper px-4 py-4 text-ink shadow-[0_12px_40px_rgba(28,23,18,0.28)]"
        style={{ top: calloutTop, left: calloutLeft, width: calloutWidth }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tracking-[0.22em] text-teal">教学</p>
          {totalSteps > 0 ? (
            <p className="text-ink-secondary text-xs font-mono">
              {state.finished ? totalSteps : currentStepNumber}/{totalSteps}
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-base leading-7">
          {state.finished
            ? noteError ?? (noting ? '正在记下。' : visible.text)
            : hole
              ? visible.text
              : '这一处还没出现。可先完成当前页面操作，教学会自动跟上。'}
        </p>
        <div className="mt-3 flex items-center gap-4">
          {state.finished && noteError ? (
            <InkButton variant="primary" onClick={finishLesson}>
              再记一次
            </InkButton>
          ) : null}
          {step?.type === 'look' && hole && !state.finished ? (
            <InkButton variant="primary" onClick={advance}>
              知道了
            </InkButton>
          ) : null}
          {step?.type === 'press' && hole && !state.finished ? (
            <p className="text-sm text-ink-secondary">点亮着的这一处。</p>
          ) : null}
          {noting ? null : (
            <button
              type="button"
              onClick={close}
              className="cursor-pointer text-sm text-ink-secondary hover:text-ink"
            >
              先不看
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

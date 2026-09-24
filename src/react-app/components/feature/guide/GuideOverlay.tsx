import { InkButton } from '@app/components/ui';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useStory } from '@app/lib/story/useStory';
import { getGuideLesson } from '@shared/guide/catalog';
import {
  advanceGuide,
  createGuideState,
  currentGuideStep,
  type GuideState,
} from '@shared/guide/interpreter';
import type { GuideStep } from '@shared/guide/schema';
import { useEffect, useRef, useState } from 'react';

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

export function GuideOverlay() {
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonId = searchParams.get('guide');
  const story = useStory(Boolean(lessonId));
  const lesson = lessonId ? getGuideLesson(lessonId) : null;
  const allowed = Boolean(
    lesson && !story.loading && story.story?.guideLesson === lessonId,
  );

  useEffect(() => {
    if (!lessonId || story.loading || allowed) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (next.get('guide') !== lessonId) return current;
        next.delete('guide');
        return next;
      },
      { replace: true },
    );
  }, [allowed, lessonId, setSearchParams, story.loading]);

  if (!allowed || !lessonId) return null;
  return <GuideSession key={lessonId} lessonId={lessonId} />;
}

function GuideSession({ lessonId }: { lessonId: string }) {
  const [, setSearchParams] = useSearchParams();
  const lesson = getGuideLesson(lessonId);
  const [state, setState] = useState<GuideState>(createGuideState);
  const [noting, setNoting] = useState(false);
  const [noteError, setNoteError] = useState<string>();
  const [remembered, setRemembered] = useState<ShownStep | null>(null);
  const step = lesson ? currentGuideStep(lesson, state) : null;
  const anchor = step && step.type !== 'end' ? step.anchor : null;
  const hole = useAnchorHole(anchor);

  const close = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('guide');
        return next;
      },
      { replace: true },
    );
  };

  const closeRef = useRef(close);
  const notingRef = useRef(false);
  useEffect(() => {
    closeRef.current = close;
  });

  const finishLesson = () => {
    if (notingRef.current) return;
    notingRef.current = true;
    setNoting(true);
    setNoteError(undefined);
    void fetch(`/api/story/guides/${encodeURIComponent(lessonId)}/complete`, {
      method: 'POST',
    })
      .then((response) => consumeResourceMutation(response))
      .then(() => closeRef.current())
      .catch((reason: unknown) => {
        notingRef.current = false;
        setNoting(false);
        setNoteError(
          reason instanceof Error ? reason.message : '这课没能记下，再试一次。',
        );
      });
  };

  const finishRef = useRef(finishLesson);
  useEffect(() => {
    finishRef.current = finishLesson;
  });

  const advance = () => {
    if (!lesson || notingRef.current) return;
    let finished = false;
    setState((current) => {
      const next = advanceGuide(lesson, current);
      finished = next.finished && !current.finished;
      return next;
    });
    if (finished && step && step.type !== 'end') setRemembered(step);
    if (finished) finishRef.current();
  };

  useEffect(() => {
    if (!lesson || step?.type !== 'press') return;
    const onClick = (event: MouseEvent) => {
      if (notingRef.current) return;
      const node = document.querySelector(
        `[data-guide="${step.anchor}"]`,
      );
      if (!(node instanceof HTMLElement)) return;
      if (!(event.target instanceof Node) || !node.contains(event.target)) return;
      let finished = false;
      setState((current) => {
        const next = advanceGuide(lesson, current);
        finished = next.finished && !current.finished;
        return next;
      });
      if (finished && step.type === 'press') setRemembered(step);
      if (finished) finishRef.current();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [lesson, step]);

  const visible = step && step.type !== 'end' ? step : remembered;
  if (!lesson || !visible || (!step && !state.finished)) return null;

  const calloutWidth = Math.min(288, window.innerWidth - 32);
  const calloutHeight = 150;
  const bottomReserve = 120;
  const below = hole ? hole.top + hole.height + 12 : 0;
  const above = hole ? hole.top - 12 - calloutHeight : 0;
  const calloutTop = !hole
    ? Math.max(96, window.innerHeight / 2 - 72)
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
          {step?.type === 'look' || state.finished ? (
            <div
              className="pointer-events-auto absolute"
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
        <div className="pointer-events-auto absolute inset-0 bg-[#1c1712]/72" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={lesson.title}
        className="pointer-events-auto absolute bg-paper px-4 py-4 text-ink shadow-[0_12px_40px_rgba(28,23,18,0.28)]"
        style={{ top: calloutTop, left: calloutLeft, width: calloutWidth }}
      >
        <p className="text-xs tracking-[0.22em] text-teal">教学</p>
        <p className="mt-2 text-base leading-7">
          {state.finished
            ? noteError ?? (noting ? '正在记下。' : visible.text)
            : hole
              ? visible.text
              : '这一处还没出现。'}
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

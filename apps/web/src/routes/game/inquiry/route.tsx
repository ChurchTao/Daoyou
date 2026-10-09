import {
  getQiErrorMessage,
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { inquiryPlayForNode } from '@daoyou/game-content/inquiry';
import { QI_ACTION_COSTS } from '@daoyou/game-content/qi/config';
import { getMapNode } from '@daoyou/game-content/world/map';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { InquiryPerformance } from './InquiryPerformance';

interface InquiryAction {
  id: string;
  label: string;
  cost?: { type: string };
  repeat: boolean;
}

interface InquiryView {
  runId: string;
  status: string;
  revision: number;
  mapNodeId: string;
  locationId: string;
  prose: string;
  actions: InquiryAction[];
  clues: Array<{ id: string; title: string; body: string }>;
  notes?: Array<{ id: string; title: string; body: string }>;
  heldItemIds: string[];
  verdictReady?: boolean;
  verdict?: {
    answerLabel: string;
    answers: Array<{ id: string; label: string }>;
    containerLabel: string;
    containerOptions: Array<{ id: 'leave_shut' | 'open'; label: string }>;
  } | null;
  feedback?: string;
  settlement?: {
    correct: boolean;
    rating: string | null;
    narrative: string;
  } | null;
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;
  return body?.message || body?.error || '探查没有完成';
}

export default function InquiryPage() {
  const [params] = useSearchParams();
  const nodeId = params.get('nodeId');
  const navigate = useNavigate();
  const { openQiActionConfirm } = useQiActionConfirm();
  const [view, setView] = useState<InquiryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [answerId, setAnswerId] = useState('');
  const [container, setContainer] = useState<'leave_shut' | 'open'>('leave_shut');
  const [streaming, setStreaming] = useState(false);
  const [arrivedLive, setArrivedLive] = useState(false);
  const sawToken = useRef(false);

  const refresh = useCallback(async () => {
    const response = await apiFetch('/api/inquiry/state');
    if (!response.ok) throw new Error(await readError(response));
    const body = (await response.json()) as { run: InquiryView | null };
    setView(body.run);
  }, []);

  useEffect(() => {
    let alive = true;
    void refresh()
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : '读不到探查');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refresh]);

  const postJson = async (path: string, body: unknown) => {
    setPending(true);
    setStreaming(true);
    setArrivedLive(false);
    setError('');
    try {
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const message = await readError(response);
        throw new Error(getQiErrorMessage({ error: message }, message));
      }
      setView(await consumeResourceMutation<InquiryView>(response));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '探查没有完成');
    } finally {
      setStreaming(false);
      setPending(false);
    }
  };

  const readEvents = async (
    response: Response,
    onEvent: (event: string, data: unknown) => void | Promise<void>,
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('探查没有返回内容');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      buffer += decoder.decode(step.value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        const event = chunk.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? 'message';
        const data = chunk.match(/^data:\s*(.+)$/m)?.[1];
        if (!data) continue;
        const outcome = onEvent(event, JSON.parse(data) as unknown);
        if (outcome instanceof Promise) await outcome;
      }
    }
  };

  const start = () => {
    if (!nodeId) return;
    openQiActionConfirm({
      actionName: '秘境探查',
      qiCost: QI_ACTION_COSTS.inquiry_start,
      confirmLabel: '入内探查',
      onConfirm: async () => {
        setPending(true);
        setStreaming(true);
        setArrivedLive(false);
        sawToken.current = false;
        setError('');
        try {
          const response = await apiFetch('/api/inquiry/runs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({ mapNodeId: nodeId }),
          });
          if (!response.ok) {
            const message = await readError(response);
            throw new Error(getQiErrorMessage({ error: message }, message));
          }
          let ready: unknown = null;
          let streamed = '';
          await readEvents(response, async (event, data) => {
            if (event === 'state' || event === 'ready') {
              const next = await consumeResourceMutation<InquiryView>(data as never);
              ready = data;
              setView(streamed ? { ...next, prose: streamed } : next);
            } else if (event === 'token') {
              sawToken.current = true;
              streamed += (data as { text?: string }).text ?? '';
              setView((current) => (current ? { ...current, prose: streamed } : current));
            } else if (event === 'prose') {
              const text = (data as { text?: string }).text;
              if (text) {
                streamed = text;
                setView((current) => (current ? { ...current, prose: text } : current));
              }
            } else if (event === 'error') {
              const message = (data as { error?: string }).error ?? '探查没有开始';
              throw new Error(getQiErrorMessage({ error: message }, message));
            }
          });
          if (!ready) throw new Error('秘境没有打开');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '探查没有开始');
        } finally {
          setArrivedLive(sawToken.current);
          setStreaming(false);
          setPending(false);
        }
      },
    });
  };

  const perform = async (actionId: string) => {
    if (!view) return;
    setPending(true);
    setStreaming(true);
    setArrivedLive(false);
    sawToken.current = false;
    setError('');
    try {
      const response = await apiFetch('/api/inquiry/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          runId: view.runId,
          actionId,
          expectedRevision: view.revision,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        setView(await consumeResourceMutation<InquiryView>(response));
        return;
      }
      let prose = '';
      await readEvents(response, async (event, data) => {
        if (event === 'state') {
          setView(await consumeResourceMutation<InquiryView>(data as never));
        } else if (event === 'token') {
          sawToken.current = true;
          prose += (data as { text?: string }).text ?? '';
          setView((current) => (current ? { ...current, prose } : current));
        } else if (event === 'prose') {
          const text = (data as { text?: string }).text;
          if (text) setView((current) => (current ? { ...current, prose: text } : current));
        } else if (event === 'error') {
          throw new Error((data as { error?: string }).error ?? '这一幕没有写成');
        }
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '探查没有完成');
    } finally {
      setArrivedLive(sawToken.current);
      setStreaming(false);
      setPending(false);
    }
  };

  if (loading) return <GameLoadingState variant="fullscreen" message="正在接上洞府……" />;

  const node = getMapNode(view?.mapNodeId || nodeId || '');
  const title = node && 'name' in node ? node.name : '秘境探查';
  const description = node && 'description' in node ? node.description : '';
  const play = inquiryPlayForNode(view?.mapNodeId || nodeId || '');
  const place =
    play?.locations.find((location) => location.id === view?.locationId)?.name ?? '';
  const mapHref = `/game/map-v2?nodeId=${encodeURIComponent(view?.mapNodeId || nodeId || '')}`;
  const leave = () => navigate(nodeId || view?.mapNodeId ? mapHref : '/game/map-v2');
  const finished = view?.status === 'FINISHED';
  const prose = finished
    ? [view?.settlement?.narrative, view?.settlement?.correct ? `定论正确，评级 ${view.settlement.rating}` : '这次没有看破洞府。']
        .filter(Boolean)
        .join('\n\n')
    : view?.prose || description || '这里还没有打开。';

  return (
    <InquiryPerformance
      title={title}
      place={view && !finished ? place : ''}
      prose={prose}
      beatKey={view ? `${view.runId}:${view.revision}:${prose}` : `gate:${nodeId ?? ''}`}
      streaming={streaming}
      arrivedLive={arrivedLive}
      choices={
        finished
          ? [{ id: 'done', label: '离开' }]
          : view
            ? view.actions.map((action) => ({ id: action.id, label: action.label }))
            : nodeId
              ? [{ id: 'enter', label: '入内探查' }]
              : []
      }
      clues={view?.clues ?? []}
      notes={view?.notes ?? []}
      verdict={!finished && view?.verdictReady && view.verdict ? view.verdict : null}
      selectedAnswerId={answerId || view?.verdict?.answers[0]?.id || ''}
      selectedContainer={container}
      onSelectAnswer={setAnswerId}
      onSelectContainer={setContainer}
      onVerdict={() => {
        if (!view?.verdict) return;
        void postJson('/api/inquiry/verdict', {
          runId: view.runId,
          expectedRevision: view.revision,
          answerId: answerId || view.verdict.answers[0]?.id,
          container,
        });
      }}
      feedback={view && view.status !== 'FINISHED' ? view.feedback : undefined}
      error={error}
      pending={pending}
      onChoose={(id) => {
        if (!id) return;
        if (id === 'enter') {
          start();
          return;
        }
        if (id === 'done') {
          leave();
          return;
        }
        void perform(id);
      }}
      onLeave={
        view && !finished
          ? () =>
              void postJson('/api/inquiry/leave', {
                runId: view.runId,
                expectedRevision: view.revision,
              })
          : undefined
      }
      onExit={leave}
    />
  );
}

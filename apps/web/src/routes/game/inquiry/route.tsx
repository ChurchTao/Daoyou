import {
  getQiErrorMessage,
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
import { GameSceneLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkNotice } from '@app/components/ui/InkNotice';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { QI_ACTION_COSTS } from '@daoyou/game-content/qi/config';
import { getMapNode } from '@daoyou/game-content/world/map';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

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
  const [utterance, setUtterance] = useState('');
  const [answerId, setAnswerId] = useState('');
  const [container, setContainer] = useState<'leave_shut' | 'open'>('leave_shut');
  const [journalOpen, setJournalOpen] = useState(false);
  const [phase, setPhase] = useState('');

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
        setError('');
        setPhase('推演格局');
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
            if (event === 'action_status') {
              const message = (data as { message?: string }).message;
              if (message) setPhase(message);
            } else if (event === 'state' || event === 'ready') {
              const next = await consumeResourceMutation<InquiryView>(data as never);
              ready = data;
              setView(streamed ? { ...next, prose: streamed } : next);
            } else if (event === 'token') {
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
          setPending(false);
          setPhase('');
        }
      },
    });
  };

  const speak = async () => {
    if (!view || !utterance.trim()) return;
    setPending(true);
    setError('');
    setPhase('正在领会你的意图');
    try {
      const response = await apiFetch('/api/inquiry/turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          runId: view.runId,
          expectedRevision: view.revision,
          utterance: utterance.trim(),
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      let streamed = '';
      await readEvents(response, async (event, data) => {
        if (event === 'action_status') {
          const message = (data as { message?: string }).message;
          if (message) setPhase(message);
        } else if (event === 'state' || event === 'ready') {
          if (data && typeof data === 'object' && 'data' in data) {
            const next = await consumeResourceMutation<InquiryView>(data as never);
            setView(streamed ? { ...next, prose: streamed } : next);
          }
        } else if (event === 'token') {
          streamed += (data as { text?: string }).text ?? '';
          setView((current) => (current ? { ...current, prose: streamed } : current));
        } else if (event === 'prose') {
          const text = (data as { text?: string }).text;
          if (text) {
            streamed = text;
            setView((current) => (current ? { ...current, prose: text } : current));
          }
        } else if (event === 'error') {
          throw new Error((data as { error?: string }).error ?? '没有听清');
        }
      });
      setUtterance('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '没有听清');
    } finally {
      setPending(false);
      setPhase('');
    }
  };

  const perform = async (actionId: string) => {
    if (!view) return;
    setPending(true);
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
      setPending(false);
    }
  };

  if (loading) return <GameSceneLoading message="正在确认洞府……" />;

  const node = getMapNode(view?.mapNodeId || nodeId || '');
  const title = node && 'name' in node ? node.name : '秘境探查';

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
        {view?.feedback && view.status !== 'FINISHED' ? (
          <InkNotice>{view.feedback}</InkNotice>
        ) : null}
        {phase ? <p className="text-ink-secondary text-sm">{phase}……</p> : null}
        {!view ? (
          <InkCard className="space-y-4 p-6">
            <p>洞府还没有打开。进去之后可以反复查看，定论错了也能留在原地。</p>
            <InkButton variant="primary" disabled={!nodeId || pending} onClick={start}>
              入内探查
            </InkButton>
          </InkCard>
        ) : view.status === 'FINISHED' ? (
          <InkCard className="space-y-4 p-6">
            <p>{view.settlement?.narrative}</p>
            <p className="text-ink-secondary text-sm">
              {view.settlement?.correct
                ? `定论正确，评级 ${view.settlement.rating}`
                : '这次没有看破洞府。'}
            </p>
            <InkButton variant="primary" onClick={() => navigate('/game')}>
              离开
            </InkButton>
          </InkCard>
        ) : (
          <InkCard className="space-y-4 p-6">
            <p className="leading-7">{view.prose}</p>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void speak();
              }}
            >
              <input
                className="border-ink/20 bg-paper min-h-11 flex-1 border px-3"
                value={utterance}
                placeholder="说说你要做什么"
                maxLength={200}
                onChange={(event) => setUtterance(event.target.value)}
              />
              <InkButton type="submit" variant="primary" pending={pending} disabled={!utterance.trim()}>
                去做
              </InkButton>
            </form>
            <div className="flex flex-col gap-2">
              {view.actions.map((action) => (
                <InkButton
                  key={action.id}
                  variant={action.cost ? 'outline' : 'primary'}
                  pending={pending}
                  onClick={() => void perform(action.id)}
                >
                  {action.label}
                </InkButton>
              ))}
            </div>
            {view.verdictReady && view.verdict ? (
              <form
                className="border-ink/15 space-y-3 border-t pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void postJson('/api/inquiry/verdict', {
                    runId: view.runId,
                    expectedRevision: view.revision,
                    answerId: answerId || view.verdict?.answers[0]?.id,
                    container,
                  });
                }}
              >
                <p className="text-sm">线索已经对得上，可以下定论。</p>
                <label className="flex items-center gap-2 text-sm">
                  {view.verdict.answerLabel}
                  <select
                    className="border-ink/20 bg-paper border px-2 py-1"
                    value={answerId || view.verdict.answers[0]?.id}
                    onChange={(event) => setAnswerId(event.target.value)}
                  >
                    {view.verdict.answers.map((answer) => (
                      <option key={answer.id} value={answer.id}>
                        {answer.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  {view.verdict.containerLabel}
                  <select
                    className="border-ink/20 bg-paper border px-2 py-1"
                    value={container}
                    onChange={(event) =>
                      setContainer(event.target.value as 'leave_shut' | 'open')
                    }
                  >
                    {view.verdict.containerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <InkButton type="submit" variant="primary" pending={pending}>
                  提交定论
                </InkButton>
              </form>
            ) : null}
            <div className="border-ink/15 border-t pt-4">
              <InkButton
                type="button"
                variant="outline"
                pending={pending}
                onClick={() =>
                  void postJson('/api/inquiry/leave', {
                    runId: view.runId,
                    expectedRevision: view.revision,
                  })
                }
              >
                带着现有收获离开
              </InkButton>
            </div>
          </InkCard>
        )}
      </section>
      <aside className="lg:sticky lg:top-4">
        <InkCard className="p-4">
          <button
            className="flex w-full items-center justify-between text-left text-sm font-semibold"
            type="button"
            onClick={() => setJournalOpen((open) => !open)}
          >
            线索夹
            <span>{view?.clues.length ?? 0}</span>
          </button>
          <div className={journalOpen ? 'mt-3 space-y-3' : 'mt-3 hidden space-y-3 lg:block'}>
            {view?.clues.length ? (
              view.clues.map((clue) => (
                <div key={clue.id}>
                  <p className="text-sm font-semibold">{clue.title}</p>
                  <p className="text-ink-secondary text-sm leading-6">{clue.body}</p>
                </div>
              ))
            ) : (
              <p className="text-ink-secondary text-sm">还没有记下线索。</p>
            )}
          </div>
        </InkCard>
      </aside>
    </div>
  );
}

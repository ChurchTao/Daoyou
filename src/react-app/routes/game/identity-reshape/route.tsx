import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import {
  consumeResourceChanges,
  useResourceMutation,
} from '@app/lib/resources/mutations';
import {
  IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH,
  IDENTITY_RESHAPE_DESCRIPTION_MIN_LENGTH,
  IDENTITY_RESHAPE_TALISMAN_NAME,
} from '@shared/config/identityReshape';
import type { PlayerResourceMutationMeta } from '@shared/contracts/player';
import type {
  IdentityReshapeAnswer,
  IdentityReshapeSessionDTO,
} from '@shared/types/identityReshape';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';

type SessionPayload = {
  session: IdentityReshapeSessionDTO | null;
  talismanCount: number;
};

type ApiResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  state?: PlayerResourceMutationMeta;
};

function expiresLabel(expiresAt: number) {
  return new Date(expiresAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-[#101613] pt-[calc(env(safe-area-inset-top)+1.5rem)] pr-[max(env(safe-area-inset-right),1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pl-[max(env(safe-area-inset-left),1.25rem)] text-[#f4eedf] sm:pr-[max(env(safe-area-inset-right),2rem)] sm:pl-[max(env(safe-area-inset-left),2rem)]">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_70%_20%,rgba(145,116,67,0.18),transparent_34%),linear-gradient(155deg,#18221c,#0c110f_72%)]" />
      <div className="absolute inset-0 -z-10 [background-image:repeating-linear-gradient(115deg,transparent_0,transparent_32px,rgba(255,255,255,0.04)_33px)] opacity-20" />
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-3xl flex-col">
        <header>
          <p className="text-xs tracking-[0.3em] text-[#cbbd9d]">{eyebrow}</p>
          <h1 className="mt-3 text-2xl tracking-[0.18em] sm:text-3xl">
            {title}
          </h1>
        </header>
        <div className="my-auto py-12">{children}</div>
      </div>
    </section>
  );
}

export default function IdentityReshapePage() {
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const [session, setSession] = useState<IdentityReshapeSessionDTO | null>(
    null,
  );
  const [talismanCount, setTalismanCount] = useState(0);
  const [answers, setAnswers] = useState<IdentityReshapeAnswer[]>([]);
  const [description, setDescription] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<
    'start' | 'draft' | 'generate' | 'confirm' | 'abandon' | null
  >(null);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const [confirmingAdoption, setConfirmingAdoption] = useState(false);

  const applySession = useCallback((next: IdentityReshapeSessionDTO | null) => {
    setSession(next);
    setAnswers(next?.answers ?? []);
    setDescription(next?.description ?? '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/identity-reshape/session')
      .then(async (response) => {
        const result = (await response.json()) as ApiResult<SessionPayload>;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? '读取改天换地会话失败');
        }
        if (!cancelled) {
          applySession(result.data.session);
          if (result.data.session && !result.data.session.candidate) {
            setQuestionIndex(
              Math.min(
                result.data.session.answers.length,
                result.data.session.questions.length,
              ),
            );
          }
          setTalismanCount(result.data.talismanCount);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '读取会话失败',
            tone: 'danger',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySession, pushToast]);

  const saveDraft = async (
    nextAnswers: IdentityReshapeAnswer[],
    nextDescription = description,
  ) => {
    setPending('draft');
    try {
      const response = await fetch('/api/identity-reshape/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: nextAnswers,
          description: nextDescription,
        }),
      });
      const result = (await response.json()) as ApiResult<{
        session: IdentityReshapeSessionDTO;
      }>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? '保存问答失败');
      }
      applySession(result.data.session);
      return true;
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存问答失败',
        tone: 'danger',
      });
      return false;
    } finally {
      setPending(null);
    }
  };

  const selectedOptionByQuestion = useMemo(
    () =>
      new Map(answers.map((answer) => [answer.questionId, answer.optionId])),
    [answers],
  );

  const start = async () => {
    setPending('start');
    try {
      const response = await fetch('/api/identity-reshape/session', {
        method: 'POST',
      });
      const result = (await response.json()) as ApiResult<SessionPayload>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? '启封失败');
      }
      if (result.state) consumeResourceChanges(result.state);
      applySession(result.data.session);
      setTalismanCount(result.data.talismanCount);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '启封失败',
        tone: 'danger',
      });
    } finally {
      setPending(null);
    }
  };

  const selectAnswer = async (questionId: string, optionId: string) => {
    const nextAnswers = [
      ...answers.filter((answer) => answer.questionId !== questionId),
      { questionId, optionId },
    ];
    setAnswers(nextAnswers);
    if (await saveDraft(nextAnswers)) {
      setQuestionIndex((value) =>
        Math.min(value + 1, session?.questions.length ?? 3),
      );
    }
  };

  const generate = async () => {
    const trimmed = description.trim();
    if (
      trimmed.length < IDENTITY_RESHAPE_DESCRIPTION_MIN_LENGTH ||
      trimmed.length > IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH
    ) {
      pushToast({ message: '身世描述需为 2-200 字。', tone: 'warning' });
      return;
    }
    if (!(await saveDraft(answers, trimmed))) return;
    setPending('generate');
    try {
      const response = await fetch('/api/identity-reshape/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, description: trimmed }),
      });
      const result = (await response.json()) as ApiResult<{
        session: IdentityReshapeSessionDTO;
      }>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? '司命推演失败');
      }
      applySession(result.data.session);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '司命推演失败',
        tone: 'danger',
      });
    } finally {
      setPending(null);
    }
  };

  const confirm = async () => {
    setPending('confirm');
    try {
      await mutate(fetch('/api/identity-reshape/confirm', { method: 'POST' }));
      pushToast({ message: '新身份已落定。', tone: 'success' });
      navigate('/game/cultivator', { replace: true });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '身份落定失败',
        tone: 'danger',
      });
    } finally {
      setPending(null);
    }
  };

  const abandon = async () => {
    setPending('abandon');
    try {
      const response = await fetch('/api/identity-reshape/abandon', {
        method: 'POST',
      });
      const result = (await response.json()) as ApiResult<never>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? '放弃会话失败');
      }
      navigate('/game/cave/storage', { replace: true });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '放弃会话失败',
        tone: 'danger',
      });
    } finally {
      setPending(null);
    }
  };

  const temporarilyLeave = async () => {
    if (!session) {
      navigate('/game/cave/storage');
      return;
    }
    if (!session.candidate) {
      if (!(await saveDraft(answers, description))) return;
    }
    navigate('/game/cave/storage');
  };

  if (loading) {
    return (
      <StageShell eyebrow="太乙司命 · 玉牒未明" title="改天换地">
        <GameLoadingState
          message="正在照见旧日姓名……"
          variant="immersive"
          className="min-h-40"
        />
      </StageShell>
    );
  }

  if (!session) {
    return (
      <StageShell eyebrow="太乙司命 · 一符一世" title="改天换地">
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <p className="text-lg leading-9 text-[#e6dcc8]">
            朱砂符胆映出三问。答毕之后，司命将依你的心念重写姓名与人间来处。
          </p>
          <p className="text-sm leading-7 text-[#c7bca6]">
            持有 {IDENTITY_RESHAPE_TALISMAN_NAME}：{talismanCount} 张
          </p>
          <p className="text-sm leading-7 text-[#d9b69b]">
            启封将立即消耗一张；中途放弃或会话过期均不会返还。
          </p>
          <div className="flex flex-wrap justify-center gap-5">
            <InkButton
              variant="primary"
              disabled={talismanCount < 1}
              pending={pending === 'start'}
              pendingLabel="符火燃起中……"
              onClick={() => void start()}
              className="text-[#f0c77b]"
            >
              启封问命
            </InkButton>
            <InkButton href="/game/cave/storage" className="text-[#d9cfba]">
              返回储物袋
            </InkButton>
          </div>
        </div>
      </StageShell>
    );
  }

  if (session.candidate) {
    const candidate = session.candidate;
    return (
      <StageShell eyebrow="太乙司命 · 新牒待定" title="一纸新生">
        <div className="mx-auto max-w-2xl">
          <dl className="divide-y divide-white/12 border-y border-white/15">
            {[
              ['姓名', candidate.name],
              ['出身', candidate.origin],
              ['性格', candidate.personality],
              ['背景', candidate.background],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid gap-2 py-4 sm:grid-cols-[5rem_1fr]"
              >
                <dt className="text-sm tracking-[0.18em] text-[#cbbd9d]">
                  {label}
                </dt>
                <dd className="leading-8 text-[#f2ead9]">{value}</dd>
              </div>
            ))}
          </dl>
          {session.nameCheck === 'duplicate' && (
            <p className="mt-4 text-sm leading-7 text-[#ef9a86]">
              已有活跃道友使用此名，你仍可自行决定是否采用。
            </p>
          )}
          {session.nameCheck === 'unavailable' && (
            <p className="mt-4 text-sm leading-7 text-[#d4c6a9]">
              姓名查重暂不可用，你仍可自行决定是否采用。
            </p>
          )}
          <p className="mt-5 text-sm leading-7 text-[#c7bca6]">
            一旦落印，旧姓名与旧身世将被覆盖，其他修行数据保持不变。
          </p>
          <div className="mt-7 flex flex-wrap gap-5">
            {!confirmingAdoption ? (
              <InkButton
                variant="primary"
                onClick={() => setConfirmingAdoption(true)}
                className="text-[#f0c77b]"
              >
                采用此身份
              </InkButton>
            ) : (
              <>
                <InkButton
                  variant="primary"
                  pending={pending === 'confirm'}
                  pendingLabel="玉牒落印中……"
                  onClick={() => void confirm()}
                  className="text-[#ef9a86]"
                >
                  确认覆盖旧身份
                </InkButton>
                <InkButton onClick={() => setConfirmingAdoption(false)}>
                  再看一眼
                </InkButton>
              </>
            )}
            <InkButton onClick={() => void temporarilyLeave()}>暂离</InkButton>
            <InkButton onClick={() => setConfirmingAbandon(true)}>
              放弃此局
            </InkButton>
          </div>
          {confirmingAbandon && (
            <div className="mt-5 border-l border-[#ef9a86]/50 pl-4 text-sm leading-7 text-[#e8c1b5]">
              <p>放弃后候选将消失，符箓不会返还。</p>
              <div className="mt-2 flex gap-4">
                <InkButton
                  pending={pending === 'abandon'}
                  pendingLabel="放弃中……"
                  onClick={() => void abandon()}
                >
                  确认放弃
                </InkButton>
                <InkButton onClick={() => setConfirmingAbandon(false)}>
                  保留会话
                </InkButton>
              </div>
            </div>
          )}
        </div>
      </StageShell>
    );
  }

  if (questionIndex < session.questions.length) {
    const question = session.questions[questionIndex];
    return (
      <StageShell
        eyebrow={`太乙司命 · 第 ${questionIndex + 1} 问 / ${session.questions.length}`}
        title={question.source}
      >
        <div className="mx-auto max-w-2xl">
          <blockquote className="border-l border-[#c7a968]/55 pl-5 text-xl leading-10 text-[#efe3ca]">
            “{question.quote}”
          </blockquote>
          <p className="mt-8 text-lg leading-9">{question.prompt}</p>
          <div className="mt-7 grid gap-3">
            {question.options.map((option) => {
              const active =
                selectedOptionByQuestion.get(question.id) === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={pending === 'draft'}
                  onClick={() => void selectAnswer(question.id, option.id)}
                  className={`border px-5 py-4 text-left leading-7 transition-colors ${
                    active
                      ? 'border-[#d9bd7b]/70 bg-[#d9bd7b]/10 text-[#ffe7af]'
                      : 'border-white/15 bg-black/10 text-[#e5dcc9] hover:border-white/30'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-7 flex flex-wrap gap-5">
            {questionIndex > 0 && (
              <InkButton onClick={() => setQuestionIndex((value) => value - 1)}>
                上一问
              </InkButton>
            )}
            <InkButton onClick={() => void temporarilyLeave()}>暂离</InkButton>
          </div>
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell eyebrow="太乙司命 · 三问已毕" title="再写一段来处">
      <div className="mx-auto max-w-2xl">
        <p className="leading-8 text-[#d9cfba]">
          写下你希望新身份拥有的意象、经历或气质。司命会连同方才三答一并推演。
        </p>
        <textarea
          value={description}
          maxLength={IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-6 min-h-44 w-full resize-y border border-white/20 bg-black/15 p-4 leading-8 text-[#f4eedf] outline-none focus:border-[#d9bd7b]/60"
          placeholder="例如：生于北地商旅之家，寡言而重诺，愿以一剑护送故人归乡……"
        />
        <p className="mt-2 text-right text-xs text-[#b9ad96]">
          {Array.from(description).length} /{' '}
          {IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH}
        </p>
        <div className="mt-6 flex flex-wrap gap-5">
          <InkButton
            variant="primary"
            disabled={answers.length !== session.questions.length}
            pending={pending === 'generate'}
            pendingLabel="司命推演中……"
            onClick={() => void generate()}
            className="text-[#f0c77b]"
          >
            推演新身世
          </InkButton>
          <InkButton
            onClick={() => setQuestionIndex(session.questions.length - 1)}
          >
            返回三问
          </InkButton>
          <InkButton onClick={() => void temporarilyLeave()}>暂离</InkButton>
        </div>
        <p className="mt-5 text-xs leading-6 text-[#aa9e89]">
          本次会话将在 {expiresLabel(session.expiresAt)} 前保留。
        </p>
      </div>
    </StageShell>
  );
}

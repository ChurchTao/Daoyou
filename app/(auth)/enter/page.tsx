'use client';

import TurnstileCaptcha, {
  type TurnstileCaptchaHandle,
} from '@/components/auth/TurnstileCaptcha';
import { InkButton } from '@/components/ui/InkButton';
import { InkNotice } from '@/components/ui/InkNotice';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function EnterPage() {
  const router = useRouter();
  const { user, isLoading, createAnonymousUser } = useAuth();
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const [started, setStarted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/game');
    }
  }, [isLoading, user, router]);

  const handleEnter = async () => {
    if (turnstileEnabled && !captchaToken) {
      setErrorMessage('请先完成人机验证');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await createAnonymousUser(
      turnstileEnabled ? captchaToken ?? undefined : undefined,
    );

    if (error) {
      setErrorMessage('创建会话失败，请重试');
      turnstileRef.current?.reset();
      setSubmitting(false);
      return;
    }

    router.replace('/game');
  };

  if (isLoading || user) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">正在进入道界……</p>
      </div>
    );
  }

  const steps = turnstileEnabled
    ? ([
        { id: 1, label: '唤醒界门' },
        { id: 2, label: '人机验证' },
        { id: 3, label: '进入道界' },
      ] as const)
    : ([
        { id: 1, label: '唤醒界门' },
        { id: 2, label: '进入道界' },
      ] as const);

  const currentStep = !started ? 1 : turnstileEnabled ? (captchaToken ? 3 : 2) : 2;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-[#f8f3e6]/95 p-6 shadow-[0_10px_40px_rgba(44,24,16,0.12)]">
      <div className="pointer-events-none absolute -top-18 -left-20 h-48 w-48 rounded-full bg-amber-700/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-18 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 space-y-5">
        <div className="space-y-2 text-center">
          <p className="text-ink-secondary text-xs tracking-[0.28em]">
            BOUNDARY RITE
          </p>
          <h1 className="font-heading text-ink text-4xl">入界仪式</h1>
          <p className="text-ink-secondary text-sm leading-relaxed">
            你正站在凡尘与道界交界处。
            <br />
            完成仪式后，将以匿名神识踏入万界道友录。
          </p>
        </div>

        <div
          className={`grid gap-2 ${
            steps.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {steps.map((step) => {
            const done = step.id < currentStep;
            const active = step.id === currentStep;
            return (
              <div
                key={step.id}
                className={`rounded-md border px-2 py-2 text-center text-xs transition-all ${
                  active
                    ? 'border-amber-700/40 bg-amber-700/10 text-amber-800'
                    : done
                      ? 'border-teal/30 bg-teal/10 text-teal'
                      : 'bg-paper/40 text-ink-secondary border-black/10'
                }`}
              >
                <div className="font-semibold">第 {step.id} 步</div>
                <div className="mt-1">{step.label}</div>
              </div>
            );
          })}
        </div>

        {turnstileEnabled ? (
          <InkNotice className="my-0 text-sm">
            此步骤仅用于防止脚本滥用，不会收集你的隐私数据。
          </InkNotice>
        ) : null}

        {!started ? (
          <div className="space-y-3">
            <InkButton
              onClick={() => setStarted(true)}
              variant="primary"
              className="w-full text-base"
            >
              点燃界门
            </InkButton>
            <InkButton href="/" variant="secondary" className="w-full">
              返回官网
            </InkButton>
          </div>
        ) : (
          <div className="space-y-4">
            {turnstileEnabled ? (
              <TurnstileCaptcha
                ref={turnstileRef}
                onTokenChange={setCaptchaToken}
              />
            ) : null}

            <InkButton
              onClick={handleEnter}
              variant="primary"
              disabled={submitting}
              className="w-full text-base"
            >
              {submitting ? '界门开启中…' : '踏入道界'}
            </InkButton>

            <InkButton href="/" variant="secondary" className="w-full">
              返回官网
            </InkButton>
          </div>
        )}

        {errorMessage ? (
          <p className="rounded-md border border-red-400/30 bg-red-500/5 px-3 py-2 text-center text-sm text-red-700/90">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

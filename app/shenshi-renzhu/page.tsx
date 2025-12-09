'use client';

import { InkButton, InkInput, InkNotice } from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ShenShiRenZhuPage() {
  const router = useRouter();
  const { pushToast } = useInkUI();
  const { user, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [binding, setBinding] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Redirect if user is not anonymous
  useEffect(() => {
    if (!isLoading && user && !user.is_anonymous) {
      pushToast({ message: '你的真身已与神识绑定' });
      router.push('/');
    }
  }, [user, isLoading, router, pushToast]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      pushToast({ message: '请输入飞鸽传书地址', tone: 'warning' });
      return;
    }

    setSendingCode(true);
    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '天机印发送失败');
      }

      setCodeSent(true);
      setCountdown(60);
      pushToast({
        message: '天机印已发往你的飞鸽传书地址',
        tone: 'success',
      });

      // In development, show the code
      if (result.code) {
        console.log('[DEV] Verification code:', result.code);
        pushToast({ message: `[开发模式] 天机印：${result.code}` });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '天机印发送失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setSendingCode(false);
    }
  };

  const handleBindEmail = async () => {
    if (!email.trim() || !code.trim()) {
      pushToast({ message: '请填写所有信息', tone: 'warning' });
      return;
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      pushToast({ message: '天机印应为6位数字', tone: 'warning' });
      return;
    }

    setBinding(true);
    try {
      const response = await fetch('/api/auth/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '神识认主失败');
      }

      pushToast({
        message: '神识认主成功！真身已与你绑定。',
        tone: 'success',
      });

      // Redirect to home after success
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '神识认主失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setBinding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">神识感应中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【神识认主】"
      subtitle="绑定飞鸽传书，永存真身"
      backHref="/"
      currentPath="/shenshi-renzhu"
      footer={
        <div className="flex justify-between">
          <InkButton href="/">返回</InkButton>
        </div>
      }
    >
      <div className="space-y-6">
        <InkNotice>
          游客真身易逝，绑定神识方可长存。
          <br />
          请留下你的飞鸽传书地址（邮箱），日后可凭此召回真身。
        </InkNotice>

        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm opacity-70">
              飞鸽传书地址（邮箱）
            </label>
            <InkInput
              value={email}
              onChange={(value) => setEmail(value)}
              placeholder="例：daoyou@xiuxian.com"
              disabled={sendingCode || binding}
            />
          </div>

          <InkButton
            onClick={handleSendCode}
            variant="primary"
            disabled={sendingCode || countdown > 0 || binding}
            className="w-full"
          >
            {countdown > 0
              ? `${countdown}息后可重新获取`
              : sendingCode
                ? '推演中…'
                : '获取天机印'}
          </InkButton>
        </div>

        {codeSent && (
          <>
            <div className="border-t border-ink-border pt-6">
              <InkNotice tone="info">已获天机印？请在此输入：</InkNotice>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm opacity-70">
                  6位天机印
                </label>
                <InkInput
                  value={code}
                  onChange={(value) => setCode(value)}
                  placeholder="例：123456"
                  disabled={binding}
                />
              </div>

              <InkButton
                onClick={handleBindEmail}
                variant="primary"
                disabled={binding || !code.trim()}
                className="w-full"
              >
                {binding ? '认主中…' : '认主'}
              </InkButton>
            </div>
          </>
        )}
      </div>
    </InkPageShell>
  );
}

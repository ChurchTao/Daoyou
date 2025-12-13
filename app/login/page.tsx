'use client';

import { InkButton, InkInput, InkNotice } from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useInkUI();
  const { user, isLoading } = useAuth();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Check if user came back from magic link (keeping as fallback)
  useEffect(() => {
    const handleMagicLinkCallback = async () => {
      const code = searchParams.get('code');
      if (code && !processing) {
        setProcessing(true);
      }
    };
    handleMagicLinkCallback();
  }, [searchParams, processing]);

  // Redirect if user is already logged in
  useEffect(() => {
    if (!isLoading && user && !user.is_anonymous) {
      pushToast({ message: '真身已召回成功' });
      router.push('/');
    }
  }, [user, isLoading, router, pushToast]);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      pushToast({ message: '请输入飞鸽传书地址', tone: 'warning' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      pushToast({ message: '飞鸽传书地址格式有误', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          throw new Error('请求过于频繁，请一个时辰后再试');
        }
        if (error.message.includes('not found')) {
          throw new Error('未找到此真身，请先进行神识认主');
        }
        throw error;
      }

      setStep('otp');
      pushToast({
        message: '召唤符已发往你的飞鸽传书地址',
        tone: 'success',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '发送失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      pushToast({ message: '请输入召唤符', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });

      if (error) {
        throw error;
      }

      pushToast({ message: '口令验证通过，真身归位', tone: 'success' });
      // Redirect will happen via useEffect when user state updates
    } catch (error) {
      console.error(error);
      pushToast({ message: '召唤符有误或已失效', tone: 'danger' });
      setLoading(false);
    }
  };

  if (isLoading || processing) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">
          {processing ? '召回真身中……' : '神识感应中……'}
        </p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【召回真身】"
      subtitle="已有真身，重归修仙之路"
      backHref="/"
      currentPath="/login"
    >
      <div className="space-y-6">
        {step === 'email' ? (
          <>
            <InkNotice>
              若你曾在此修炼，真身已与神识绑定。
              <br />
              留下飞鸽传书地址，系统将发送召唤符助你真身归位。
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
                  disabled={loading}
                />
              </div>

              <InkButton
                onClick={handleSendOtp}
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                {loading ? '发送中…' : '发送召唤符'}
              </InkButton>
            </div>
          </>
        ) : (
          <>
            <InkNotice>
              ✓ 召唤符已发送！
              <br />
              请查收发送至 <strong>{email}</strong> 的邮件，并填入下方的口令。
            </InkNotice>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm opacity-70">
                  召唤符（验证码）
                </label>
                <InkInput
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  placeholder="请输入8位召唤符"
                  disabled={loading}
                />
              </div>

              <InkButton
                onClick={handleVerifyOtp}
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                {loading ? '验证中…' : '口令认证'}
              </InkButton>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep('email')}
                  className="text-sm opacity-60 hover:opacity-100 transition-opacity"
                  disabled={loading}
                >
                  ← 修改地址
                </button>
                <button
                  onClick={handleSendOtp}
                  className="text-sm opacity-60 hover:opacity-100 transition-opacity"
                  disabled={loading}
                >
                  重发口令
                </button>
              </div>

              <InkNotice tone="info">
                未收到？
                <br />
                • 请检查垃圾邮件文件夹
                <br />• 稍等片刻后点击重发
              </InkNotice>
            </div>
          </>
        )}
      </div>
    </InkPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-paper min-h-screen flex items-center justify-center">
          <p className="loading-tip">神识感应中……</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

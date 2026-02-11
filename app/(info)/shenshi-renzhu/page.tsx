'use client';

import TurnstileCaptcha, {
  type TurnstileCaptchaHandle,
} from '@/components/auth/TurnstileCaptcha';
import { InkPageShell } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkNotice } from '@/components/ui/InkNotice';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function ShenShiRenZhuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useInkUI();
  const { user, isLoading, createAnonymousUser } = useAuth();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Check if user came back from email confirmation link
  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const code = searchParams.get('code');
      if (code && !processing) {
        setProcessing(true);
      }
    };

    handleEmailConfirmation();
  }, [searchParams, processing]);

  // Redirect if user is already bound (not anonymous)
  useEffect(() => {
    if (!isLoading && user && !user.is_anonymous) {
      pushToast({ message: '你的真身已与神识绑定成功' });
      router.push('/game');
    }
  }, [user, isLoading, router, pushToast]);

  const handleSendConfirmation = async () => {
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
    if (!turnstileSiteKey) {
      pushToast({
        message: '未配置验证码站点密钥，请联系管理员',
        tone: 'danger',
      });
      return;
    }
    if (!captchaToken) {
      pushToast({ message: '请先完成人机验证', tone: 'warning' });
      return;
    }

    setSendingEmail(true);
    try {
      // 全局 CAPTCHA 开启后，匿名会话必须带 token 创建。
      if (!user) {
        const { error: createError } = await createAnonymousUser(captchaToken);
        if (createError) {
          throw createError;
        }
      }

      // Use updateUser to send email confirmation
      // This will send an email with a confirmation link
      const { error } = await supabase.auth.updateUser(
        {
          email: email.trim().toLowerCase(),
        },
        { emailRedirectTo: `${window.location.origin}/shenshi-renzhu` },
      );

      if (error) {
        // Check for specific error cases
        if (error.message.includes('rate limit')) {
          throw new Error('请求过于频繁，请一个时辰后再试');
        }
        if (error.message.includes('already registered')) {
          throw new Error('此飞鸽传书地址已被他人占用');
        }
        throw error;
      }

      setEmailSent(true);
      pushToast({
        message: '天机印已发往你的飞鸽传书地址，请查收完成认主',
        tone: 'success',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '发送失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      turnstileRef.current?.reset();
      setSendingEmail(false);
    }
  };

  if (isLoading || processing) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">
          {processing ? '验证天机印中……' : '神识感应中……'}
        </p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【神识认主】"
      subtitle="绑定飞鸽传书，永存真身"
      backHref="/game"
      currentPath="/shenshi-renzhu"
      footer={
        <div className="flex justify-between">
          <InkButton href="/game">返回</InkButton>
        </div>
      }
    >
      <div className="space-y-6">
        {!emailSent ? (
          <>
            <InkNotice>游客真身易逝，绑定神识方可长存。</InkNotice>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm opacity-70">
                  飞鸽传书地址（邮箱）
                </label>
                <InkInput
                  value={email}
                  onChange={(value) => setEmail(value)}
                  placeholder="例：daoyou@xiuxian.com"
                  disabled={sendingEmail}
                />
              </div>

              <InkButton
                onClick={handleSendConfirmation}
                variant="primary"
                disabled={sendingEmail}
                className="w-full"
              >
                {sendingEmail ? '发送中…' : '发送天机印'}
              </InkButton>

              <TurnstileCaptcha
                ref={turnstileRef}
                onTokenChange={setCaptchaToken}
              />
            </div>
          </>
        ) : (
          <>
            <InkNotice>
              ✓ 天机印已发送！
              <br />
              <br />
              请查收发送至 <strong>{email}</strong> 的邮件。
              <br />
              点击邮件中的链接即可完成神识认主。
            </InkNotice>

            <InkNotice>
              未收到邮件？
              <br />
              • 请检查垃圾邮件文件夹
              <br />
              • 等待片刻后重试
              <br />• 确认邮箱地址正确
            </InkNotice>

            <InkButton
              onClick={() => {
                setEmailSent(false);
                setEmail('');
              }}
              variant="secondary"
              className="w-full"
            >
              重新输入邮箱
            </InkButton>
          </>
        )}
      </div>
    </InkPageShell>
  );
}

export default function ShenShiRenZhuPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-paper flex min-h-screen items-center justify-center">
          <p className="loading-tip">神识感应中……</p>
        </div>
      }
    >
      <ShenShiRenZhuContent />
    </Suspense>
  );
}

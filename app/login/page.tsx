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
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Check if user came back from magic link
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

  const handleSendMagicLink = async () => {
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

    setSendingLink(true);
    try {
      // Send magic link for login
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false, // Don't create new users on login page
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        // Check for specific error cases
        if (error.message.includes('rate limit')) {
          throw new Error('请求过于频繁，请一个时辰后再试');
        }
        if (error.message.includes('not found')) {
          throw new Error('未找到此真身，请先进行神识认主');
        }
        throw error;
      }

      setLinkSent(true);
      pushToast({
        message: '召唤符已发往你的飞鸽传书地址',
        tone: 'success',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '发送失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setSendingLink(false);
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
        {!linkSent ? (
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
                  disabled={sendingLink}
                />
              </div>

              <InkButton
                onClick={handleSendMagicLink}
                variant="primary"
                disabled={sendingLink}
                className="w-full"
              >
                {sendingLink ? '发送中…' : '发送召唤符'}
              </InkButton>
            </div>
          </>
        ) : (
          <>
            <InkNotice>
              ✓ 召唤符已发送！
              <br />
              <br />
              请查收发送至 <strong>{email}</strong> 的邮件。
              <br />
              点击邮件中的链接即可召回真身，重归修仙之路。
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
                setLinkSent(false);
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

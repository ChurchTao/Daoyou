'use client';

import { InkButton, InkInput, InkNotice } from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ShenShiRenZhuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useInkUI();
  const { user, isLoading } = useAuth();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Check if user came back from email confirmation link
  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const code = searchParams.get('code');

      if (code && !processing) {
        setProcessing(true);
        try {
          // Exchange the code for a session
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('Email confirmation error:', error);
            pushToast({
              message: '神识认主失败，请重试',
              tone: 'danger',
            });
            return;
          }

          // Check if user is no longer anonymous
          if (data.user && !data.user.is_anonymous) {
            pushToast({
              message: '神识认主成功！真身已与你绑定。',
              tone: 'success',
            });

            // Redirect to home after showing success
            setTimeout(() => {
              router.push('/');
              window.location.reload();
            }, 1500);
          } else {
            pushToast({
              message: '绑定验证中，请稍候...',
              tone: 'warning',
            });
          }
        } catch (error) {
          console.error('Confirmation process error:', error);
          pushToast({
            message: '处理确认链接时出错',
            tone: 'danger',
          });
        } finally {
          setProcessing(false);
        }
      }
    };

    handleEmailConfirmation();
  }, [searchParams, supabase, pushToast, router, processing]);

  // Redirect if user is already bound (not anonymous)
  useEffect(() => {
    if (!isLoading && user && !user.is_anonymous && !searchParams.get('code')) {
      pushToast({ message: '你的真身已与神识绑定' });
      router.push('/');
    }
  }, [user, isLoading, router, pushToast, searchParams]);

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

    setSendingEmail(true);
    try {
      // Use updateUser to send email confirmation
      // This will send an email with a confirmation link
      const { error } = await supabase.auth.updateUser({
        email: email.trim().toLowerCase(),
      });

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
        message: '天机印已发往你的飞鸽传书地址，请查收邮件并点击链接完成认主',
        tone: 'success',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '发送失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading || processing) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
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
      backHref="/"
      currentPath="/shenshi-renzhu"
      footer={
        <div className="flex justify-between">
          <InkButton href="/">返回</InkButton>
        </div>
      }
    >
      <div className="space-y-6">
        {!emailSent ? (
          <>
            <InkNotice>游客真身易逝，绑定神识方可长存。</InkNotice>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm opacity-70">
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

import {
  AuthPageShell,
  AuthTurnstileField,
  toErrorMessage,
  useAuthFeedback,
  useTurnstileField,
  validateEmailField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/AuthContext';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export default function ForgotPasswordRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const { showDialog, showErrorDialog } = useAuthFeedback();
  const {
    turnstileEnabled,
    turnstileRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaToken,
  } = useTurnstileField();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});

  const handleSubmit = async () => {
    const emailError = validateEmailField(email);
    setErrors({ email: emailError });

    if (emailError) {
      return;
    }

    const verifiedCaptchaToken = ensureCaptcha();
    if (verifiedCaptchaToken === null) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await requestPasswordReset(
        email,
        verifiedCaptchaToken || undefined,
      );

      if (error) {
        throw error;
      }

      showDialog({
        title: '飞书已发',
        message: '若该邮箱已有真身，重设链接已寄出。',
        confirmLabel: '去登录',
        cancelLabel: '留在此页',
        onConfirm: () => navigate('/login/password', { replace: true }),
      });
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '发送失败，请稍后重试'),
        '发送失败',
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【找回口令】"
      lead="输入邮箱，接收重设链接。"
      backHref="/login/password"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href="/login/password" variant="ghost">
            返回口令登录
          </InkButton>
          <InkButton href="/login/email" variant="secondary">
            改用邮箱口令
          </InkButton>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <InkInput
          label="飞鸽传书地址"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setErrors({ email: undefined });
          }}
          placeholder="例：daoyou@xiuxian.com"
          error={errors.email}
          disabled={loading}
        />
        <AuthTurnstileField
          enabled={turnstileEnabled}
          error={captchaError}
          turnstileRef={turnstileRef}
          onTokenChange={setCaptchaToken}
        />
        <InkButton
          type="submit"
          variant="primary"
          disabled={loading}
          className="w-full text-center"
        >
          {loading ? '发送中…' : '发送重设链接'}
        </InkButton>
      </form>
    </AuthPageShell>
  );
}

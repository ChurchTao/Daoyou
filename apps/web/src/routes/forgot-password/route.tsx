import {
  AuthPageShell,
  AuthCaptchaField,
  buildEmailOtpTarget,
  toErrorMessage,
  useAuthFeedback,
  useCaptchaField,
  validateEmailField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export default function ForgotPasswordRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const { showDialog, showErrorDialog } = useAuthFeedback();
  const {
    captchaRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaPayload,
  } = useCaptchaField();

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
        title: '邮件已发送',
        message: '如果该邮箱已注册，重置链接已发送。',
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
      title="【找回密码】"
      lead="输入邮箱，接收密码重置链接。"
      backHref="/login/password"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href="/login/password" variant="ghost">
            返回密码登录
          </InkButton>
          <InkButton
            href={buildEmailOtpTarget('/login/email', { email })}
            variant="secondary"
          >
            改用邮箱验证码
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
          label="邮箱"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setErrors({ email: undefined });
          }}
          placeholder="例：player@example.com"
          error={errors.email}
          disabled={loading}
        />
        <AuthCaptchaField
          action="password-reset"
          error={captchaError}
          captchaRef={captchaRef}
          onPayloadChange={setCaptchaPayload}
        />
        <InkButton
          type="submit"
          variant="primary"
          pending={loading}
          pendingLabel="发送中……"
          className="w-full text-center"
        >
          发送重设链接
        </InkButton>
      </form>
    </AuthPageShell>
  );
}

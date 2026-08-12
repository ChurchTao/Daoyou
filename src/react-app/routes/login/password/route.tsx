import {
  AuthPageShell,
  AuthCaptchaField,
  buildEmailOtpTarget,
  toErrorMessage,
  useAuthFeedback,
  useCaptchaField,
  validateEmailField,
  validateRequiredField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export default function LoginPasswordRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const verificationSent = searchParams.get('verification') === 'sent';
  const { signInWithPassword } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const {
    captchaRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaPayload,
  } = useCaptchaField();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const handleSubmit = async () => {
    const nextErrors = {
      email: validateEmailField(email),
      password: validateRequiredField(password, '请输入密码'),
    };
    setErrors(nextErrors);

    if (nextErrors.email || nextErrors.password) {
      return;
    }

    const verifiedCaptchaToken = ensureCaptcha();
    if (verifiedCaptchaToken === null) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await signInWithPassword(
        email,
        password,
        verifiedCaptchaToken || undefined,
      );

      if (error) {
        throw error;
      }

      navigate('/game', { replace: true });
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '登录失败，请稍后重试'),
        '登录失败',
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【密码登录】"
      lead={
        verificationSent
          ? `验证邮件已发送至 ${email.trim()}，请点击邮件中的链接完成验证。`
          : '使用邮箱和密码登录。'
      }
      backHref="/login"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href="/forgot-password" variant="ghost">
            忘记密码
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
        {verificationSent ? (
          <p
            role="status"
            className="border-crimson/25 bg-crimson/5 text-ink-secondary border border-dashed px-3 py-2 text-sm leading-6"
          >
            完成验证后会自动登录并进入游戏。若未收到邮件，请检查垃圾邮件；
            也可在此使用刚设置的密码登录，系统会重新发送验证邮件。
          </p>
        ) : null}
        <InkInput
          label="邮箱"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          placeholder="例：player@example.com"
          error={errors.email}
          disabled={loading}
        />
        <InkInput
          label="密码"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          placeholder="请输入密码"
          error={errors.password}
          disabled={loading}
        />
        <AuthCaptchaField
          action="sign-in"
          error={captchaError}
          captchaRef={captchaRef}
          onPayloadChange={setCaptchaPayload}
        />
        <InkButton
          type="submit"
          variant="primary"
          pending={loading}
          pendingLabel="登录中……"
          className="w-full text-center"
        >
          立即登录
        </InkButton>
      </form>
    </AuthPageShell>
  );
}

import {
  AuthPageShell,
  buildEmailOtpTarget,
  getEmailOtpVerifyFieldErrors,
  isEmailOtpNameRequiredError,
  toErrorMessage,
  useAuthFeedback,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
import { useState } from 'react';
import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';

export default function LoginVerifyRoute() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const email = searchParams.get('email');
  const source = searchParams.get('source') === 'signup' ? 'signup' : 'login';
  const presetName =
    (location.state as { displayName?: string } | null)?.displayName ??
    searchParams.get('name') ??
    '';

  if (!email) {
    return (
      <Navigate
        to={buildEmailOtpTarget('/login/email', { source })}
        replace
        state={location.state}
      />
    );
  }

  return (
    <LoginVerifyPage email={email} presetName={presetName} source={source} />
  );
}

function LoginVerifyPage({
  email,
  presetName,
  source,
}: {
  email: string;
  presetName: string;
  source: 'login' | 'signup';
}) {
  const navigate = useNavigate();
  const { verifyEmailOtp } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const [displayName, setDisplayName] = useState(presetName);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayNameRequired, setDisplayNameRequired] = useState(false);
  const [errors, setErrors] = useState<{ displayName?: string; otp?: string }>(
    {},
  );

  const editAddressHref = buildEmailOtpTarget('/login/email', {
    email,
    displayName,
    source,
  });

  const handleSubmit = async () => {
    const nextErrors = getEmailOtpVerifyFieldErrors({
      otp,
      displayName,
      displayNameRequired,
    });
    setErrors(nextErrors);

    if (nextErrors.otp || nextErrors.displayName) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await verifyEmailOtp(email, otp, displayName);

      if (error) {
        throw error;
      }

      navigate('/game', { replace: true });
    } catch (error) {
      const authError = error as AuthActionError;

      if (isEmailOtpNameRequiredError(authError)) {
        setDisplayNameRequired(true);
        setErrors((current) => ({
          ...current,
          displayName: '请输入昵称',
        }));
        return;
      }

      showErrorDialog(
        toErrorMessage(authError, '验证码错误或已失效'),
        '验证失败',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【验证码验证】"
      lead="输入验证码完成登录。首次使用该邮箱时会自动注册账号。"
      subtitle={`验证码已发送到 ${email}`}
      backHref={editAddressHref}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href={editAddressHref} variant="ghost">
            修改邮箱
          </InkButton>
          <InkButton
            href={
              source === 'signup'
                ? buildEmailOtpTarget('/signup/password', {
                    email,
                    displayName,
                  })
                : buildEmailOtpTarget('/login/password', { email })
            }
            variant="secondary"
          >
            {source === 'signup' ? '改为密码注册' : '改用密码登录'}
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
          label="验证码"
          value={otp}
          onChange={(value) => {
            setOtp(value);
            setErrors((current) => ({ ...current, otp: undefined }));
          }}
          placeholder="请输入 6 位验证码"
          error={errors.otp}
          disabled={loading}
        />
        <InkInput
          label={displayNameRequired ? '昵称' : '昵称（可选）'}
          value={displayName}
          onChange={(value) => {
            setDisplayName(value);
            setErrors((current) => ({ ...current, displayName: undefined }));
          }}
          placeholder="例：青岚"
          hint={
            displayNameRequired
              ? '首次注册需要填写昵称，补全后可直接重试。'
              : '已有账号可留空，首次注册时再填写。'
          }
          error={errors.displayName}
          disabled={loading}
        />
        <InkButton
          type="submit"
          variant="primary"
          pending={loading}
          pendingLabel="验证中……"
          className="w-full text-center"
        >
          验证并继续
        </InkButton>
      </form>
    </AuthPageShell>
  );
}

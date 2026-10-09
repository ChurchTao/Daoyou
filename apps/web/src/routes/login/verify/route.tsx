import {
  AuthPageShell,
  buildEmailOtpTarget,
  toErrorMessage,
  useAuthFeedback,
  validateRequiredField,
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

  if (!email) {
    return (
      <Navigate
        to={buildEmailOtpTarget('/login/email', { source })}
        replace
        state={location.state}
      />
    );
  }

  return <LoginVerifyPage email={email} source={source} />;
}

function LoginVerifyPage({
  email,
  source,
}: {
  email: string;
  source: 'login' | 'signup';
}) {
  const navigate = useNavigate();
  const { verifyEmailOtp } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ otp?: string }>({});

  const editAddressHref = buildEmailOtpTarget('/login/email', {
    email,
    source,
  });

  const handleSubmit = async () => {
    const otpError = validateRequiredField(otp, '请输入验证码');
    setErrors({ otp: otpError });

    if (otpError) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await verifyEmailOtp(email, otp);

      if (error) {
        throw error;
      }

      navigate('/game', { replace: true });
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '验证码错误或已失效'),
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

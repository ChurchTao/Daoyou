import TurnstileCaptcha, {
  type TurnstileCaptchaHandle,
} from '@app/components/auth/TurnstileCaptcha';
import type { RefObject } from 'react';

interface AuthTurnstileFieldProps {
  enabled: boolean;
  error?: string;
  turnstileRef: RefObject<TurnstileCaptchaHandle | null>;
  onTokenChange: (token: string | null) => void;
}

export function AuthTurnstileField({
  enabled,
  error,
  turnstileRef,
  onTokenChange,
}: AuthTurnstileFieldProps) {
  if (!enabled) {
    return null;
  }

  return (
    <div className="space-y-2">
      <TurnstileCaptcha ref={turnstileRef} onTokenChange={onTokenChange} />
      {error ? <p className="text-crimson text-[0.8rem]">{error}</p> : null}
    </div>
  );
}

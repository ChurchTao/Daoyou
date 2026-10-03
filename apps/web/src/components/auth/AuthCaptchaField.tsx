import AltchaCaptcha, {
  type AltchaAction,
  type AltchaCaptchaHandle,
} from '@app/components/auth/AltchaCaptcha';
import type { RefObject } from 'react';

interface AuthCaptchaFieldProps {
  action: AltchaAction;
  error?: string;
  captchaRef: RefObject<AltchaCaptchaHandle | null>;
  onPayloadChange: (payload: string | null) => void;
}

export function AuthCaptchaField({
  action,
  error,
  captchaRef,
  onPayloadChange,
}: AuthCaptchaFieldProps) {
  return (
    <div className="space-y-2">
      <AltchaCaptcha
        ref={captchaRef}
        action={action}
        onPayloadChange={onPayloadChange}
      />
      {error ? <p className="text-crimson text-[0.8rem]">{error}</p> : null}
    </div>
  );
}

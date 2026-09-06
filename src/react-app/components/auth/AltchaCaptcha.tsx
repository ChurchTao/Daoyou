import { resolveApiUrl } from '@app/lib/api/url';
import 'altcha';
import type { AltchaWidgetElement } from 'altcha';
import 'altcha/i18n/zh-cn';
import 'altcha/types/react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from 'react';

export type AltchaAction =
  'sign-in' | 'sign-up' | 'password-reset' | 'email-otp';

export interface AltchaCaptchaHandle {
  reset: () => void;
}

interface AltchaCaptchaProps extends HTMLAttributes<HTMLDivElement> {
  action: AltchaAction;
  onPayloadChange: (payload: string | null) => void;
}

type AltchaStateChangeDetail = {
  payload?: string;
  state?: string;
};

const AltchaCaptcha = forwardRef<AltchaCaptchaHandle, AltchaCaptchaProps>(
  ({ action, onPayloadChange, className, ...rest }, ref) => {
    const widgetRef = useRef<AltchaWidgetElement | null>(null);
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [configError, setConfigError] = useState(false);
    useEffect(() => {
      const controller = new AbortController();
      fetch(resolveApiUrl('/api/captcha/config'), { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Captcha config unavailable');
          const config = await response.json();
          if (typeof config.enabled !== 'boolean')
            throw new Error('Invalid captcha config');
          if (controller.signal.aborted) return;
          setEnabled(config.enabled);
          onPayloadChange(config.enabled ? null : '');
        })
        .catch(() => {
          if (!controller.signal.aborted) setConfigError(true);
        });
      return () => controller.abort();
    }, [onPayloadChange]);
    const challengeUrl = useMemo(
      () =>
        resolveApiUrl(
          `/api/captcha/challenge?action=${encodeURIComponent(action)}`,
        ),
      [action],
    );

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          widgetRef.current?.reset();
          onPayloadChange(enabled === false ? '' : null);
        },
      }),
      [onPayloadChange, enabled],
    );

    useEffect(() => {
      const widget = widgetRef.current;
      if (!widget) {
        return;
      }

      const handleStateChange = (event: Event) => {
        const { payload, state } = (
          event as CustomEvent<AltchaStateChangeDetail>
        ).detail;
        onPayloadChange(state === 'verified' && payload ? payload : null);
      };

      widget.addEventListener('statechange', handleStateChange);
      return () => {
        widget.removeEventListener('statechange', handleStateChange);
      };
    }, [onPayloadChange, enabled]);

    if (enabled === false) return null;
    if (enabled === null)
      return (
        <div className={className} {...rest} role="status">
          {configError ? '无法加载验证配置，请刷新重试' : '正在加载验证配置…'}
        </div>
      );
    return (
      <div className={className} {...rest}>
        <altcha-widget
          ref={widgetRef}
          auto="off"
          challenge={challengeUrl}
          language="zh-cn"
          style={{ '--altcha-max-width': '100%' }}
        />
      </div>
    );
  },
);

AltchaCaptcha.displayName = 'AltchaCaptcha';

export default AltchaCaptcha;

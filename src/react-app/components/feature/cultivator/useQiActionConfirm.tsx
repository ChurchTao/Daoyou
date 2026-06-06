import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useCallback } from 'react';

export const QI_INSUFFICIENT_FRIENDLY_MESSAGE =
  '天地灵气不足，待自然恢复或使用恢复符箓后再试。';

export function getQiActionConfirmText(actionName: string, qiCost: number) {
  return `本次${actionName}将消耗 ${qiCost} 天地灵气。`;
}

export function getQiErrorMessage(
  payload: { error?: string; message?: string } | null | undefined,
  fallback: string,
) {
  if (payload?.error === 'QI_INSUFFICIENT') {
    return QI_INSUFFICIENT_FRIENDLY_MESSAGE;
  }
  return payload?.message || payload?.error || fallback;
}

export function normalizeQiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === 'QI_INSUFFICIENT') {
      return QI_INSUFFICIENT_FRIENDLY_MESSAGE;
    }
    return error.message;
  }
  return fallback;
}

export function useQiActionConfirm() {
  const { openDialog } = useInkUI();

  const openQiActionConfirm = useCallback(
    ({
      actionName,
      qiCost,
      confirmLabel,
      onConfirm,
    }: {
      actionName: string;
      qiCost: number;
      confirmLabel: string;
      onConfirm: () => void | Promise<void>;
    }) => {
      openDialog({
        title: '天地灵气消耗',
        content: (
          <div className="space-y-2 text-sm leading-7">
            <p>{getQiActionConfirmText(actionName, qiCost)}</p>
            <p className="text-ink-secondary">
              确认后会先预扣灵气；若遇到系统异常，会按规则自动退回。
            </p>
          </div>
        ),
        confirmLabel,
        cancelLabel: '再想想',
        loadingLabel: '行功中...',
        onConfirm,
      });
    },
    [openDialog],
  );

  return { openQiActionConfirm };
}

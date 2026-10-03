import { useInkUI } from '@app/components/providers/InkUIProvider';

interface AuthDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string | null;
  cancelLabel?: string | null;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

export function useAuthFeedback() {
  const { openDialog } = useInkUI();

  const showDialog = ({
    title,
    message,
    confirmLabel = '知道了',
    cancelLabel = null,
    onConfirm,
    onCancel,
  }: AuthDialogOptions) =>
    openDialog({
      title,
      content: <p className="leading-7">{message}</p>,
      confirmLabel,
      cancelLabel,
      onConfirm,
      onCancel,
    });

  const showErrorDialog = (message: string, title = '未能完成') =>
    showDialog({
      title,
      message,
    });

  return {
    showDialog,
    showErrorDialog,
  };
}

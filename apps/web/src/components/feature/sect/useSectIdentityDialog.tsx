import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { SectIdentityDialogContent } from './SectIdentity';

export function useSectIdentityDialog() {
  const navigate = useNavigate();
  const { openDialog } = useInkUI();

  return useCallback(() => {
    openDialog({
      title: '宗门玉牒',
      content: <SectIdentityDialogContent />,
      confirmLabel: '前往宗门',
      cancelLabel: '收起',
      onConfirm: () => navigate('/game/sect'),
    });
  }, [navigate, openDialog]);
}

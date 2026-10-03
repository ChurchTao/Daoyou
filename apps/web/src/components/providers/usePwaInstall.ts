import { useContext } from 'react';
import { PwaInstallContext } from './pwaInstallContext';

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }
  return context;
}

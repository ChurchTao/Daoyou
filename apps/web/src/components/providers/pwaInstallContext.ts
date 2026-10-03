import type {
  PwaInstallOutcome,
  PwaInstallStatus,
} from '@app/lib/pwaInstall';
import { createContext } from 'react';

export interface PwaInstallContextValue {
  status: PwaInstallStatus;
  standalone: boolean;
  install: () => Promise<PwaInstallOutcome>;
}

export const PwaInstallContext =
  createContext<PwaInstallContextValue | null>(null);

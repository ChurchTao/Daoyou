export type PwaInstallStatus =
  | 'installed'
  | 'promptable'
  | 'manual'
  | 'unavailable';

export type PwaInstallOutcome =
  | 'accepted'
  | 'dismissed'
  | 'manual'
  | 'unavailable';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

export interface PwaInstallSnapshot {
  status: PwaInstallStatus;
  standalone: boolean;
  ios: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | undefined;
let initialized = false;
let installObserved = false;
let snapshot: PwaInstallSnapshot = {
  status: 'unavailable',
  standalone: false,
  ios: false,
};
const subscribers = new Set<() => void>();

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((navigator as StandaloneNavigator).standalone)
  );
}

function createSnapshot(): PwaInstallSnapshot {
  const standalone = isStandalone();
  return {
    standalone,
    ios: isIosDevice(),
    status: standalone || installObserved
      ? 'installed'
      : deferredPrompt
        ? 'promptable'
        : window.isSecureContext
          ? 'manual'
          : 'unavailable',
  };
}

function publish() {
  snapshot = createSnapshot();
  subscribers.forEach((subscriber) => subscriber());
}

export function initializePwaInstallCapture() {
  if (initialized) return;
  initialized = true;

  const displayMode = window.matchMedia('(display-mode: standalone)');
  const fullscreenMode = window.matchMedia('(display-mode: fullscreen)');
  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    publish();
  };
  const handleInstalled = () => {
    deferredPrompt = undefined;
    installObserved = true;
    publish();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleInstalled);
  displayMode.addEventListener('change', publish);
  fullscreenMode.addEventListener('change', publish);
  publish();
}

export function subscribePwaInstall(listener: () => void) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  return snapshot;
}

export async function requestPwaInstall(): Promise<PwaInstallOutcome> {
  if (snapshot.status === 'installed') return 'accepted';
  if (snapshot.status === 'unavailable') return 'unavailable';
  if (!deferredPrompt) return 'manual';

  const prompt = deferredPrompt;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  deferredPrompt = undefined;
  publish();
  return choice.outcome;
}

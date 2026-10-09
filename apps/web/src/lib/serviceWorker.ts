import { Workbox } from 'workbox-window';

const UPDATE_RELOAD_FALLBACK_MS = 3_000;

let workbox: Workbox | undefined;
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | undefined;

export function registerProductionServiceWorker() {
  if (!import.meta.env.PROD || workbox || !('serviceWorker' in navigator)) {
    return;
  }

  const registerOptions: RegistrationOptions = {
    scope: '/',
    updateViaCache: 'none',
  };
  workbox = new Workbox('/sw.js', registerOptions);
  registrationPromise = workbox.register();
}

export function checkForServiceWorkerUpdate() {
  if (!registrationPromise) return;

  void registrationPromise
    .then(() => workbox?.update())
    .catch(() => {
      // The version document remains the signal when this check fails.
    });
}

export function reloadForApplicationUpdate() {
  if (typeof window === 'undefined') return;

  const reload = () => {
    window.location.reload();
  };

  if (!workbox || !('serviceWorker' in navigator)) {
    reload();
    return;
  }

  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  };

  const onControllerChange = () => {
    reloadOnce();
  };
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    onControllerChange,
  );

  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => {
      if (!registration?.waiting) {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          onControllerChange,
        );
        reloadOnce();
        return;
      }

      workbox?.messageSkipWaiting();
      window.setTimeout(reloadOnce, UPDATE_RELOAD_FALLBACK_MS);
    })
    .catch(() => {
      reloadOnce();
    });
}

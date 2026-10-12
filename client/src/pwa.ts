interface CBTKUInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

declare global {
  interface WindowEventMap {
    'cbtku-pwa-state': Event;
    'cbtku-pwa-installed': Event;
  }
}

let deferredInstallPrompt: CBTKUInstallPromptEvent | null = null;

const notifyPwaState = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cbtku-pwa-state'));
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    // Keep the browser's native install prompt until the user clicks our install button.
    event.preventDefault();
    deferredInstallPrompt = event as CBTKUInstallPromptEvent;
    notifyPwaState();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    try { localStorage.setItem('cbtku_pwa_installed', '1'); } catch (_) {}
    window.dispatchEvent(new Event('cbtku-pwa-installed'));
    notifyPwaState();
  });

  // Service workers are registered only in production. Avoid interfering with Vite HMR locally.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        // The website remains usable if a browser or network blocks service-worker registration.
      });
    });
  }
}

export function isCBTKUInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iOSStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  let installedFlag = false;
  try { installedFlag = localStorage.getItem('cbtku_pwa_installed') === '1'; } catch (_) {}
  return standaloneMedia || iOSStandalone || installedFlag;
}

export function canPromptInstallCBTKU(): boolean {
  return deferredInstallPrompt !== null;
}

export async function promptInstallCBTKU(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable';
  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    notifyPwaState();
    return choice.outcome;
  } catch (_) {
    notifyPwaState();
    return 'unavailable';
  }
}

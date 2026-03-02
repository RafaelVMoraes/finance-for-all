export type ServiceWorkerRegistrationStatus = {
  registration?: ServiceWorkerRegistration;
  updateAvailable: boolean;
};

let waitingWorker: ServiceWorker | null = null;

export const registerServiceWorker = (
  onUpdateAvailable: () => void
): Promise<ServiceWorkerRegistrationStatus> => {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve({ updateAvailable: false });
  }

  return navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      const notifyUpdateIfWaiting = () => {
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          onUpdateAvailable();
        }
      };

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            waitingWorker = newWorker;
            onUpdateAvailable();
          }
        });
      });

      notifyUpdateIfWaiting();

      return {
        registration,
        updateAvailable: Boolean(registration.waiting),
      };
    })
    .catch(() => ({ updateAvailable: false }));
};

export const applyServiceWorkerUpdate = () => {
  if (!waitingWorker) return;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
};

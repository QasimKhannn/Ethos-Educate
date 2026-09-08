export type ServiceWorkerUpdate = (reloadPage?: boolean) => Promise<void>;

type ServiceWorkerUpdateListener = (updateServiceWorker: ServiceWorkerUpdate) => void;

let pendingServiceWorkerUpdate: ServiceWorkerUpdate | null = null;
const listeners = new Set<ServiceWorkerUpdateListener>();

export const notifyServiceWorkerUpdate = (updateServiceWorker: ServiceWorkerUpdate) => {
  pendingServiceWorkerUpdate = updateServiceWorker;
  listeners.forEach((listener) => listener(updateServiceWorker));
};

export const subscribeToServiceWorkerUpdate = (listener: ServiceWorkerUpdateListener) => {
  listeners.add(listener);

  if (pendingServiceWorkerUpdate != null) {
    listener(pendingServiceWorkerUpdate);
  }

  return () => listeners.delete(listener);
};

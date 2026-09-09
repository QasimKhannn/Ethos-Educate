import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@librechat/client';
import { useRecoilValue } from 'recoil';
import type { ServiceWorkerUpdate } from '~/utils/serviceWorkerUpdate';
import { mainTextareaId } from '~/common';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { subscribeToServiceWorkerUpdate } from '~/utils/serviceWorkerUpdate';

const automaticUpdateDelay = 30 * 1000;
const postponedUpdateDelay = 5 * 60 * 1000;
const updateReloadFallbackDelay = 15 * 1000;

const composerHasText = () => {
  const composer = document.getElementById(mainTextareaId);
  return composer instanceof HTMLTextAreaElement && composer.value.trim().length > 0;
};

const isFormField = (target: EventTarget | null) => {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
};

const AppUpdateNotice = () => {
  const localize = useLocalize();
  const isSubmitting = useRecoilValue(store.anySubmittingSelector);
  const hasPendingFiles = useRecoilValue(store.hasPendingFilesSelector);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<ServiceWorkerUpdate | null>(null);
  const [hasComposerText, setHasComposerText] = useState(composerHasText);
  const [hasPendingFormChanges, setHasPendingFormChanges] = useState(false);
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === 'visible');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateAt, setUpdateAt] = useState<number | null>(null);

  const hasWorkInProgress =
    isSubmitting || hasComposerText || hasPendingFiles || hasPendingFormChanges;

  const applyUpdate = useCallback(async () => {
    if (updateServiceWorker == null || isUpdating) {
      return;
    }

    setIsUpdating(true);
    const reloadFallback = window.setTimeout(() => {
      window.location.reload();
    }, updateReloadFallbackDelay);

    try {
      await updateServiceWorker();
    } catch {
      window.clearTimeout(reloadFallback);
      setIsUpdating(false);
    }
  }, [isUpdating, updateServiceWorker]);

  useEffect(() => {
    return subscribeToServiceWorkerUpdate((update) => {
      setUpdateServiceWorker(() => update);
      setUpdateAt(Date.now() + automaticUpdateDelay);
    });
  }, []);

  useEffect(() => {
    const handleInput = (event: Event) => {
      if (!isFormField(event.target)) {
        return;
      }

      if (event.target instanceof HTMLTextAreaElement && event.target.id === mainTextareaId) {
        setHasComposerText(event.target.value.trim().length > 0);
        return;
      }

      setHasPendingFormChanges(true);
    };

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (
      updateServiceWorker == null ||
      updateAt == null ||
      hasWorkInProgress ||
      !isVisible ||
      isUpdating
    ) {
      return;
    }

    const delay = Math.max(updateAt - Date.now(), 0);
    const timeout = window.setTimeout(() => {
      void applyUpdate();
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [applyUpdate, hasWorkInProgress, isUpdating, isVisible, updateAt, updateServiceWorker]);

  if (updateServiceWorker == null) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[1001] flex justify-center">
      <section
        aria-live="polite"
        className="pointer-events-auto w-full max-w-xl rounded-xl border border-primary/30 bg-surface-primary p-4 shadow-xl"
      >
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-text-primary">
              {localize('com_ui_release_update_ready_title')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {localize('com_ui_release_update_ready_message')}
            </p>
            {hasWorkInProgress && (
              <p className="mt-2 text-sm text-text-secondary">
                {localize('com_ui_release_update_finish_work')}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUpdateAt(Date.now() + postponedUpdateDelay)}
              >
                {localize('com_ui_release_update_shortly')}
              </Button>
              <Button disabled={isUpdating} onClick={() => void applyUpdate()}>
                {isUpdating ? localize('com_ui_updating') : localize('com_ui_release_update_now')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AppUpdateNotice;

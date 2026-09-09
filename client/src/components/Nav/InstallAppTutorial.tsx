import { useCallback, useEffect, useState } from 'react';
import { Check, Download, Laptop, QrCode, Share, Smartphone, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface InstallAppTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type InstallPlatform = 'android' | 'desktop' | 'ios';

const EDUCATE_INSTALL_URL = 'https://educhat.charterschoolsusa.com/';

interface InstallGuide {
  steps: ReadonlyArray<InstallStep>;
}

interface InstallStep {
  description: string;
  icon: typeof Share;
  title: string;
}

const getInstallPlatform = (): InstallPlatform => {
  const userAgent = window.navigator.userAgent;

  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return 'ios';
  }

  return /Android/.test(userAgent) ? 'android' : 'desktop';
};

const getIsInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const getInstallGuide = (
  installPlatform: InstallPlatform,
  localize: ReturnType<typeof useLocalize>,
): InstallGuide => {
  if (installPlatform === 'ios') {
    return {
      steps: [
        {
          icon: Smartphone,
          title: localize('com_nav_install_app_card_open'),
          description: localize('com_nav_install_app_ios_card_1'),
        },
        {
          icon: Share,
          title: localize('com_nav_install_app_card_share'),
          description: localize('com_nav_install_app_ios_card_2'),
        },
        {
          icon: Download,
          title: localize('com_nav_install_app_card_add_home'),
          description: localize('com_nav_install_app_ios_card_3'),
        },
        {
          icon: Check,
          title: localize('com_nav_install_app_card_confirm'),
          description: localize('com_nav_install_app_ios_card_4'),
        },
        {
          icon: Smartphone,
          title: localize('com_nav_install_app_card_find'),
          description: localize('com_nav_install_app_ios_card_5'),
        },
        {
          icon: Check,
          title: localize('com_nav_install_app_card_open_app'),
          description: localize('com_nav_install_app_ios_card_6'),
        },
      ],
    };
  }

  if (installPlatform === 'android') {
    return {
      steps: [
        {
          icon: Smartphone,
          title: localize('com_nav_install_app_card_open'),
          description: localize('com_nav_install_app_android_card_1'),
        },
        {
          icon: Download,
          title: localize('com_nav_install_app_card_menu'),
          description: localize('com_nav_install_app_android_card_2'),
        },
        {
          icon: Check,
          title: localize('com_nav_install_app_card_add_home'),
          description: localize('com_nav_install_app_android_card_3'),
        },
        {
          icon: Check,
          title: localize('com_nav_install_app_card_confirm'),
          description: localize('com_nav_install_app_android_card_4'),
        },
        {
          icon: Smartphone,
          title: localize('com_nav_install_app_card_find'),
          description: localize('com_nav_install_app_android_card_5'),
        },
        {
          icon: Check,
          title: localize('com_nav_install_app_card_open_app'),
          description: localize('com_nav_install_app_android_card_6'),
        },
      ],
    };
  }

  return {
    steps: [
      {
        icon: Laptop,
        title: localize('com_nav_install_app_card_open'),
        description: localize('com_nav_install_app_desktop_card_1'),
      },
      {
        icon: Download,
        title: localize('com_nav_install_app_card_install'),
        description: localize('com_nav_install_app_desktop_card_2'),
      },
      {
        icon: Check,
        title: localize('com_nav_install_app_card_choose_install'),
        description: localize('com_nav_install_app_desktop_card_3'),
      },
      {
        icon: Check,
        title: localize('com_nav_install_app_card_confirm'),
        description: localize('com_nav_install_app_desktop_card_4'),
      },
      {
        icon: Laptop,
        title: localize('com_nav_install_app_card_find'),
        description: localize('com_nav_install_app_desktop_card_5'),
      },
      {
        icon: Check,
        title: localize('com_nav_install_app_card_open_app'),
        description: localize('com_nav_install_app_desktop_card_6'),
      },
    ],
  };
};

const InstallAppTutorial = ({ open, onOpenChange }: InstallAppTutorialProps) => {
  const localize = useLocalize();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(getIsInstalled);
  const [isInstallInProgress, setIsInstallInProgress] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<InstallPlatform>(getInstallPlatform);
  const [isQrCodeOpen, setIsQrCodeOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    setIsInstalled(getIsInstalled());
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    if (installPrompt == null) {
      return;
    }

    setIsInstallInProgress(true);
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      setInstallPrompt(null);
      setIsInstalled(outcome === 'accepted');
    } finally {
      setIsInstallInProgress(false);
    }
  }, [installPrompt]);

  const handleTutorialOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setIsQrCodeOpen(false);
      }

      onOpenChange(isOpen);
    },
    [onOpenChange],
  );

  const guide = getInstallGuide(installPlatform, localize);
  const canRequestInstall = installPrompt != null && !isInstalled;
  const canShowQrCode = installPlatform !== 'desktop';
  const platformTabs: ReadonlyArray<{ id: InstallPlatform; label: string }> = [
    { id: 'android', label: localize('com_nav_install_app_tab_android') },
    { id: 'ios', label: localize('com_nav_install_app_tab_ios') },
    { id: 'desktop', label: localize('com_nav_install_app_tab_desktop') },
  ];

  return (
    <Dialog open={open} onOpenChange={handleTutorialOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl gap-0 overflow-y-auto rounded-xl border border-[#13264C]/20 bg-surface-primary p-0 text-text-primary shadow-xl dark:border-[#DAAC60]/35 sm:max-h-[calc(100dvh-3rem)]"
      >
        <DialogHeader className="relative border-b border-[#DAAC60]/70 bg-[#13264C] px-5 py-4 pr-16">
          <DialogTitle className="text-base font-semibold leading-6 text-white">
            {localize('com_nav_install_app_title')}
          </DialogTitle>
          <p className="mt-1 text-sm leading-5 text-white/75">
            {localize('com_nav_install_app_description')}
          </p>
          <button
            type="button"
            aria-label={localize('com_ui_close')}
            className="absolute right-5 top-4 flex h-9 w-9 items-center justify-center rounded-md border border-[#DAAC60]/55 bg-white/10 text-white transition-colors hover:bg-[#DAAC60] hover:text-[#13264C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAAC60] focus-visible:ring-offset-2 focus-visible:ring-offset-[#13264C]"
            onClick={() => handleTutorialOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{localize('com_ui_close')}</span>
          </button>
        </DialogHeader>
        <div className="px-5 py-5">
          {isInstalled && (
            <div className="dark:border-border-dark rounded-lg border border-border-light bg-surface-secondary px-3 py-3 text-sm leading-5 text-text-secondary">
              {localize('com_nav_install_app_already_installed')}
            </div>
          )}
          {!isInstalled && (
            <>
              <div
                className="mb-5 grid grid-cols-3 rounded-lg border border-[#13264C]/15 bg-[#F7F5EF] p-1 dark:border-[#DAAC60]/25 dark:bg-[#13264C]/30"
                role="tablist"
                aria-label={localize('com_nav_install_app_choose_device')}
              >
                {platformTabs.map((platform) => (
                  <button
                    type="button"
                    key={platform.id}
                    role="tab"
                    aria-selected={installPlatform === platform.id}
                    className="rounded-md border border-transparent px-2 py-1.5 text-xs font-semibold text-[#13264C]/70 transition-colors hover:bg-white hover:text-[#13264C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAAC60] focus-visible:ring-offset-2 aria-selected:border-[#DAAC60] aria-selected:bg-[#DAAC60] aria-selected:text-[#13264C] aria-selected:shadow-sm dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:aria-selected:bg-[#DAAC60] dark:aria-selected:text-[#13264C]"
                    onClick={() => setInstallPlatform(platform.id)}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>
              <ol
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                aria-label={localize('com_nav_install_app_steps_label')}
              >
                {guide.steps.map((step, index) => {
                  const StepIcon = step.icon;

                  return (
                    <li
                      key={step.title}
                      className="min-h-36 rounded-xl border border-[#13264C]/15 bg-[#F7F5EF]/55 p-4 dark:border-[#DAAC60]/25 dark:bg-[#13264C]/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-[#9A671E] dark:text-[#F1D49C]">
                            {localize('com_nav_install_app_step_label', { count: index + 1 })}
                          </p>
                          <h3 className="mt-1 text-sm font-semibold leading-5 text-[#13264C] dark:text-white">
                            {step.title}
                          </h3>
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DAAC60]/20 text-[#9A671E] dark:bg-[#DAAC60]/20 dark:text-[#F1D49C]">
                          <StepIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-[#13264C]/75 dark:text-white/75">
                        {step.description}
                      </p>
                      {index === 0 && canShowQrCode && (
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#13264C] underline decoration-[#DAAC60] decoration-2 underline-offset-4 transition-colors hover:text-[#9A671E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAAC60] focus-visible:ring-offset-2 dark:text-white dark:hover:text-[#F1D49C]"
                          onClick={() => setIsQrCodeOpen(true)}
                        >
                          <QrCode className="h-4 w-4" aria-hidden="true" />
                          {localize('com_nav_install_app_show_qr_code')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
              {canRequestInstall && (
                <Button
                  type="button"
                  className="mt-5 h-9 w-full bg-[#DAAC60] px-3 text-sm text-[#13264C] hover:bg-[#E8C37F]"
                  onClick={() => void requestInstall()}
                  disabled={isInstallInProgress}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  {localize('com_nav_install_app_button')}
                </Button>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end border-t border-[#13264C]/10 bg-[#F7F5EF]/40 px-5 py-3 dark:border-[#DAAC60]/25 dark:bg-[#13264C]/20">
          <Button
            type="button"
            variant="outline"
            className="h-9 border-[#13264C]/20 px-3 text-sm text-[#13264C] hover:bg-[#F7F5EF] dark:border-[#DAAC60]/35 dark:text-white dark:hover:bg-white/10"
            onClick={() => handleTutorialOpenChange(false)}
          >
            {localize('com_ui_close')}
          </Button>
        </div>
      </DialogContent>

      <Dialog open={isQrCodeOpen} onOpenChange={setIsQrCodeOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm gap-0 rounded-xl border border-[#13264C]/20 bg-surface-primary p-0 text-text-primary shadow-xl dark:border-[#DAAC60]/35">
          <DialogHeader className="border-b border-[#DAAC60]/55 bg-[#F7F5EF] px-5 py-4 pr-14 dark:bg-[#13264C]/40">
            <DialogTitle className="text-base font-semibold leading-6 text-[#13264C] dark:text-white">
              {localize('com_nav_install_app_qr_code_title')}
            </DialogTitle>
            <p className="mt-1 text-sm leading-5 text-[#13264C]/75 dark:text-white/75">
              {localize('com_nav_install_app_qr_code_description')}
            </p>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 px-5 py-5 text-center">
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <QRCodeSVG
                value={EDUCATE_INSTALL_URL}
                size={216}
                marginSize={2}
                title={localize('com_nav_install_app_qr_code_title')}
              />
            </div>
            <p className="text-sm leading-5 text-[#13264C]/75 dark:text-white/75">
              {localize('com_nav_install_app_qr_code_alternative')}
            </p>
            <a
              href={EDUCATE_INSTALL_URL}
              className="max-w-full break-all text-sm font-medium text-[#13264C] underline decoration-[#DAAC60] decoration-2 underline-offset-4 hover:text-[#9A671E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAAC60] focus-visible:ring-offset-2 dark:text-white dark:hover:text-[#F1D49C]"
            >
              {EDUCATE_INSTALL_URL}
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default InstallAppTutorial;

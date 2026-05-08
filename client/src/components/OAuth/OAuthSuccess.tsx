import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalize } from '~/hooks';
import { getOAuthReturnUrl, notifyOAuthOpener } from '~/utils/mcpOAuth';

const DISPLAY_NAME_MAP: Readonly<Record<string, string>> = {
  imagegen: 'Image Generation',
  outlook: 'Outlook',
  teams: 'Teams',
  monday: 'monday.com',
  sharepoint: 'SharePoint',
  onedrive: 'OneDrive',
};

const getDisplayName = (serverName: string): string => {
  const normalizedServerName = serverName.trim().toLowerCase();
  const mappedDisplayName = DISPLAY_NAME_MAP[normalizedServerName];

  if (mappedDisplayName) {
    return mappedDisplayName;
  }

  return serverName
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
};

export default function OAuthSuccess() {
  const localize = useLocalize();
  const [searchParams] = useSearchParams();
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const serverName = searchParams.get('serverName');
  const displayName = useMemo(() => {
    if (!serverName) {
      return null;
    }

    return getDisplayName(serverName);
  }, [serverName]);

  const returnUrl = useMemo(() => getOAuthReturnUrl(), []);

  const finishOAuthFlow = useCallback(() => {
    if (isRedirecting) {
      return;
    }

    setIsRedirecting(true);
    notifyOAuthOpener(serverName);

    window.setTimeout(() => {
      window.location.replace(returnUrl);
    }, 300);

    window.close();
  }, [isRedirecting, returnUrl, serverName]);

  useEffect(() => {
    const countdown = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(countdown);
          finishOAuthFlow();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(countdown);
  }, [finishOAuthFlow]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-3 text-left">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-green-600 dark:text-green-400">
            {localize('com_nav_mcp_status_connected')}
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            {localize('com_ui_oauth_success_title')}
          </h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-gray-300">
            {displayName
              ? localize('com_ui_mcp_authenticated_success', { 0: displayName })
              : localize('com_ui_oauth_success_title')}
          </p>
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-slate-800 dark:border-green-500/20 dark:bg-green-500/10 dark:text-gray-100">
            <span className="font-medium">
              {isRedirecting
                ? localize('com_ui_loading')
                : localize('com_ui_oauth_success_description')}
            </span>{' '}
            {!isRedirecting && (
              <>
                <span className="text-green-600 dark:text-green-400">{secondsLeft}</span>{' '}
                {localize('com_ui_seconds')}.
              </>
            )}
          </div>
          {displayName && (
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-gray-400">
              {localize('com_ui_oauth_connected_to')} {displayName}
            </p>
          )}
        </div>
        <div className="mt-8">
          <button
            type="button"
            onClick={finishOAuthFlow}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            aria-label={localize('com_ui_back_to_chat')}
          >
            {localize('com_ui_back_to_chat')}
          </button>
        </div>
      </div>
    </div>
  );
}

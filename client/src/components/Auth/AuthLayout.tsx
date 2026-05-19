import { useState } from 'react';
import { ThemeSelector } from '@librechat/client';
import type { TStartupConfig } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';

const UsageAgreementDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const localize = useLocalize();

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full cursor-pointer text-sm text-gray-600 hover:text-blue-600 hover:underline dark:text-gray-400 dark:hover:text-blue-400"
        aria-expanded={isOpen}
        aria-controls="usage-agreement-content"
      >
        {localize('com_auth_usage_agreement_prompt')}
      </button>

      {isOpen && (
        <div
          id="usage-agreement-content"
          className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-4 text-left text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <h3 className="mb-2 text-sm font-bold">{localize('com_auth_usage_agreement_title')}</h3>
          <ol className="list-inside list-decimal space-y-2">
            <li>
              <strong>{localize('com_auth_usage_purpose_title')}</strong>
              <p className="pl-2">{localize('com_auth_usage_purpose_body')}</p>
            </li>
            <li>
              <strong>{localize('com_auth_usage_acceptable_title')}</strong>
              <p className="pl-2">{localize('com_auth_usage_acceptable_body')}</p>
            </li>
            <li>
              <strong>{localize('com_auth_usage_prohibited_title')}</strong>
              <p className="pl-2">{localize('com_auth_usage_prohibited_body')}</p>
            </li>
            <li>
              <strong>{localize('com_auth_usage_security_title')}</strong>
              <p className="pl-2">{localize('com_auth_usage_security_body')}</p>
            </li>
            <li>
              <strong>{localize('com_auth_usage_monitoring_title')}</strong>
              <p className="pl-2">{localize('com_auth_usage_monitoring_body')}</p>
            </li>
            <li>
              <strong>{localize('com_auth_usage_training_title')}</strong>
              <p className="pl-2">{localize('com_auth_usage_training_body')}</p>
            </li>
            <li>
              <strong>{localize('com_auth_usage_questions_title')}</strong>
              <p className="pl-2">{localize('com_auth_usage_questions_body')}</p>
            </li>
          </ol>
          <p className="mt-3 font-semibold">{localize('com_auth_usage_acknowledgement')}</p>
        </div>
      )}
    </div>
  );
};

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const DisplayError = () => {
    if (hasStartupConfigError) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize('com_auth_error_login_server')}</ErrorMessage>
        </div>
      );
    }

    if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>
            {localize('com_auth_error_invalid_reset_token')}{' '}
            <a className="font-semibold text-green-600 hover:underline" href="/forgot-password">
              {localize('com_auth_click_here')}
            </a>{' '}
            {localize('com_auth_to_try_again')}
          </ErrorMessage>
        </div>
      );
    }

    if (error != null && error) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize(error)}</ErrorMessage>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-white dark:bg-gray-900">
      <Banner />
      <div className="absolute bottom-0 left-0 z-10 md:m-4">
        <ThemeSelector />
      </div>
      <div className="flex flex-grow items-start justify-center px-4 pb-10 pt-8 sm:px-6 sm:pt-10 lg:items-center lg:pt-0">
        <div className="w-full max-w-md">
          <BlinkAnimation active={isFetching}>
            <div className="mb-8 flex justify-center text-center">
              <img
                src="/assets/ethos-enterprise-logo-light.png"
                className="h-20 w-auto max-w-[200px] object-contain dark:hidden sm:h-24"
                alt={localize('com_ui_logo', { 0: 'Ethos Enterprise' })}
              />
              <img
                src="/assets/ethos-enterprise-logo.png"
                className="hidden h-20 w-auto max-w-[200px] object-contain dark:block sm:h-24"
                alt={localize('com_ui_logo', { 0: 'Ethos Enterprise' })}
              />
            </div>
          </BlinkAnimation>
          <DisplayError />
          <div className="overflow-hidden border border-border-light bg-surface-primary px-5 py-6 shadow-sm dark:shadow-none sm:rounded-xl sm:px-8 sm:py-8">
            {!hasStartupConfigError && !isFetching && (
              <h1
                className="mb-3 text-center text-3xl font-semibold tracking-[-0.03em] text-black dark:text-white"
                style={{ userSelect: 'none' }}
              >
                {header}
              </h1>
            )}
            {children}
            {!pathname.includes('2fa') &&
              (pathname.includes('login') || pathname.includes('register')) && (
                <SocialLoginRender startupConfig={startupConfig} />
              )}
            <UsageAgreementDropdown />
          </div>
          <p className="mt-4 text-center text-sm leading-6 text-gray-700 dark:text-gray-300">
            {localize('com_auth_security_note')}
          </p>
          <Footer startupConfig={startupConfig} />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;

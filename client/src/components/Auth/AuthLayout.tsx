import { ThemeSelector } from '@librechat/client';
import { TStartupConfig } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';
import { useState } from 'react';

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
        {localize('By using enterprise chat you agree to the terms and conditions set forth by CSUSA')}
      </button>

      {isOpen && (
        <div
          id="usage-agreement-content"
          className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-4 text-left text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <h3 className="mb-2 text-sm font-bold">CSUSA Enterprise Chat Usage Agreement</h3>
          <ol className="list-inside list-decimal space-y-2">
            <li>
              <strong>Purpose & Scope</strong>
              <p className="pl-2">
                This Usage Agreement applies to all CSUSA staff, contractors, and authorized users of
                the CSUSA Enterprise Chat platform. By using Enterprise Chat, you agree to follow
                these guidelines.
              </p>
            </li>
            <li>
              <strong>Acceptable Use</strong>
              <p className="pl-2">
                Use Enterprise Chat only for your official work activities, such as generating work
                content, research, improving workflows, and supporting CSUSA’s educational goals. Use
                the platform responsibly, ethically, and in compliance with company policies.
              </p>
            </li>
            <li>
              <strong>Prohibited Use</strong>
              <p className="pl-2">
                Do not use Enterprise Chat for personal, non-work-related, or unauthorized
                purposes. Do not use it for excessive socializing or sharing unprofessional,
                offensive, or disruptive content. Never enter or discuss student names, educational
                records, or personally identifiable student information to comply with FERPA and
                protect privacy. Do not share confidential or regulated data unless specifically
                allowed by company policy.
              </p>
            </li>
            <li>
              <strong>Data Security</strong>
              <p className="pl-2">
                Always follow CSUSA’s data privacy and cybersecurity policies when using Enterprise
                Chat. Report any security risks or incidents immediately as required by company
                procedures.
              </p>
            </li>
            <li>
              <strong>Monitoring</strong>
              <p className="pl-2">
                Your use of Enterprise Chat may be monitored for compliance. Violations may result in
                disciplinary action, loss of access, termination, and/or legal action.
              </p>
            </li>
            <li>
              <strong>Training</strong>
              <p className="pl-2">
                You must complete required AI and data privacy training before using Enterprise Chat.
                Additional training will be provided as needed.
              </p>
            </li>
            <li>
              <strong>Questions & Exceptions</strong>
              <p className="pl-2">
                If you need an exception or have questions, contact your supervisor or the AI
                administration team for guidance or approval.
              </p>
            </li>
          </ol>
          <p className="mt-3 font-semibold">
            By using CSUSA Enterprise Chat, you agree to use it in a safe, ethical, and responsible
            manner that supports CSUSA’s mission.
          </p>
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
    } else if (error === 'com_auth_error_invalid_reset_token') {
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
    } else if (error != null && error) {
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
      <BlinkAnimation active={isFetching}>
        <div className="mt-6 h-10 w-full bg-cover">
          <img
            src="/assets/logo.svg"
            className="h-full w-full object-contain"
            alt={localize('com_ui_logo', { 0: startupConfig?.appTitle ?? 'Enterprise Chat' })}
          />
          <p className='text-center mt-5 text-xl font-bold text-black dark:text-white'>CSUSA</p>
        </div>
      </BlinkAnimation>
      <DisplayError />
      <div className="absolute bottom-0 left-0 md:m-4">
        <ThemeSelector />
      </div>

      <div className="flex flex-grow items-center justify-center">
        <div className="w-authPageWidth overflow-hidden bg-white px-6 py-4 dark:bg-gray-900 sm:max-w-md sm:rounded-lg">
          {!hasStartupConfigError && !isFetching && (
            <h1
              className="mb-4 text-center text-3xl font-semibold text-black dark:text-white"
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
      </div>
      <p className='text-center max-w-[250px] mx-auto md:max-w-none text-black dark:text-white'>
        All conversations are encrypted and secure
      </p>
      <Footer startupConfig={startupConfig} />
    </div>
  );
}

export default AuthLayout;
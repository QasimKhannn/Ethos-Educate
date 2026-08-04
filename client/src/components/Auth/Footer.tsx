import { useLocalize } from '~/hooks';
import { getBrandedLegalUrl } from '~/utils';
import { TStartupConfig } from 'librechat-data-provider';

function Footer({ startupConfig }: { startupConfig: TStartupConfig | null | undefined }) {
  const localize = useLocalize();
  if (!startupConfig) {
    return null;
  }
  const privacyPolicy = startupConfig.interface?.privacyPolicy;
  const termsOfService = startupConfig.interface?.termsOfService;
  const privacyPolicyUrl = getBrandedLegalUrl(privacyPolicy?.externalUrl, 'privacy');
  const termsOfServiceUrl = getBrandedLegalUrl(termsOfService?.externalUrl, 'terms');

  const privacyPolicyRender = privacyPolicyUrl && (
    <a
      className="text-sm text-[#9A671E] underline decoration-transparent transition-all duration-200 hover:text-[#7D5116] hover:decoration-[#7D5116] focus:text-[#7D5116] focus:decoration-[#7D5116] dark:text-[#DAAC60] dark:hover:text-[#E8C37F] dark:hover:decoration-[#E8C37F] dark:focus:text-[#E8C37F] dark:focus:decoration-[#E8C37F]"
      href={privacyPolicyUrl}
      // Removed for WCAG compliance
      // target={privacyPolicy.openNewTab ? '_blank' : undefined}
      rel="noreferrer"
    >
      {localize('com_ui_privacy_policy')}
    </a>
  );

  const termsOfServiceRender = termsOfServiceUrl && (
    <a
      className="text-sm text-[#9A671E] underline decoration-transparent transition-all duration-200 hover:text-[#7D5116] hover:decoration-[#7D5116] focus:text-[#7D5116] focus:decoration-[#7D5116] dark:text-[#DAAC60] dark:hover:text-[#E8C37F] dark:hover:decoration-[#E8C37F] dark:focus:text-[#E8C37F] dark:focus:decoration-[#E8C37F]"
      href={termsOfServiceUrl}
      // Removed for WCAG compliance
      // target={termsOfService.openNewTab ? '_blank' : undefined}
      rel="noreferrer"
    >
      {localize('com_ui_terms_of_service')}
    </a>
  );

  return (
    <div className="align-end m-4 flex justify-center gap-2" role="contentinfo">
      {privacyPolicyRender}
      {privacyPolicyRender && termsOfServiceRender && (
        <div className="border-r-[1px] border-gray-300 dark:border-gray-600" />
      )}
      {termsOfServiceRender}
    </div>
  );
}

export default Footer;

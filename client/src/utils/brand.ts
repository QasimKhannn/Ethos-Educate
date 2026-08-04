export const AJAIA_PRIVACY_POLICY_URL = 'https://ajaia.ai/privacy-policy';
export const AJAIA_TERMS_URL = 'https://ajaia.ai/terms';

type LegalPolicy = 'privacy' | 'terms';

export const getBrandedLegalUrl = (
  externalUrl: string | null | undefined,
  policy: LegalPolicy,
): string | null | undefined => {
  if (!externalUrl) {
    return externalUrl;
  }

  try {
    const hostname = new URL(externalUrl).hostname.toLowerCase();
    const isLegacyLibreChatUrl = hostname === 'librechat.ai' || hostname.endsWith('.librechat.ai');

    if (!isLegacyLibreChatUrl) {
      return externalUrl;
    }
  } catch {
    return externalUrl;
  }

  return policy === 'privacy' ? AJAIA_PRIVACY_POLICY_URL : AJAIA_TERMS_URL;
};

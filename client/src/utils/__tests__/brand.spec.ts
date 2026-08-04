import { AJAIA_PRIVACY_POLICY_URL, AJAIA_TERMS_URL, getBrandedLegalUrl } from '../brand';

describe('brand utilities', () => {
  describe('getBrandedLegalUrl', () => {
    it('replaces legacy LibreChat legal URLs with official AJAIA destinations', () => {
      expect(getBrandedLegalUrl('https://librechat.ai/privacy-policy', 'privacy')).toBe(
        AJAIA_PRIVACY_POLICY_URL,
      );
      expect(getBrandedLegalUrl('https://www.librechat.ai/tos', 'terms')).toBe(AJAIA_TERMS_URL);
    });

    it('preserves non-LibreChat and invalid custom URLs', () => {
      expect(getBrandedLegalUrl('https://example.com/privacy', 'privacy')).toBe(
        'https://example.com/privacy',
      );
      expect(getBrandedLegalUrl('/custom-terms', 'terms')).toBe('/custom-terms');
    });
  });
});

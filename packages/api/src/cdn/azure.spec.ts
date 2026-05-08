import { getAzureBlobName, isAzureBlobUrlExpired } from './azure';

describe('Azure Blob CDN helpers', () => {
  describe('getAzureBlobName', () => {
    it('extracts blob names from Azure Blob URLs', () => {
      const blobName = getAzureBlobName(
        'https://storageaccount.blob.core.windows.net/files/images/user-1/avatar.png?sig=test',
        'files',
      );

      expect(blobName).toBe('images/user-1/avatar.png');
    });

    it('extracts blob names from stored paths', () => {
      expect(getAzureBlobName('files/uploads/user-1/document.pdf', 'files')).toBe(
        'uploads/user-1/document.pdf',
      );
      expect(getAzureBlobName('/uploads/user-1/document.pdf', 'files')).toBe(
        'uploads/user-1/document.pdf',
      );
    });

    it('rejects empty paths', () => {
      expect(() => getAzureBlobName('', 'files')).toThrow('Invalid Azure Blob path');
    });
  });

  describe('isAzureBlobUrlExpired', () => {
    it('returns false for public URLs without a signature', () => {
      expect(
        isAzureBlobUrlExpired('https://storageaccount.blob.core.windows.net/files/image.png'),
      ).toBe(false);
    });

    it('detects signed URLs inside the refresh buffer', () => {
      const expiresOn = new Date(Date.now() + 30 * 1000).toISOString();
      const url = `https://storageaccount.blob.core.windows.net/files/image.png?sig=test&se=${encodeURIComponent(
        expiresOn,
      )}`;

      expect(isAzureBlobUrlExpired(url, 60)).toBe(true);
    });

    it('keeps signed URLs outside the refresh buffer', () => {
      const expiresOn = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const url = `https://storageaccount.blob.core.windows.net/files/image.png?sig=test&se=${encodeURIComponent(
        expiresOn,
      )}`;

      expect(isAzureBlobUrlExpired(url, 60)).toBe(false);
    });

    it('refreshes signed URLs with invalid expiry values', () => {
      expect(
        isAzureBlobUrlExpired(
          'https://storageaccount.blob.core.windows.net/files/image.png?sig=test&se=invalid',
        ),
      ).toBe(true);
    });
  });
});

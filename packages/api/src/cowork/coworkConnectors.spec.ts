// cowork — unit tests for the connector catalog.
import {
  COWORK_CONNECTORS,
  listCoworkConnectors,
  getCoworkConnector,
  isValidConnectorId,
  sanitizeConnectorIds,
} from './coworkConnectors';

describe('coworkConnectors catalog', () => {
  it('includes the expected connectors', () => {
    const ids = COWORK_CONNECTORS.map((c) => c.id).sort();
    expect(ids).toEqual(
      [
        'airtable',
        'canva',
        'github',
        // 'google_workspace', // hidden — commented out in the catalog for now
        'mailchimp',
        'monday',
        'onedrive',
        'outlook',
        'sharepoint',
        'teams',
        'wordpress',
        'youtube',
      ].sort(),
    );
  });

  it('every connector has the required, well-formed fields', () => {
    for (const c of listCoworkConnectors()) {
      expect(c.id).toMatch(/^[a-z0-9_]+$/);
      expect(c.label).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(['oauth', 'apikey', 'platform']).toContain(c.auth);
      expect(['available', 'planned']).toContain(c.status);
      expect(typeof c.hasWriteActions).toBe('boolean');
      // api-key connectors must declare at least one credential field.
      if (c.auth === 'apikey') {
        expect(Array.isArray(c.credentialFields) && c.credentialFields.length > 0).toBe(true);
      }
    }
  });

  it('looks up connectors by id', () => {
    expect(getCoworkConnector('wordpress')?.auth).toBe('apikey');
    expect(getCoworkConnector('youtube')?.hasWriteActions).toBe(false);
    expect(getCoworkConnector('nope')).toBeUndefined();
  });

  it('validates connector ids', () => {
    expect(isValidConnectorId('canva')).toBe(true);
    expect(isValidConnectorId('myspace')).toBe(false);
  });

  it('sanitizes connector id lists (dedupes, drops unknown/non-strings)', () => {
    expect(sanitizeConnectorIds(['wordpress', 'wordpress', 'bogus', 42, 'canva'])).toEqual([
      'wordpress',
      'canva',
    ]);
    expect(sanitizeConnectorIds('not-an-array')).toEqual([]);
    expect(sanitizeConnectorIds(undefined)).toEqual([]);
  });
});

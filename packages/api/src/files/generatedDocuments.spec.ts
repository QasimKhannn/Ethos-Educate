import {
  buildManagedDocumentText,
  extractGeneratedDocumentArtifacts,
  getGeneratedDocumentRetentionExpiry,
} from './generatedDocuments';

const originalRetentionMinutes = process.env.GENERATED_FILE_RETENTION_MINUTES;

afterEach(() => {
  if (originalRetentionMinutes === undefined) {
    delete process.env.GENERATED_FILE_RETENTION_MINUTES;
    return;
  }

  process.env.GENERATED_FILE_RETENTION_MINUTES = originalRetentionMinutes;
});

describe('generated document artifacts', () => {
  const sourceUrl =
    'https://documents.example.com/files/worksheet.docx?expires=123&token=signed-token';

  test('extracts the MCP document artifact and removes its temporary link', () => {
    const content = [
      'Teacher-ready worksheet files created:',
      `- Document created: [Worksheet.docx](${sourceUrl})`,
      'This document expires after 24 hours and will be deleted.',
      '<!-- ethos-generated-document {"filename":"Worksheet.docx","mimeType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","url":"https://documents.example.com/files/worksheet.docx?expires=123&token=signed-token"} -->',
    ].join('\n');

    expect(extractGeneratedDocumentArtifacts(content)).toEqual({
      documents: [
        {
          filename: 'Worksheet.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sourceUrl,
        },
      ],
      text: 'Teacher-ready worksheet files created:',
    });
  });

  test('removes the standard document source link before a managed link is rendered', () => {
    const content = [
      `Document created: [Worksheet.docx](${sourceUrl})`,
      '<!-- ethos-generated-document {"filename":"Worksheet.docx","mimeType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","url":"https://documents.example.com/files/worksheet.docx?expires=123&token=signed-token"} -->',
    ].join('\n');

    const extracted = extractGeneratedDocumentArtifacts(content);
    const expiresAt = getGeneratedDocumentRetentionExpiry(Date.UTC(2026, 7, 28, 12, 0, 0));
    const managed = buildManagedDocumentText({
      sourceText: extracted.text,
      documents: [
        {
          filename: 'Worksheet.docx',
          downloadPath: '/api/files/download/user-123/file-123',
          fileId: 'file-123',
        },
      ],
      expiresAt,
    });

    expect(managed).toBe(
      '[Worksheet.docx](/api/files/download/user-123/file-123)\n<!-- ethos-generated-document-expiry {"expiresAt":"2026-08-29T12:00:00.000Z","fileId":"file-123"} -->\n\nAvailable until 2026-08-29 12:00:00 UTC. This document expires after 24 hours and will be deleted. After expiry, generate a new copy.',
    );
    expect(managed).not.toContain(sourceUrl);
  });

  test('rejects document artifacts with non-http source URLs', () => {
    const content =
      '<!-- ethos-generated-document {"filename":"Worksheet.docx","mimeType":"application/octet-stream","url":"file:///private/worksheet.docx"} -->';

    expect(extractGeneratedDocumentArtifacts(content)).toEqual({ documents: [], text: '' });
  });

  test('uses the configured minute retention in managed document output', () => {
    process.env.GENERATED_FILE_RETENTION_MINUTES = '5';
    const expiresAt = getGeneratedDocumentRetentionExpiry(Date.UTC(2026, 8, 2, 12, 0, 0));
    const managed = buildManagedDocumentText({
      sourceText: '',
      documents: [
        {
          filename: 'Worksheet.docx',
          downloadPath: '/api/files/download/user/file',
          fileId: 'file',
        },
      ],
      expiresAt,
    });

    expect(expiresAt.toISOString()).toBe('2026-09-02T12:05:00.000Z');
    expect(managed).toContain('This document expires after 5 minutes and will be deleted.');
  });
});

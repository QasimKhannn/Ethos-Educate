import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import {
  getGeneratedDocumentExpiries,
  getGeneratedDocumentLinks,
  isGeneratedArtifactExpired,
} from '../generatedArtifacts';

describe('generated artifact retention', () => {
  test('reads an old managed document expiry from persisted tool output', () => {
    const content: TMessageContentParts[] = [
      {
        type: ContentTypes.TOOL_CALL,
        tool_call: {
          type: 'tool_call',
          name: 'downloadable_document_builder',
          output:
            'Available until 2026-09-03 21:54 UTC.\n[School_Closure.docx](/api/files/download/user-123/file-456)',
        },
      },
    ];

    const expiresAt = getGeneratedDocumentExpiries(content).get('file-456');

    expect(expiresAt?.toISOString()).toBe('2026-09-03T21:54:00.000Z');
    expect(isGeneratedArtifactExpired(expiresAt, Date.UTC(2026, 8, 3, 21, 55))).toBe(true);
  });

  test('reads the durable expiry marker on newly generated documents', () => {
    const content: TMessageContentParts[] = [
      {
        type: ContentTypes.TEXT,
        text: [
          '[Worksheet.docx](/api/files/download/user-123/file-456)',
          '<!-- ethos-generated-document-expiry {"expiresAt":"2026-09-03T21:54:00.000Z","fileId":"file-456"} -->',
        ].join('\n'),
      },
    ];

    expect(getGeneratedDocumentExpiries(content).get('file-456')?.toISOString()).toBe(
      '2026-09-03T21:54:00.000Z',
    );
  });

  test('extracts only managed document links for tool-result downloads', () => {
    const output = [
      '[Student Worksheet.docx](/api/files/download/user-123/file-456)',
      '[Answer Key.docx](/api/files/download/user-123/file-789)',
      '[Untrusted file](https://example.com/file.docx)',
    ].join('\n');

    expect(getGeneratedDocumentLinks(output)).toEqual([
      {
        filename: 'Student Worksheet.docx',
        href: '/api/files/download/user-123/file-456',
        fileId: 'file-456',
      },
      {
        filename: 'Answer Key.docx',
        href: '/api/files/download/user-123/file-789',
        fileId: 'file-789',
      },
    ]);
  });
});

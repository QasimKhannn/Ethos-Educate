import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import {
  getGeneratedDocumentExpiries,
  getGeneratedArtifactDisplayText,
  getGeneratedDocumentLinks,
  getGeneratedDocumentState,
  isGeneratedArtifactExpired,
  splitGeneratedDocumentLinksByExpiry,
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

  test('normalizes a persisted Azure MCP content array for legacy tool details', () => {
    const managedLink = '[Worksheet.docx](/api/files/download/user-123/file-456)';
    const output = JSON.stringify([{ type: 'text', text: `Ready.\n\n${managedLink}` }]);

    expect(getGeneratedArtifactDisplayText(output)).toBe(`Ready.\n\n${managedLink}`);
    expect(getGeneratedDocumentLinks(output)).toHaveLength(1);
  });

  test('identifies tool-owned documents without requiring an expiry timestamp', () => {
    const content: TMessageContentParts[] = [
      {
        type: ContentTypes.TOOL_CALL,
        tool_call: {
          type: 'tool_call',
          name: 'downloadable_document_builder',
          output: '[Worksheet.docx](/api/files/download/user-123/file-456)',
        },
      },
    ];

    expect(getGeneratedDocumentState(content).toolCallFileIds.has('file-456')).toBe(true);
  });

  test('groups expired files from one tool result into one expiry state', () => {
    const documents = getGeneratedDocumentLinks(
      [
        '[Student Worksheet.docx](/api/files/download/user-123/file-456)',
        '[Teacher Answer Key.docx](/api/files/download/user-123/file-789)',
      ].join('\n'),
    );
    const groups = splitGeneratedDocumentLinksByExpiry(
      documents,
      new Map([
        ['file-456', new Date('2026-09-03T21:54:00.000Z')],
        ['file-789', new Date('2026-09-03T21:54:00.000Z')],
      ]),
      Date.UTC(2026, 8, 3, 21, 55),
    );

    expect(groups.available).toEqual([]);
    expect(groups.expired).toHaveLength(2);
  });
});

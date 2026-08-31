jest.mock('@librechat/api', () => ({
  buildManagedDocumentText: jest.fn(({ sourceText, documents, expiresAt }) => {
    const links = documents.map(({ filename, downloadPath }) => `[${filename}](${downloadPath})`);
    return [sourceText, ...links, `Available until ${expiresAt.toISOString()}`]
      .filter(Boolean)
      .join('\n');
  }),
  extractGeneratedDocumentArtifacts: jest.fn(),
  getGeneratedDocumentRetentionExpiry: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'storage-file-789'),
}));

jest.mock('librechat-data-provider', () => ({
  FileContext: {
    generated_document: 'generated_document',
  },
}));

jest.mock('~/server/services/Files/process', () => ({
  processFileURL: jest.fn(),
}));

jest.mock('~/server/utils/getFileStrategy', () => ({
  getFileStrategy: jest.fn(),
}));

const {
  extractGeneratedDocumentArtifacts,
  getGeneratedDocumentRetentionExpiry,
} = require('@librechat/api');
const { processFileURL } = require('~/server/services/Files/process');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');
const { persistGeneratedDocuments } = require('./MCPGeneratedDocuments');

describe('persistGeneratedDocuments', () => {
  const expiresAt = new Date('2026-09-04T12:00:00.000Z');
  const request = {
    config: { fileStrategies: { document: 'azure' } },
    user: { id: 'user-123' },
  };
  const sourceUrl = 'https://documents.example.com/files/worksheet.docx?token=temporary';

  beforeEach(() => {
    jest.clearAllMocks();
    getGeneratedDocumentRetentionExpiry.mockReturnValue(expiresAt);
    getFileStrategy.mockReturnValue('azure');
    extractGeneratedDocumentArtifacts.mockReturnValue({
      text: 'Teacher-ready worksheet files created:',
      documents: [
        {
          filename: 'Worksheet.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sourceUrl,
        },
      ],
    });
    processFileURL.mockResolvedValue({ file_id: 'file-456', filename: 'Worksheet.docx' });
  });

  test('stores marked document output in Ethos and replaces the temporary link', async () => {
    const response = [[{ type: 'text', text: 'raw MCP response' }], ['artifact']];

    await expect(
      persistGeneratedDocuments({
        req: request,
        requestBody: { conversationId: 'conversation-123', messageId: 'message-123' },
        response,
        serverName: 'Downloadable-Files-Creation',
      }),
    ).resolves.toEqual([
      [
        {
          type: 'text',
          text: 'Teacher-ready worksheet files created:\n[Worksheet.docx](/api/files/download/user-123/file-456)\nAvailable until 2026-09-04T12:00:00.000Z',
        },
      ],
      ['artifact'],
    ]);

    expect(processFileURL).toHaveBeenCalledWith({
      fileStrategy: 'azure',
      userId: 'user-123',
      URL: sourceUrl,
      fileName: 'Worksheet.docx',
      storageFileName: 'storage-file-789',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      basePath: 'generated-documents',
      context: 'generated_document',
      conversationId: 'conversation-123',
      messageId: 'message-123',
      retentionExpiresAt: expiresAt,
    });
  });

  test('does not change output from another MCP server', async () => {
    const response = ['unchanged', []];

    await expect(
      persistGeneratedDocuments({
        req: request,
        response,
        serverName: 'Image_Generation',
      }),
    ).resolves.toBe(response);

    expect(processFileURL).not.toHaveBeenCalled();
    expect(extractGeneratedDocumentArtifacts).not.toHaveBeenCalled();
  });
});

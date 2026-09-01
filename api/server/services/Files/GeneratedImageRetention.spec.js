const { FileContext } = require('librechat-data-provider');

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('~/models', () => ({
  getFiles: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('./strategies', () => ({
  getStrategyFunctions: jest.fn(),
}));

const { getFiles, deleteFile } = require('~/models');
const { getStrategyFunctions } = require('./strategies');
const {
  GENERATED_FILE_RETENTION_DAYS,
  GENERATED_FILE_RETENTION_HOURS,
  GENERATED_IMAGE_RETENTION_DAYS,
  isImageGenerationMcpTool,
  getGeneratedFileRetentionExpiry,
  isExpiredGeneratedFile,
  getGeneratedImageRetentionExpiry,
  isExpiredGeneratedImage,
  cleanupExpiredGeneratedFiles,
} = require('./GeneratedImageRetention');

describe('GeneratedImageRetention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('recognizes only images produced by the configured image MCP', () => {
    expect(isImageGenerationMcpTool('generate_images_mcp_Image_Generation')).toBe(true);
    expect(
      isImageGenerationMcpTool('create_teacher_worksheet_mcp_Downloadable-Files-Creation'),
    ).toBe(false);
  });

  test('sets generated image retention to 24 hours', () => {
    const now = Date.UTC(2026, 7, 28, 12, 0, 0);
    const expiry = getGeneratedImageRetentionExpiry(now);

    expect(GENERATED_FILE_RETENTION_DAYS).toBe(1);
    expect(GENERATED_FILE_RETENTION_HOURS).toBe(24);
    expect(GENERATED_IMAGE_RETENTION_DAYS).toBe(1);
    expect(expiry.getTime()).toBe(now + 24 * 60 * 60 * 1000);
    expect(getGeneratedFileRetentionExpiry(now)).toEqual(expiry);
  });

  test('recognizes an expired retained generated image', () => {
    expect(
      isExpiredGeneratedImage({
        context: FileContext.image_generation,
        retentionExpiresAt: new Date(Date.now() - 1),
      }),
    ).toBe(true);
    expect(
      isExpiredGeneratedImage({
        context: FileContext.image_generation,
        retentionExpiresAt: new Date(Date.now() + 1),
      }),
    ).toBe(false);
  });

  test('recognizes an expired retained generated document', () => {
    expect(
      isExpiredGeneratedFile({
        context: FileContext.generated_document,
        retentionExpiresAt: new Date(Date.now() - 1),
      }),
    ).toBe(true);
  });

  test('removes the stored generated file and its file record during cleanup', async () => {
    const file = {
      file_id: 'generated-image-file',
      user: { toString: () => 'user-123' },
      source: 'local',
      filepath: '/uploads/user-123/generated.png',
      context: FileContext.image_generation,
      retentionExpiresAt: new Date(Date.now() - 1),
    };
    const deleteStoredFile = jest.fn().mockResolvedValue(undefined);
    getFiles.mockResolvedValue([file]);
    getStrategyFunctions.mockReturnValue({ deleteFile: deleteStoredFile });
    deleteFile.mockResolvedValue(file);

    await expect(cleanupExpiredGeneratedFiles({ paths: {} })).resolves.toEqual({
      deleted: 1,
      failed: 0,
    });

    expect(deleteStoredFile).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: 'user-123' } }),
      file,
    );
    expect(deleteFile).toHaveBeenCalledWith('generated-image-file');
  });
});

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('~/server/services/PermissionService', () => ({
  getEffectivePermissions: jest.fn(),
}));

jest.mock('~/models/Agent', () => ({
  getAgents: jest.fn(),
}));

jest.mock('~/models', () => ({
  getFiles: jest.fn(),
}));

jest.mock('~/server/services/Files/GeneratedImageRetention', () => ({
  getExpiredGeneratedFileMessage: jest.fn((file) =>
    file?.context === 'generated_document'
      ? 'Document expired after 24 hours - generate a new copy.'
      : 'This generated image expired after 24 hours and is no longer available.',
  ),
  isExpiredGeneratedFile: jest.fn(),
  removeExpiredGeneratedFile: jest.fn(),
}));

const { getFiles } = require('~/models');
const { getAgents } = require('~/models/Agent');
const {
  getExpiredGeneratedFileMessage,
  isExpiredGeneratedFile,
  removeExpiredGeneratedFile,
} = require('~/server/services/Files/GeneratedImageRetention');
const { fileAccess } = require('./fileAccess');

describe('fileAccess generated image retention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks expired generated images and requests storage cleanup', async () => {
    const file = {
      file_id: 'expired-image',
      user: { toString: () => 'owner-123' },
      retentionExpiresAt: new Date(Date.now() - 1),
    };
    const req = {
      user: { id: 'owner-123', role: 'USER' },
      params: { file_id: 'expired-image' },
      config: { paths: {} },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    getFiles.mockResolvedValue([file]);
    isExpiredGeneratedFile.mockReturnValue(true);
    removeExpiredGeneratedFile.mockResolvedValue(undefined);

    await fileAccess(req, res, next);

    expect(removeExpiredGeneratedFile).toHaveBeenCalledWith(file, req.config);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(410);
    expect(getExpiredGeneratedFileMessage).toHaveBeenCalledWith(file);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Gone',
      message: 'This generated image expired after 24 hours and is no longer available.',
    });
  });

  test('does not disclose an expired image to an unauthorized user', async () => {
    const file = {
      file_id: 'expired-image',
      user: { toString: () => 'owner-123' },
      retentionExpiresAt: new Date(Date.now() - 1),
    };
    const req = {
      user: { id: 'other-user', role: 'USER' },
      params: { file_id: 'expired-image' },
      config: { paths: {} },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    getFiles.mockResolvedValue([file]);
    getAgents.mockResolvedValue([]);
    isExpiredGeneratedFile.mockReturnValue(true);

    await fileAccess(req, res, jest.fn());

    expect(removeExpiredGeneratedFile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns the document-specific expiry message', async () => {
    const file = {
      file_id: 'expired-document',
      user: { toString: () => 'owner-123' },
      context: 'generated_document',
      retentionExpiresAt: new Date(Date.now() - 1),
    };
    const req = {
      user: { id: 'owner-123', role: 'USER' },
      params: { file_id: 'expired-document' },
      config: { paths: {} },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    getFiles.mockResolvedValue([file]);
    isExpiredGeneratedFile.mockReturnValue(true);
    removeExpiredGeneratedFile.mockResolvedValue(undefined);

    await fileAccess(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Gone',
      message: 'Document expired after 24 hours - generate a new copy.',
    });
  });
});

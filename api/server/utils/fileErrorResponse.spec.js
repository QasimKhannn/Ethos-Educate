const { ERROR_CODES } = require('~/server/utils/errorResponse');
const {
  createFileProcessingErrorResponse,
  createUploadErrorResponse,
} = require('./fileErrorResponse');

describe('file upload error responses', () => {
  test('explains supported and unsupported file formats before an upload starts', () => {
    const response = createUploadErrorResponse(
      {},
      {
        message: 'Unsupported file type: image/bmp',
      },
    );

    expect(response.code).toBe(ERROR_CODES.INVALID_INPUT);
    expect(response.message).toBe("This file can't be uploaded here.");
    expect(response.action).toContain('You can upload:\nDocuments: PDF, Word (DOC/DOCX)');
    expect(response.action).toContain('Not supported:\nApps or installers');
    expect(response.action).toContain('BMP, TIFF, AVIF, RTF, MSG, and EML');
  });

  test('explains that File Search cannot read image uploads', () => {
    const response = createFileProcessingErrorResponse(
      new Error('Image uploads are not supported for file search'),
    );

    expect(response).toEqual({
      code: ERROR_CODES.INVALID_INPUT,
      message: "Images can't be used with File Search.",
      action:
        'Use a PDF, Word document, PowerPoint, spreadsheet, CSV, or text file instead. You can attach an image directly in chat when image input is available.',
    });
  });

  test('provides the configured maximum size when a file exceeds it during processing', () => {
    const response = createFileProcessingErrorResponse(
      new Error('File size limit of 100 MB exceeded'),
    );

    expect(response).toEqual({
      code: ERROR_CODES.INVALID_INPUT,
      message: 'This file is too large to upload.',
      action:
        'Files can be up to 100 MB. Choose a smaller file or compress/export it, then try again.',
    });
  });
});

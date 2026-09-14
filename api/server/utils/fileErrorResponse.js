const multer = require('multer');
const { megabyte, mergeFileConfig, getEndpointFileConfig } = require('librechat-data-provider');
const { ERROR_CODES } = require('~/server/utils/errorResponse');

const supportedFileTypes =
  'Documents: PDF, Word (DOC/DOCX), PowerPoint (PPTX), Excel (XLS/XLSX), OpenDocument, CSV/TSV, TXT, Markdown, and JSON.\nImages: JPG/JPEG, PNG, GIF, WEBP, HEIC/HEIF, and SVG.\nOther: ZIP/TAR archives and standard audio/video files.';

const unsupportedFileTypes =
  'Apps or installers, design-source files, macro-enabled Office files, email files, RAR/7z archives, and formats such as BMP, TIFF, AVIF, RTF, MSG, and EML.';

const createUnsupportedFileTypeAction = () =>
  `Choose a file in a supported format instead.\n\nYou can upload:\n${supportedFileTypes}\n\nNot supported:\n${unsupportedFileTypes}`;

const formatMegabytes = (bytes) => {
  const megabytes = bytes / megabyte;
  return Number.isInteger(megabytes) ? `${megabytes}` : megabytes.toFixed(1);
};

const createSizeLimitAction = (limitInMegabytes) => {
  if (!limitInMegabytes) {
    return 'Choose a smaller file or compress/export it, then try again.';
  }

  return `Files can be up to ${limitInMegabytes} MB. Choose a smaller file or compress/export it, then try again.`;
};

const getLimitFromMessage = (message) => {
  const match = message.match(/File size limit of (\d+(?:\.\d+)?) MB exceeded/i);
  return match?.[1];
};

const createUploadErrorResponse = (req, error) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    const fileConfig = mergeFileConfig(req.config?.fileConfig);
    const endpointFileConfig = getEndpointFileConfig({
      fileConfig,
      endpoint: req.body?.endpoint,
      endpointType: req.body?.endpointType,
    });
    const fileSizeLimit = endpointFileConfig.fileSizeLimit ?? fileConfig.serverFileSizeLimit ?? 0;

    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'This file is too large to upload.',
      action: createSizeLimitAction(formatMegabytes(fileSizeLimit)),
    };
  }

  if (typeof error?.message === 'string' && error.message.startsWith('Unsupported file type:')) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: "This file can't be uploaded here.",
      action: createUnsupportedFileTypeAction(),
    };
  }

  if (typeof error?.message === 'string' && error.message === 'No file provided') {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'No file was received.',
      action: 'Choose a file and try uploading again.',
    };
  }

  return {
    fallbackCode: ERROR_CODES.REQUEST_FAILED,
    message: "We couldn't upload that file.",
    action: 'Try again. If it keeps failing, use a smaller or different file format.',
  };
};

const createFileProcessingErrorResponse = (error) => {
  const message = typeof error?.message === 'string' ? error.message : '';

  if (
    message.includes('No file_id provided') ||
    message.includes('No endpoint provided') ||
    message.includes('No tool resource provided') ||
    message.includes('No agent ID provided') ||
    message.includes('Empty file uploaded')
  ) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'Some file details are missing or invalid.',
      action: 'Check the file and try uploading it again.',
    };
  }

  if (message.includes('File size limit of')) {
    const fileSizeLimit = getLimitFromMessage(message);

    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'This file is too large to upload.',
      action: createSizeLimitAction(fileSizeLimit),
    };
  }

  if (message.includes('Image uploads are not supported for file search')) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: "Images can't be used with File Search.",
      action:
        'Use a PDF, Word document, PowerPoint, spreadsheet, CSV, or text file instead. You can attach an image directly in chat when image input is available.',
    };
  }

  if (
    message.includes('Unsupported file type') ||
    message.includes('not supported for text parsing')
  ) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: "This file can't be used with the selected feature.",
      action: createUnsupportedFileTypeAction(),
    };
  }

  if (message.includes('OCR capability is not enabled for Agents')) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'This file needs document reading support before it can be used here.',
      action: 'Enable the document-reading tool for this agent or use a simpler text file instead.',
    };
  }

  if (
    message.includes('Unable to extract text from') ||
    message.includes('Invalid file format') ||
    message.includes('No OCR result') ||
    message.includes('exceeds token limit') ||
    message.includes('exceeds the 15MB storage limit')
  ) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: "We couldn't read text from this file.",
      action:
        'Try a different PDF or spreadsheet export, resave the file, or upload a simpler version.',
    };
  }

  return {
    fallbackCode: ERROR_CODES.REQUEST_FAILED,
    message: "We couldn't process that file.",
    action: 'Try again. If it keeps failing, use a smaller or different file format.',
  };
};

module.exports = {
  createFileProcessingErrorResponse,
  createUploadErrorResponse,
};

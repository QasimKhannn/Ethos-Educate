const multer = require('multer');
const { megabyte, mergeFileConfig, getEndpointFileConfig } = require('librechat-data-provider');
const { ERROR_CODES } = require('~/server/utils/errorResponse');

const formatMegabytes = (bytes) => {
  const megabytes = bytes / megabyte;
  return Number.isInteger(megabytes) ? `${megabytes}` : megabytes.toFixed(1);
};

const createSizeLimitAction = (limitInMegabytes) => {
  if (!limitInMegabytes) {
    return 'Please upload a smaller file and try again.';
  }

  return `Please upload a file smaller than ${limitInMegabytes} MB and try again.`;
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
      message: 'This file type is not supported here.',
      action: 'Try a supported file type for this chat or convert the file and upload it again.',
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

  if (
    message.includes('Unsupported file type') ||
    message.includes('not supported for text parsing') ||
    message.includes('Image uploads are not supported for file search')
  ) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: 'This file format is not supported for that upload type.',
      action: 'Try a supported file type or choose a different upload option and try again.',
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

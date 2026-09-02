const { logger } = require('@librechat/data-schemas');
const {
  DEFAULT_GENERATED_FILE_RETENTION_MINUTES,
  formatGeneratedFileRetentionDuration,
  getGeneratedFileCleanupIntervalMinutes,
  getGeneratedFileRetentionMinutes,
  getGeneratedFileRetentionExpiry,
} = require('@librechat/api/files/generatedFileRetention');
const { FileContext } = require('librechat-data-provider');
const { getFiles, deleteFile } = require('~/models');
const { getStrategyFunctions } = require('./strategies');

const GENERATED_FILE_RETENTION_HOURS = DEFAULT_GENERATED_FILE_RETENTION_MINUTES / 60;
const GENERATED_FILE_RETENTION_DAYS = GENERATED_FILE_RETENTION_HOURS / 24;
const GENERATED_IMAGE_RETENTION_DAYS = GENERATED_FILE_RETENTION_DAYS;
const RETAINED_GENERATED_FILE_CONTEXTS = new Set([
  FileContext.image_generation,
  FileContext.generated_document,
]);

function isImageGenerationMcpTool(toolName) {
  return typeof toolName === 'string' && toolName.endsWith('_mcp_Image_Generation');
}

function getGeneratedImageRetentionExpiry(now = Date.now()) {
  return getGeneratedFileRetentionExpiry(now);
}

function getExpiredGeneratedFileMessage(file) {
  const duration = formatGeneratedFileRetentionDuration();
  return file?.context === FileContext.generated_document
    ? `Document expired after ${duration} - generate a new copy.`
    : `This generated image expired after ${duration} and is no longer available.`;
}

function isExpiredGeneratedFile(file, now = Date.now()) {
  if (!RETAINED_GENERATED_FILE_CONTEXTS.has(file?.context) || !file.retentionExpiresAt) {
    return false;
  }

  const expiry = new Date(file.retentionExpiresAt).getTime();
  return Number.isFinite(expiry) && expiry <= now;
}

function isExpiredGeneratedImage(file, now = Date.now()) {
  return file?.context === FileContext.image_generation && isExpiredGeneratedFile(file, now);
}

function isExpiredGeneratedDocument(file, now = Date.now()) {
  return file?.context === FileContext.generated_document && isExpiredGeneratedFile(file, now);
}

async function removeExpiredGeneratedFile(file, appConfig) {
  const { deleteFile: deleteStoredFile } = getStrategyFunctions(file.source);
  if (!deleteStoredFile) {
    throw new Error(`No file deletion strategy is configured for ${file.source}`);
  }

  const userId = file.user?.toString();
  if (!userId) {
    throw new Error(`Generated file ${file.file_id} has no owner`);
  }

  await deleteStoredFile(
    {
      config: appConfig,
      user: { id: userId },
      body: {},
    },
    file,
  );
  await deleteFile(file.file_id);
}

async function removeExpiredGeneratedImage(file, appConfig) {
  return removeExpiredGeneratedFile(file, appConfig);
}

async function removeExpiredGeneratedDocument(file, appConfig) {
  return removeExpiredGeneratedFile(file, appConfig);
}

async function cleanupExpiredGeneratedFiles(appConfig, now = Date.now()) {
  const files = await getFiles({
    context: { $in: [...RETAINED_GENERATED_FILE_CONTEXTS] },
    retentionExpiresAt: { $lte: new Date(now) },
  });

  const outcomes = await Promise.allSettled(
    files.map((file) => removeExpiredGeneratedFile(file, appConfig)),
  );

  let deleted = 0;
  let failed = 0;
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      deleted += 1;
      return;
    }

    failed += 1;
    logger.error(
      `[GeneratedFileRetention] Failed to remove expired file ${files[index].file_id}:`,
      outcome.reason,
    );
  });

  if (deleted > 0 || failed > 0) {
    logger.info?.(
      `[GeneratedFileRetention] Deleted ${deleted} expired generated file(s); ${failed} failed.`,
    );
  }

  return { deleted, failed };
}

async function cleanupExpiredGeneratedImages(appConfig, now = Date.now()) {
  return cleanupExpiredGeneratedFiles(appConfig, now);
}

function startGeneratedFileRetentionCleanup(appConfig) {
  const runCleanup = () => {
    cleanupExpiredGeneratedFiles(appConfig).catch((error) => {
      logger.error('[GeneratedFileRetention] Cleanup failed:', error);
    });
  };

  runCleanup();
  const timer = setInterval(runCleanup, getGeneratedFileCleanupIntervalMinutes() * 60 * 1000);
  timer.unref?.();
  return timer;
}

function startGeneratedImageRetentionCleanup(appConfig) {
  return startGeneratedFileRetentionCleanup(appConfig);
}

module.exports = {
  GENERATED_FILE_RETENTION_HOURS,
  GENERATED_FILE_RETENTION_DAYS,
  GENERATED_IMAGE_RETENTION_DAYS,
  getGeneratedFileCleanupIntervalMinutes,
  getGeneratedFileRetentionMinutes,
  isImageGenerationMcpTool,
  getGeneratedFileRetentionExpiry,
  getGeneratedImageRetentionExpiry,
  getExpiredGeneratedFileMessage,
  isExpiredGeneratedFile,
  isExpiredGeneratedImage,
  isExpiredGeneratedDocument,
  removeExpiredGeneratedFile,
  removeExpiredGeneratedImage,
  removeExpiredGeneratedDocument,
  cleanupExpiredGeneratedFiles,
  cleanupExpiredGeneratedImages,
  startGeneratedFileRetentionCleanup,
  startGeneratedImageRetentionCleanup,
};

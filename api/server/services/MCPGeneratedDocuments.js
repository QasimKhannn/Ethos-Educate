const { randomUUID } = require('crypto');
const {
  buildManagedDocumentText,
  extractGeneratedDocumentArtifacts,
  getGeneratedDocumentRetentionExpiry,
} = require('@librechat/api');
const { FileContext } = require('librechat-data-provider');
const { processFileURL } = require('~/server/services/Files/process');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');

const DOCUMENT_MCP_SERVER = 'Downloadable-Files-Creation';
const DOCUMENT_STORAGE_BASE_PATH = 'generated-documents';

function getTextResult(response) {
  if (typeof response === 'string') {
    return { artifacts: undefined, content: response, isContentArray: false };
  }

  if (!Array.isArray(response)) {
    return null;
  }

  const [content, artifacts] = response;
  if (typeof content === 'string') {
    return { artifacts, content, isContentArray: false };
  }

  if (!Array.isArray(content) || content.some((part) => part.type !== 'text')) {
    return null;
  }

  return {
    artifacts,
    content: content.map((part) => part.text).join('\n\n'),
    isContentArray: true,
  };
}

async function persistGeneratedDocuments({ req, requestBody, response, serverName }) {
  if (serverName !== DOCUMENT_MCP_SERVER || !req?.config || !req.user?.id) {
    return response;
  }

  const textResult = getTextResult(response);
  if (!textResult) {
    return response;
  }

  const extracted = extractGeneratedDocumentArtifacts(textResult.content);
  if (extracted.documents.length === 0) {
    return response;
  }

  const retentionExpiresAt = getGeneratedDocumentRetentionExpiry();
  const fileStrategy = getFileStrategy(req.config, {
    context: FileContext.generated_document,
  });
  const files = await Promise.all(
    extracted.documents.map((document) =>
      processFileURL({
        fileStrategy,
        userId: req.user.id,
        URL: document.sourceUrl,
        fileName: document.filename,
        storageFileName: randomUUID(),
        fileType: document.mimeType,
        basePath: DOCUMENT_STORAGE_BASE_PATH,
        context: FileContext.generated_document,
        conversationId: requestBody?.conversationId,
        messageId: requestBody?.messageId,
        retentionExpiresAt,
      }),
    ),
  );

  const content = buildManagedDocumentText({
    sourceText: extracted.text,
    documents: files.map((file) => ({
      downloadPath: `/api/files/download/${req.user.id}/${file.file_id}`,
      filename: file.filename,
    })),
    expiresAt: retentionExpiresAt,
  });

  return [
    textResult.isContentArray ? [{ type: 'text', text: content }] : content,
    textResult.artifacts,
  ];
}

module.exports = {
  DOCUMENT_MCP_SERVER,
  persistGeneratedDocuments,
};
